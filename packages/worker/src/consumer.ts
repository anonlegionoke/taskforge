import { initRabbitMQ, pool, logJobEvent, SystemLogger } from "@taskforge/shared";
const logger = new SystemLogger("WORKER");
import { processJob } from "./processor";
import os from "node:os";
import type { ChannelModel, ConfirmChannel, ConsumeMessage } from "amqplib";

if (!process.env.RABBITMQ_QUEUE) {
  throw new Error("FATAL: RABBITMQ_QUEUE environment variable is missing.");
}
const MAIN_QUEUE = process.env.RABBITMQ_QUEUE;
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
             locked_by = $2
         WHERE id = $1
           AND status = 'RUNNING'
           AND locked_by = $2`,
        [jobId, WORKER_ID],
      )
      .catch((error) => {
        logger.error(`Failed to heartbeat job ${jobId}:`, error);
      });
  }, HEARTBEAT_INTERVAL_MS);

  timer.unref();

  return () => clearInterval(timer);
};


const handleRabbitMQClose = () => {
  if (!isShuttingDown) {
    logger.error("Worker lost RabbitMQ connection. Reconnecting...");
    setTimeout(setupRabbitMQConsumer, process.env.NODE_ENV === "test" ? 100 : 5000);
  }
};

const setupRabbitMQConsumer = async () => {
  if (isShuttingDown) return;

  try {
    // Initialize RabbitMQ
    const { channel, connection } = await initRabbitMQ();
    rabbitChannel = channel;
    rabbitConnection = connection;

    connection.removeListener("close", handleRabbitMQClose);
    connection.on("close", handleRabbitMQClose);

    logger.info("Listening for job on queue:", MAIN_QUEUE);

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
               locked_by = $2
           WHERE id = $1
             AND status = 'PROCESSING'
             AND run_at <= NOW()
           RETURNING *`,
          [jobId, WORKER_ID],
        );
        const job = dbResult.rows[0];

        if (!job) {
          logger.warn(`Job ${jobId} not found, not queued, or not due. Skipping.`);
          channel.ack(msg);
          return;
        }

        await logJobEvent(jobId, WORKER_ID, "CLAIMED");

        if (job.type === "chaos_crash_worker") {
          // If we are in the test suite and NOT the dedicated crash worker, we process it normally to prove recovery works
          if (process.env.NODE_ENV === "test" && process.env.CRASH_IN_TEST !== "true") {
            logger.info("Main test worker recovered the chaos job. Completing it.");
          } else {
            logger.error("CRITICAL: Chaos crash triggered! Worker process exiting unexpectedly...");
            setTimeout(() => process.exit(1), 100);
            return; // Intentionally don't ack to simulate ungraceful crash
          }
        }

        const stopHeartbeat = startJobHeartbeat(jobId);
        try {
          await processJob(jobId, job.payload);
        } finally {
          stopHeartbeat();
        }

        const updateResult = await pool.query(
          `UPDATE jobs
           SET status = 'COMPLETED',
               completed_at = NOW(),
               locked_at = NULL,
               locked_by = NULL
           WHERE id = $1
             AND locked_by = $2`,
          [jobId, WORKER_ID],
        );

        if (updateResult.rowCount === 0) {
          logger.warn(`Stale worker prevented from completing job ${jobId}. Lock was lost.`);
          channel.ack(msg);
          return;
        }

        await logJobEvent(jobId, WORKER_ID, "SUCCESS");

        logger.info(`SUCCESS: Job ${jobId} completed Successfully.`);
        channel.ack(msg);
      } catch (error) {
        if (!jobId) {
          logger.error("Invalid job message. Sending to DLQ:", (error as Error).message);
          channel.nack(msg, false, false);
          return;
        }

        const errorMessage = (error as Error).message;

        const dbResult = await pool.query(
          `SELECT attempts, max_attempts 
              FROM jobs 
              WHERE id = $1`,
          [jobId],
        );
        const jobState = dbResult.rows[0];

        if (!jobState) {
          logger.warn(`Job ${jobId} disappeared while handling failure. Dropping message.`);
          await logJobEvent(jobId, WORKER_ID, "DLQ_SENT", "Job disappeared from DB");
          channel.ack(msg);
          return;
        }

        const currentAttempts = jobState.attempts;

        if (currentAttempts < jobState.max_attempts) {
          // Exponential Backoff
          const delaySeconds = Math.pow(2, currentAttempts) * 5;

          const updateResult = await pool.query(
            `UPDATE jobs 
                SET status = 'PENDING', 
                    run_at = NOW() + ($1 * INTERVAL '1 second'),
                    locked_at = NULL,
                    locked_by = NULL
                WHERE id = $2
                  AND locked_by = $3`,
            [delaySeconds, jobId, WORKER_ID],
          );

          if (updateResult.rowCount === 0) {
            logger.warn(`Stale worker prevented from retrying job ${jobId}. Lock was lost.`);
            channel.ack(msg);
            return;
          }

          logger.error(`Failed to process job ${jobId}:`, errorMessage);
          logger.warn(
            `Job ${jobId} failed. Retrying in ${delaySeconds}s... (Attempt ${currentAttempts} of ${jobState.max_attempts})`,
          );
          await logJobEvent(jobId, WORKER_ID, "ERROR", errorMessage);
          await logJobEvent(jobId, WORKER_ID, "RETRY_SCHEDULED", errorMessage);

          channel.ack(msg);
        } else {
          const updateResult = await pool.query(
            `UPDATE jobs
             SET status = 'FAILED',
                 failed_at = NOW(),
                 locked_at = NULL,
                 locked_by = NULL
             WHERE id = $1
               AND locked_by = $2`,
            [jobId, WORKER_ID],
          );

          if (updateResult.rowCount === 0) {
            logger.warn(`Stale worker prevented from failing job ${jobId}. Lock was lost.`);
            channel.ack(msg);
            return;
          }

          logger.error(`Failed to process job ${jobId}:`, errorMessage);
          logger.error(
            `Job ${jobId} permanently failed after ${jobState.max_attempts} attempts. Sending to DLQ.`,
          );
          await logJobEvent(jobId, WORKER_ID, "ERROR", errorMessage);
          await logJobEvent(jobId, WORKER_ID, "FAILED", errorMessage);
          channel.nack(msg, false, false);
        }
      } finally {
        activeJobs--;
      }
    });

    consumerTag = consumeResult.consumerTag;
  } catch (error) {
    logger.error("Failed to setup RabbitMQ consumer:", error);
    if (!isShuttingDown) {
      setTimeout(setupRabbitMQConsumer, 5000);
    }
  }
};

