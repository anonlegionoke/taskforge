import { initRabbitMQ, pool } from "@taskforge/shared";
import { processJob } from "./processor";
import os from "node:os";
import type { ChannelModel, ConfirmChannel, ConsumeMessage } from "amqplib";

const MAIN_QUEUE = "taskforge.queue.jobs";
const WORKER_ID =
  process.env.WORKER_ID ?? process.env.INSTANCE_ID ?? `worker-${os.hostname()}-${process.pid}`;
const HEARTBEAT_INTERVAL_MS = Number(process.env.WORKER_HEARTBEAT_INTERVAL_MS ?? 60_000);
const SHUTDOWN_TIMEOUT_MS = Number(process.env.WORKER_SHUTDOWN_TIMEOUT_MS ?? 30_000);

let isShuttingDown: boolean = false;
let activeJobs: number = 0;
let rabbitChannel: ConfirmChannel | null = null;
let rabbitConnection: ChannelModel | null = null;
let consumerTag: string | null = null;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const startJobHeartbeat = (jobId: string) => {
  const timer = setInterval(() => {
    pool
      .query(
        `UPDATE jobs
         SET locked_at = NOW(),
             locked_by = $2,
             updated_at = NOW()
         WHERE id = $1
           AND status = 'RUNNING'`,
        [jobId, WORKER_ID],
      )
      .catch((error) => {
        console.error(`Failed to heartbeat job ${jobId}:`, error);
      });
  }, HEARTBEAT_INTERVAL_MS);

  timer.unref();

  return () => clearInterval(timer);
};

const logJobEvent = async (
  jobId: string,
  eventType: string,
  errorMessage: string | null = null,
) => {
  try {
    await pool.query(
      `INSERT INTO job_logs (job_id, worker_id, event_type, error_message) VALUES ($1, $2, $3, $4)`,
      [jobId, WORKER_ID, eventType, errorMessage],
    );
  } catch (err) {
    console.error(`Failed to write job log for ${jobId}:`, err);
  }
};

