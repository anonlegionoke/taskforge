import "./config";
import { initRabbitMQ, pool } from "@taskforge/shared";

const MAIN_QUEUE = "taskforge.queue.jobs";
const POLL_INTERVAL_MS = 5000;

const sweepJobs = async (channel: any) => {
  console.log("Taskforge Scheduler sweeping...");
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
      console.log(
        `Scheduler swept ${rows.length} ripe jobs. Pushing to RabbitMQ...`,
      );

      for (const row of rows) {
        channel.sendToQueue(
          MAIN_QUEUE,
          Buffer.from(JSON.stringify({ jobId: row.id })),
          {
            persistent: true,
          },
        );
      }
    }
  } catch (error) {
    console.error("Scheduler sweep failed:", error);
  } finally {
    setTimeout(() => sweepJobs(channel), POLL_INTERVAL_MS);
  }
};

const startScheduler = async () => {
  try {
    console.log("Starting Taskforge Scheduler...");
    await pool.query("SELECT 1");
    const channel = await initRabbitMQ();

    console.log(
      `SUCCESS: Taskforge Scheduler running. Sweeping every ${POLL_INTERVAL_MS / 1000} seconds...`,
    );

    sweepJobs(channel);
  } catch (error) {
    console.log("FAILED: Fatal error starting scheduler:", error);
    process.exit(1);
  }
};

startScheduler();
