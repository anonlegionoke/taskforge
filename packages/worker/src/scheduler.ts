import "./config";
import { initRabbitMQ, pool, logJobEvent, SystemLogger } from "@taskforge/shared";
import os from "node:os";
import type { ChannelModel } from "amqplib";

const MAIN_QUEUE = "taskforge.queue.jobs";
const POLL_INTERVAL_MS = 5000;
const LOCK_TIMEOUT = "15 minutes";
const SCHEDULER_ID =
  process.env.SCHEDULER_ID ??
  process.env.INSTANCE_ID ??
  `scheduler-${os.hostname()}-${process.pid}`;

const logger = new SystemLogger("SCHEDULER");

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
          locked_by = NULL
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
          failed_at = CASE
            WHEN attempts >= max_attempts THEN NOW()
            ELSE NULL
          END,
          run_at = CASE
            WHEN attempts >= max_attempts THEN run_at
            ELSE NOW()
          END,
          locked_at = NULL,
          locked_by = NULL
      WHERE status = 'RUNNING'
        AND (locked_at IS NULL OR locked_at < NOW() - $1::interval)
      RETURNING id, status;
    `,
    [LOCK_TIMEOUT],
  );

  if (staleQueuedJobs.rows.length > 0) {
    await Promise.all(staleQueuedJobs.rows.map(row => logJobEvent(row.id, SCHEDULER_ID, "STALE_RECOVERED")));
  }

  if (rows.length > 0) {
    await Promise.all(rows.map(row => {
      if (row.status === "FAILED") {
        return logJobEvent(row.id, SCHEDULER_ID, "FAILED", "Max attempts exhausted during stale running recovery");
      } else {
        return logJobEvent(row.id, SCHEDULER_ID, "STALE_RECOVERED");
      }
    }));
  }

  if (staleQueuedJobs.rows.length > 0 || rows.length > 0) {
    const resetCount = rows.filter((row) => row.status === "PENDING").length;
    const failedCount = rows.filter((row) => row.status === "FAILED").length;

    logger.warn(
      `Recovered ${staleQueuedJobs.rows.length} stale queued job(s), ${resetCount} stale running job(s); marked ${failedCount} job(s) FAILED.`,
    );
  }
};

export const sweepJobs = async () => {
  logger.info("Taskforge Scheduler sweeping...");

  if (isShuttingDown) return;

  try {
    // Purge old logs to bound the system_logs table
    await pool.query("DELETE FROM system_logs WHERE created_at < NOW() - INTERVAL '24 hours'");

    await resetStaleLeases();

    const { rows } = await pool.query<{ id: string; run_at: Date; created_at: Date }>(
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
            RETURNING id, run_at, created_at;
        `,
      [LOCK_TIMEOUT, SCHEDULER_ID],
    );

    if (rows.length > 0) {
      logger.info(`Scheduler swept ${rows.length} ripe jobs. Pushing to RabbitMQ...`);

      // For strict FIFO scheduling
      rows.sort(
        (a, b) =>
          a.run_at.getTime() - b.run_at.getTime() || a.created_at.getTime() - b.created_at.getTime(),
      );

      const { channel } = await initRabbitMQ();
      rabbitChannel = channel;

      for (const row of rows) {
        channel.sendToQueue(MAIN_QUEUE, Buffer.from(JSON.stringify({ jobId: row.id })), {
          persistent: true,
        });
      }

      await channel.waitForConfirms();
    }
  } catch (error) {
    logger.error("Scheduler sweep failed:", error);
  } finally {
    if (!isShuttingDown) {
      sweepTimeout = setTimeout(() => sweepJobs(), POLL_INTERVAL_MS);
    }
  }
};

export const startScheduler = async () => {
  try {
    logger.info("Starting Taskforge Scheduler...");
    await pool.query("SELECT 1");
    const { channel, connection } = await initRabbitMQ();
    rabbitChannel = channel;
    rabbitConnection = connection;

    logger.info(
      `SUCCESS: Taskforge Scheduler running. Sweeping every ${POLL_INTERVAL_MS / 1000} seconds...`,
    );

    sweepJobs();
  } catch (error) {
    logger.error("FAILED: Fatal error starting scheduler:", error);
    process.exit(1);
  }
};

/* Graceful shutdown */
export const shutdownScheduler = async (signal: string) => {
  logger.info(`Received ${signal}. Stopping Scheduler sweeps...`);
  isShuttingDown = true;

  // Clear the timeout so it doesn't trigger another sweep
  if (sweepTimeout) {
    clearTimeout(sweepTimeout);
  }

  try {
    if (rabbitChannel) await rabbitChannel.close();
    if (rabbitConnection) await rabbitConnection.close();
    await pool.end();

    logger.info("Scheduler Shutdown complete!");
    if (process.env.NODE_ENV !== "test") process.exit(0);
  } catch (error) {
    logger.error("Error closing RabbitMQ connection:", error);
    if (process.env.NODE_ENV !== "test") process.exit(1);
  }
};

process.on("SIGTERM", () => shutdownScheduler("SIGTERM"));
process.on("SIGINT", () => shutdownScheduler("SIGINT"));

startScheduler();
