process.env.NODE_ENV = "test";
import "../config";

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { pool, getChannel } from "@taskforge/shared";
import { startConsumer, shutdownConsumer } from "../consumer";
import { sweepJobs, shutdownScheduler } from "../scheduler";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
    await sleep(500);

    const check = await pool.query(`SELECT status, attempts, run_at FROM jobs WHERE id = $1`, [jobId]);
    expect(check.rows[0].attempts).toBe(1);
    expect(check.rows[0].status).toBe("PENDING");
    expect(check.rows[0].run_at.getTime()).toBeGreaterThan(Date.now());
  });

  it("Stale Lock Recovery: Scheduler unlocks jobs dead for > 15m", async () => {
    const { rows } = await pool.query(
      `INSERT INTO jobs (type, payload, status, locked_at, locked_by) 
       VALUES ('test_stale', '{}', 'PROCESSING', NOW() - INTERVAL '20 minutes', 'dead_worker_node_1') 
       RETURNING id`
    );
    const jobId = rows[0].id;

    await sweepJobs();

    const check = await pool.query(`SELECT status, locked_at, locked_by FROM jobs WHERE id = $1`, [jobId]);
    expect(check.rows[0].status).toBe("PROCESSING");
    expect(check.rows[0].locked_at).not.toBeNull();
    expect(check.rows[0].locked_by).not.toBeNull();
    expect(check.rows[0].locked_by).not.toBe("dead_worker_node_1");

    // Wait for the worker to finish processing the swept job to avoid cross-test database contamination
    await sleep(500);
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

    await sleep(800);

    const check = await pool.query(`SELECT status, attempts FROM jobs WHERE id = $1`, [jobId]);
    expect(check.rows[0].status).toBe("COMPLETED");

    const logs = await pool.query(`SELECT event_type FROM job_logs WHERE job_id = $1 ORDER BY created_at ASC`, [jobId]);
    const events = logs.rows.map((r: any) => r.event_type);

    const claimedCount = events.filter((e: string) => e === "CLAIMED").length;
    const successCount = events.filter((e: string) => e === "SUCCESS").length;

    // Despite RabbitMQ delivering it twice, the DB locking algorithm should ensure it was only processed ONCE
    expect(claimedCount).toBe(1);
    expect(successCount).toBe(1);
  });

  it("Worker Crash Recovery: RabbitMQ halts ack and DB remains RUNNING", async () => {
    const { rows } = await pool.query(
      `INSERT INTO jobs (type, payload, status) VALUES ('chaos_crash_worker', '{}', 'PENDING') RETURNING id`
    );
    const jobId = rows[0].id;

    await sweepJobs();
    await sleep(500);

    const check = await pool.query(`SELECT status FROM jobs WHERE id = $1`, [jobId]);

    // The DB will still say RUNNING because the worker simulated a crash before it could update it to COMPLETED or FAILED
    expect(check.rows[0].status).toBe("RUNNING");
  });
});
