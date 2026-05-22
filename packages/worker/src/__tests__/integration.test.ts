process.env.NODE_ENV = "test";
import "../config";

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { pool, getChannel, getConnection } from "@taskforge/shared";
import { startConsumer, shutdownConsumer, pauseConsumer, resumeConsumer } from "../consumer";
import { sweepJobs, shutdownScheduler } from "../scheduler";

import { spawn } from "child_process";
import path from "path";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForJobStatus = async (jobId: string, expectedStatuses: string[], maxRetries = 40, delayMs = 100) => {
  for (let i = 0; i < maxRetries; i++) {
    const check = await pool.query(`SELECT status, attempts, run_at, locked_at, locked_by FROM jobs WHERE id = $1`, [jobId]);
    if (check.rows.length > 0 && expectedStatuses.includes(check.rows[0].status)) {
      return check.rows[0];
    }
    await sleep(delayMs);
  }
  throw new Error(`Timeout waiting for job ${jobId} to reach one of: ${expectedStatuses.join(", ")}`);
};

describe("Taskforge Distributed Integration Tests", () => {
  beforeAll(async () => {
    // Ensure DB connection
    await pool.query("SELECT 1");
    // Start worker daemon
    await startConsumer();
  });

  afterAll(async () => {
    await shutdownConsumer("SIGTERM");
    await shutdownScheduler("SIGTERM");
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM job_logs");
    await pool.query("DELETE FROM jobs");
  });

  it("Retry Mechanism: fails and increments attempts with exponential backoff", async () => {
    const { rows } = await pool.query(
      `INSERT INTO jobs (type, payload, status) VALUES ('test_fail', '{"fail": true}', 'PENDING') RETURNING id`
    );
    const jobId = rows[0].id;

    await sweepJobs();
    const jobState = await waitForJobStatus(jobId, ["PENDING"]);

    expect(jobState.attempts).toBe(1);
    expect(jobState.status).toBe("PENDING");
    expect(jobState.run_at.getTime()).toBeGreaterThan(Date.now());
  });

  it("Stale Lock Recovery: Scheduler unlocks jobs dead for > 15m", async () => {
    const { rows } = await pool.query(
      `INSERT INTO jobs (type, payload, status, locked_at, locked_by) 
       VALUES ('test_stale', '{}', 'PROCESSING', NOW() - INTERVAL '20 minutes', 'dead_worker_node_1') 
       RETURNING id`
    );
    const jobId = rows[0].id;

    await sweepJobs();

    // Wait for the worker to process the swept job
    const jobState = await waitForJobStatus(jobId, ["COMPLETED"]);

    expect(jobState.status).toBe("COMPLETED");
    expect(jobState.locked_at).toBeNull();
    expect(jobState.locked_by).toBeNull();
  });

  it("Duplicate Messages (Idempotency): Worker strictly ignores identical duplicated RabbitMQ messages", async () => {
    const { rows } = await pool.query(
      `INSERT INTO jobs (type, payload, status) VALUES ('dummy_task', '{}', 'PROCESSING') RETURNING id`
    );
    const jobId = rows[0].id;

    const channel = getChannel();

    // Publish exactly the same message TWICE manually to simulate network partition delivery duplication
    const testQueue = process.env.RABBITMQ_QUEUE || "taskforge.queue.jobs";
    channel.sendToQueue(testQueue, Buffer.from(JSON.stringify({ jobId })), { persistent: true });
    channel.sendToQueue(testQueue, Buffer.from(JSON.stringify({ jobId })), { persistent: true });

    const jobState = await waitForJobStatus(jobId, ["COMPLETED"]);

    expect(jobState.status).toBe("COMPLETED");

    const logs = await pool.query(`SELECT event_type FROM job_logs WHERE job_id = $1 ORDER BY created_at ASC`, [jobId]);
    const events = logs.rows.map((r: any) => r.event_type);

    const claimedCount = events.filter((e: string) => e === "CLAIMED").length;
    const successCount = events.filter((e: string) => e === "SUCCESS").length;

    // Despite RabbitMQ delivering it twice, the DB locking algorithm should ensure it was only processed ONCE
    expect(claimedCount).toBe(1);
    expect(successCount).toBe(1);
  });

  it("Worker Crash Recovery & End-to-End Stale RUNNING recovery", async () => {
    // Temporarily pause the main test suite consumer so the child worker can exclusively claim the job
    await pauseConsumer();

    // Spawn a real child process worker
    const tsxPath = path.resolve(__dirname, "../../../../node_modules/.bin/tsx");
    const childWorker = spawn(tsxPath, [path.resolve(__dirname, "../index.ts")], {
      env: { ...process.env, WORKER_ID: "child-worker-test", CRASH_IN_TEST: "true" }
    });

    childWorker.stdout?.on("data", (data) => console.log(`[CHILD STDOUT]: ${data}`));
    childWorker.stderr?.on("data", (data) => console.error(`[CHILD STDERR]: ${data}`));

    // Wait for child to connect
    await sleep(5000);

    const { rows } = await pool.query(
      `INSERT INTO jobs (type, payload, status) VALUES ('chaos_crash_worker', '{}', 'PENDING') RETURNING id`
    );
    const jobId = rows[0].id;

    // Push it to RabbitMQ
    await sweepJobs();

    // Wait for the child worker to claim it and immediately crash
    const exitPromise = new Promise((resolve) => {
      childWorker.on("exit", (code) => resolve(code));
    });

    const exitCode = await exitPromise;
    expect(exitCode).toBe(1); // Ensure it actually exited with failure

    // Verify it is stuck in RUNNING
    const jobState = await waitForJobStatus(jobId, ["RUNNING"]);
    expect(jobState.status).toBe("RUNNING");
    expect(jobState.locked_by).toBe("child-worker-test");

    // Fast-forward time to simulate 15 minutes of dead worker
    await pool.query(`UPDATE jobs SET locked_at = NOW() - INTERVAL '20 minutes' WHERE id = $1`, [jobId]);

    // Restart the main test consumer
    await resumeConsumer();

    // Sweep again. The scheduler should break the lock, and the MAIN test worker should successfully claim and complete it
    await sweepJobs();

    const recoveredState = await waitForJobStatus(jobId, ["COMPLETED"]);
    expect(recoveredState.status).toBe("COMPLETED");
  }, 30000);

  it("RabbitMQ Reconnection: Worker auto-reconnects and resumes processing", async () => {
    // Forcefully close the RabbitMQ connection to simulate a network drop
    const connection = getConnection();
    connection.close();

    // Wait for the worker to detect the close event and reconnect (100ms in test environment)
    await sleep(500);

    // Ensure it can still process jobs after reconnecting
    const { rows } = await pool.query(
      `INSERT INTO jobs (type, payload, status) VALUES ('dummy_task', '{}', 'PENDING') RETURNING id`
    );
    const jobId = rows[0].id;

    await sweepJobs();

    const jobState = await waitForJobStatus(jobId, ["COMPLETED"]);
    expect(jobState.status).toBe("COMPLETED");
  });
});