const setupRabbitMQConsumer = async () => {
  if (isShuttingDown) return;

  try {
    // Initialize RabbitMQ
    const { channel, connection } = await initRabbitMQ();
    rabbitChannel = channel;
    rabbitConnection = connection;

    connection.on("close", () => {
      if (!isShuttingDown) {
        console.error("Worker lost RabbitMQ connection. Reconnecting in 5s...");
        setTimeout(setupRabbitMQConsumer, 5000);
      }
    });

    console.log("Listening for job on queue:", MAIN_QUEUE);

    const consumeResult = await channel.consume(MAIN_QUEUE, async (msg: ConsumeMessage | null) => {
      if (!msg) return;

      if (isShuttingDown) {
        channel.nack(msg, false, true);
        return;
      }

      activeJobs++;
      let jobId: string | undefined;

      try {
        const parsedMessage = JSON.parse(msg.content.toString());
        jobId = parsedMessage.jobId;

        if (!jobId) {
          throw new Error("RabbitMQ message is missing jobId.");
        }

        // Atomically check and claim the job
        const dbResult = await pool.query(
          `UPDATE jobs
           SET status = 'RUNNING',
               attempts = attempts + 1,
               locked_at = NOW(),
               locked_by = $2,
               updated_at = NOW()
           WHERE id = $1
             AND status = 'PROCESSING'
             AND run_at <= NOW()
           RETURNING *`,
          [jobId, WORKER_ID],
        );
        const job = dbResult.rows[0];

        if (!job) {
          console.warn(`Job ${jobId} not found, not queued, or not due. Skipping.`);
          channel.ack(msg);
          return;
        }

        await logJobEvent(jobId, "CLAIMED");

        if (job.type === "chaos_crash_worker") {
          console.error("CRITICAL: Chaos crash triggered! Worker process exiting unexpectedly...");
          setTimeout(() => process.exit(1), 100);
          return; // Intentionally don't ack to simulate ungraceful crash
        }

        const stopHeartbeat = startJobHeartbeat(jobId);
        try {
          await processJob(jobId, job.payload);
        } finally {
          stopHeartbeat();
        }

        await pool.query(
          `UPDATE jobs
           SET status = 'COMPLETED',
               locked_at = NULL,
               locked_by = NULL,
               updated_at = NOW()
           WHERE id = $1`,
          [jobId],
        );

        await logJobEvent(jobId, "SUCCESS");

        console.log(`SUCCESS: Job ${jobId} completed Successfully.`);
        channel.ack(msg);
      } catch (error) {
        if (!jobId) {
          console.error("Invalid job message. Sending to DLQ:", (error as Error).message);
          channel.nack(msg, false, false);
          return;
        }

        const errorMessage = (error as Error).message;

        console.error(`Failed to process job ${jobId}:`, errorMessage);

        await logJobEvent(jobId, "ERROR", errorMessage);

        const dbResult = await pool.query(
          `SELECT attempts, max_attempts 
              FROM jobs 
              WHERE id = $1`,
          [jobId],
        );
        const jobState = dbResult.rows[0];

        if (!jobState) {
          console.warn(`Job ${jobId} disappeared while handling failure. Dropping message.`);
          channel.ack(msg);
          return;
        }

        const currentAttempts = jobState.attempts;

        if (currentAttempts < jobState.max_attempts) {
          // Exponential Backoff
          const delaySeconds = Math.pow(2, currentAttempts) * 5;

          console.warn(
            `Job ${jobId} failed. Retrying in ${delaySeconds}s... (Attempt ${currentAttempts} of ${jobState.max_attempts})`,
          );

          await pool.query(
            `UPDATE jobs 
                SET status = 'PENDING', 
                    run_at = NOW() + ($1 * INTERVAL '1 second'),
                    locked_at = NULL,
                    locked_by = NULL,
                    updated_at = NOW()
                WHERE id = $2`,
            [delaySeconds, jobId],
          );

          channel.ack(msg);
        } else {
          console.error(
            `Job ${jobId} permanently failed after ${jobState.max_attempts} attempts. Sending to DLQ.`,
          );

          await pool.query(
            `UPDATE jobs
             SET status = 'FAILED',
                 locked_at = NULL,
                 locked_by = NULL,
                 updated_at = NOW()
             WHERE id = $1`,
            [jobId],
          );
          channel.nack(msg, false, false);
        }
      } finally {
        activeJobs--;
      }
    });

    consumerTag = consumeResult.consumerTag;
  } catch (error) {
    console.error("Failed to setup RabbitMQ consumer:", error);
    if (!isShuttingDown) {
      setTimeout(setupRabbitMQConsumer, 5000);
    }
  }
};

export const startConsumer = async () => {
  import("@taskforge/shared").then((m) => m.captureLogs("WORKER"));
  try {
    console.log("Starting Taskforge worker...");

    // Test DB
    await pool.query("SELECT 1");
    console.log("SUCCESS: DB Connected");

    await setupRabbitMQConsumer();
  } catch (error) {
    console.error("FAILED: Fatal error during worker startup", error);
    process.exit(1);
  }
};

/* Graceful shutdown */
export const shutdownConsumer = async (signal: string) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  isShuttingDown = true;

  // Stopping new messages
  if (rabbitChannel && consumerTag) {
    console.log("Cancelling RabbitMQ consumer...");
    await rabbitChannel.cancel(consumerTag);
  }

  if (activeJobs > 0) {
    console.log(`Waiting for ${activeJobs} active job(s) to finish...`);
    const deadline = Date.now() + SHUTDOWN_TIMEOUT_MS;

    while (activeJobs > 0 && Date.now() < deadline) {
      await sleep(500);
    }

    if (activeJobs > 0) {
      console.warn(
        `Shutdown timeout reached with ${activeJobs} active job(s). Closing RabbitMQ so unacked messages can be redelivered.`,
      );
    }
  }

  console.log("All jobs finished. Closing connections...");

  try {
    if (rabbitChannel) await rabbitChannel.close();
    if (rabbitConnection) await rabbitConnection.close();
    await pool.end();
    const exitCode = activeJobs === 0 ? 0 : 1;
    console.log("SUCCESS: Shutdown Complete!");
    process.exit(exitCode);
  } catch (error) {
    console.error("FAILED: Error during shutdown:", error);
    process.exit(1);
  }
};
