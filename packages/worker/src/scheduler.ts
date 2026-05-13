import "./config";
import { initRabbitMQ, pool } from "@taskforge/shared";

const MAIN_QUEUE = "taskforge.queue.jobs";
const POLL_INTERVAL_MS = 5000;

let isShuttingDown: boolean = false;
let rabbitChannel: any = null;
let rabbitConnection: any = null;
let sweepTimeout: NodeJS.Timeout | null = null;

const sweepJobs = async (channel: any) => {
  console.log("Taskforge Scheduler sweeping...");

  if (isShuttingDown) return;

  try {
    const { rows } = await pool.query(`
            UPDATE jobs
            SET locked_at = NOW(), locked_by = 'taskforge-scheduler'
            WHERE id IN (
                SELECT id FROM jobs
                WHERE status = 'PENDING'
                    AND run_at <= NOW()
                    AND locked_at is NULL
                LIMIT 50
                FOR UPDATE SKIP LOCKED
            )
            RETURNING id;
        `);

    if (rows.length > 0) {
      console.log(`Scheduler swept ${rows.length} ripe jobs. Pushing to RabbitMQ...`);

      for (const row of rows) {
        channel.sendToQueue(MAIN_QUEUE, Buffer.from(JSON.stringify({ jobId: row.id })), {
          persistent: true,
        });
      }
    }
  } catch (error) {
    console.error("Scheduler sweep failed:", error);
  } finally {
    if (!isShuttingDown) {
      sweepTimeout = setTimeout(() => sweepJobs(channel), POLL_INTERVAL_MS);
    }
  }
};

const startScheduler = async () => {
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
