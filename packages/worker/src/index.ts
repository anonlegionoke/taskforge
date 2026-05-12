import "./config";
import { initRabbitMQ, pool } from "@taskforge/shared";

const MAIN_QUEUE = "taskforge.queue.jobs";

const processJob = async (jobId: string, payload: any) => {
  console.log(`Processing Job ${jobId}...`);
  await new Promise((resolve) => setTimeout(resolve, 2000));

  if (Math.random() < 0.5) {
    throw new Error("Random simulated processing failure!");
  }
};

const startWorker = async () => {
  try {
    console.log("Starting Taskforge worker...");

    // Test DB
    await pool.query("SELECT 1");
    console.log("SUCCESS: DB Connected");

    // Initialize RabbitMQ
    const channel = await initRabbitMQ();

    console.log("Listening for job on queue:", MAIN_QUEUE);
    channel.consume(MAIN_QUEUE, async (msg) => {
      if (!msg) return;

      const { jobId } = JSON.parse(msg.content.toString());

      try {
        const dbResult = await pool.query("SELECT * FROM jobs WHERE id = $1", [
          jobId,
        ]);
        const job = dbResult.rows[0];

        if (!job) {
          console.warn(`Job ${jobId} not found. Skipping.`);
          channel.ack(msg);
          return;
        }

        if (job.status !== "PENDING") {
          console.log(
            `Job ${jobId} is not PENDING (Status: ${job.status}). Skipping.`,
          );
          channel.ack(msg);
          return;
        }

        await pool.query(
          `UPDATE jobs SET status = 'PROCESSING' WHERE id = $1`,
          [jobId],
        );

        await processJob(jobId, job.payload);

        await pool.query(`UPDATE jobs SET status = 'COMPLETED' WHERE id = $1`, [
          jobId,
        ]);
        console.log(`SUCCESS: Job ${jobId} completed Successfully.`);
        channel.ack(msg);
      } catch (error) {
        console.error(
          `Failed to process job ${jobId}:`,
          (error as Error).message,
        );

        const dbResult = await pool.query(
          "SELECT attempts, max_attempts FROM jobs WHERE id = $1",
          [jobId],
        );
        const jobState = dbResult.rows[0];

        const currentAttempts = jobState.attempts + 1;

        if (currentAttempts < jobState.max_attempts) {
          // Exponential Backoff
          const delaySeconds = Math.pow(2, currentAttempts) * 5;

          console.warn(
            `Job ${jobId} failed. Retrying in ${delaySeconds}s... (Attempt ${currentAttempts} of ${jobState.max_attempts})`,
          );

          await pool.query(
            `UPDATE jobs 
            SET status = 'PENDING', 
                attempts = $1,
                run_at = NOW() + INTERVAL '${delaySeconds} seconds',
                locked_at = NULL,
                locked_by = NULL
            WHERE id = $2`,
            [currentAttempts, jobId],
          );

          channel.ack(msg);
        } else {
          console.error(
            `Job ${jobId} permanently failed after ${jobState.max_attempts} attempts. Sending to DLQ.`,
          );

          await pool.query(
            `UPDATE jobs SET status = 'FAILED', attempts = $1 WHERE id = $2`,
            [currentAttempts, jobId],
          );
          channel.nack(msg, false, false);
        }
      }
    });
  } catch (error) {
    console.error("FAILED: Fatal error during worker startup", error);
    process.exit(1);
  }
};

startWorker();
