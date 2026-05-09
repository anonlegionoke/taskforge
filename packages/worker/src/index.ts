import "./config";
import { initRabbitMQ, pool } from "@taskforge/shared";

const MAIN_QUEUE = "taskforge.queue.jobs";

const processJob = async (jobId: string, payload: any) => {
  console.log(`Processing Job ${jobId}...`);
  await new Promise((resolve) => setTimeout(resolve, 2000));

  if (Math.random() < 0.1) {
    throw new Error("Random simulated processing failure!");
  }
  console.log(`Job ${jobId} completed successfully.`);
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

        await pool.query(`UPDATE jobs SET status = 'RUNNING' WHERE id = $1`, [
          jobId,
        ]);

        await processJob(jobId, job.payload);

        await pool.query(`UPDATE jobs SET status = 'COMPLETED' WHERE id = $1`, [
          jobId,
        ]);

        channel.ack(msg);
      } catch (error) {
        console.error(
          `Failed to process job ${jobId}:`,
          (error as Error).message,
        );
        await pool.query(`UPDATE jobs SET status = 'FAILED' WHERE id = $1`, [
          jobId,
        ]);
        channel.nack(msg, false, false);
      }
    });
  } catch (error) {
    console.error("FAILED: Fatal error during worker startup", error);
    process.exit(1);
  }
};

startWorker();
