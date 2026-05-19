import "./config";
import { initRabbitMQ, pool } from "@taskforge/shared";
import os from "node:os";
import type { ChannelModel } from "amqplib";

const MAIN_QUEUE = "taskforge.queue.jobs";
const POLL_INTERVAL_MS = 5000;
const LOCK_TIMEOUT = "15 minutes";
const SCHEDULER_ID =
  process.env.SCHEDULER_ID ??
  process.env.INSTANCE_ID ??
  `scheduler-${os.hostname()}-${process.pid}`;

let isShuttingDown: boolean = false;
let rabbitChannel: Awaited<ReturnType<typeof initRabbitMQ>>["channel"] | null = null;
let rabbitConnection: ChannelModel | null = null;
let sweepTimeout: NodeJS.Timeout | null = null;

const resetStaleLeases = async () => {
  const staleQueuedJobs = await pool.query<{ id: string }>(
    `
      UPDATE jobs
      SET status = 'PENDING',
          locked_at = NULL,
          locked_by = NULL,
          updated_at = NOW()
      WHERE status = 'PROCESSING'
        AND (locked_at IS NULL OR locked_at < NOW() - $1::interval)
      RETURNING id;
    `,
    [LOCK_TIMEOUT],
  );

  const { rows } = await pool.query<{ id: string; status: string }>(
    `
      UPDATE jobs
      SET status = CASE
            WHEN attempts >= max_attempts THEN 'FAILED'::job_status
            ELSE 'PENDING'::job_status
          END,
          run_at = CASE
            WHEN attempts >= max_attempts THEN run_at
            ELSE NOW()
          END,
          locked_at = NULL,
          locked_by = NULL,
          updated_at = NOW()
      WHERE status = 'RUNNING'
        AND (locked_at IS NULL OR locked_at < NOW() - $1::interval)
      RETURNING id, status;
    `,
    [LOCK_TIMEOUT],
  );

  if (staleQueuedJobs.rows.length > 0 || rows.length > 0) {
    const resetCount = rows.filter((row) => row.status === "PENDING").length;
    const failedCount = rows.filter((row) => row.status === "FAILED").length;

    console.warn(
      `Recovered ${staleQueuedJobs.rows.length} stale queued job(s), ${resetCount} stale running job(s); marked ${failedCount} job(s) FAILED.`,
    );
  }
};

const sweepJobs = async (channel: Awaited<ReturnType<typeof initRabbitMQ>>["channel"]) => {
  console.log("Taskforge Scheduler sweeping...");

  if (isShuttingDown) return;

  try {
    await resetStaleLeases();

    const { rows } = await pool.query<{ id: string }>(
      `
            UPDATE jobs
            SET status = 'PROCESSING',
                locked_at = NOW(),
                locked_by = $2,
                updated_at = NOW()
            WHERE id IN (
                SELECT id FROM jobs
                WHERE status = 'PENDING'
                    AND run_at <= NOW()
                    AND (locked_at IS NULL OR locked_at < NOW() - $1::interval)
                ORDER BY run_at ASC, created_at ASC
                LIMIT 50
                FOR UPDATE SKIP LOCKED
            )
            RETURNING id;
        `,
      [LOCK_TIMEOUT, SCHEDULER_ID],
    );

    if (rows.length > 0) {
      console.log(`Scheduler swept ${rows.length} ripe jobs. Pushing to RabbitMQ...`);

      for (const row of rows) {
        channel.sendToQueue(MAIN_QUEUE, Buffer.from(JSON.stringify({ jobId: row.id })), {
          persistent: true,
        });
      }

      await channel.waitForConfirms();
    }
  } catch (error) {
    console.error("Scheduler sweep failed:", error);
  } finally {
    if (!isShuttingDown) {
      sweepTimeout = setTimeout(() => sweepJobs(channel), POLL_INTERVAL_MS);
    }
  }
};

export const startScheduler = async () => {
  import("@taskforge/shared").then((m) => m.captureLogs("SCHEDULER"));
  try {
    console.log("Starting Taskforge Scheduler...");
    await pool.query("SELECT 1");
    const { channel, connection } = await initRabbitMQ();
    rabbitChannel = channel;
    rabbitConnection = connection;

    console.log(
      `SUCCESS: Taskforge Scheduler running. Sweeping every ${POLL_INTERVAL_MS / 1000} seconds...`,
    );

    sweepJobs(channel);
  } catch (error) {
    console.log("FAILED: Fatal error starting scheduler:", error);
    process.exit(1);
  }
};

/* Graceful shutdown */
const shutdown = async (signal: string) => {
  console.log(`Received ${signal}. Stopping Scheduler sweeps...`);
  isShuttingDown = true;

  // Clear the timeout so it doesn't trigger another sweep
  if (sweepTimeout) {
    clearTimeout(sweepTimeout);
  }

  try {
    if (rabbitChannel) await rabbitChannel.close();
    if (rabbitConnection) await rabbitConnection.close();
    await pool.end();

    console.log("SUCCESS: Scheduler shutdown complete.");
    process.exit(0);
  } catch (error) {
    console.error("FAILED: Error during scheduler shutdown:", error);
    process.exit(1);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

startScheduler();