export const startConsumer = async () => {
  try {
    logger.info("Starting Taskforge worker...");
    await pool.query("SELECT 1");
    logger.info("SUCCESS: DB Connected");

    await setupRabbitMQConsumer();
  } catch (error) {
    logger.error("FAILED: Fatal error during worker startup", error);
    process.exit(1);
  }
};

export const pauseConsumer = async () => {
  if (rabbitChannel && consumerTag) {
    await rabbitChannel.cancel(consumerTag);
    consumerTag = null;
  }
};

export const resumeConsumer = async () => {
  if (!consumerTag) {
    await setupRabbitMQConsumer();
  }
};

/* Graceful shutdown */
export const shutdownConsumer = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  isShuttingDown = true;

  // Stopping new messages
  if (rabbitChannel && consumerTag) {
    logger.info("Cancelling RabbitMQ consumer...");
    await rabbitChannel.cancel(consumerTag);
  }

  if (activeJobs > 0) {
    logger.info(`Waiting for ${activeJobs} active job(s) to finish...`);
    const deadline = Date.now() + SHUTDOWN_TIMEOUT_MS;

    while (activeJobs > 0 && Date.now() < deadline) {
      await sleep(500);
    }

    if (activeJobs > 0) {
      logger.warn(
        `Shutdown timeout reached with ${activeJobs} active job(s). Closing RabbitMQ so unacked messages can be redelivered.`,
      );
    }
  }

  logger.info("All jobs finished. Closing connections...");

  try {
    if (rabbitChannel) await rabbitChannel.close();
    if (rabbitConnection) await rabbitConnection.close();
    await pool.end();
    const exitCode = activeJobs === 0 ? 0 : 1;
    logger.info("SUCCESS: Worker shutdown complete.");
    if (process.env.NODE_ENV !== "test") process.exit(exitCode);
  } catch (error) {
    logger.error("FAILED: Error during shutdown:", error);
    if (process.env.NODE_ENV !== "test") process.exit(1);
  }
};
