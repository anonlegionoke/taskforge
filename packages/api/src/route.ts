import { Router } from "express";
import { pool } from "@taskforge/shared";

export const jobRouter = Router();

// GET "/jobs/stats"
jobRouter.get("/stats", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT status, COUNT(*)::int as count
      FROM jobs
      GROUP BY status
    `);

    const stats = { PENDING: 0, PROCESSING: 0, RUNNING: 0, COMPLETED: 0, FAILED: 0 };
    rows.forEach((row) => {
      stats[row.status as keyof typeof stats] = row.count;
    });

    return res.status(200).json(stats);
  } catch (error) {
    console.error("Error fetching stats:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /jobs/:id/logs
jobRouter.get("/:id/logs", async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `
      SELECT event_type, error_message, worker_id, created_at 
      FROM job_logs 
      WHERE job_id = $1 
      ORDER BY created_at ASC
    `,
      [id],
    );

    return res.status(200).json(rows);
  } catch (error) {
    console.error(`Error fetching logs for job ${id}:`, error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET "/jobs"
jobRouter.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT *
      FROM jobs
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 100
    `);
    return res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST "/jobs"
jobRouter.post("/", async (req, res) => {
  const { type, payload, runAt } = req.body;

  if (!type) {
    return res.status(400).json({ error: 'Job "type" is required' });
  }

  if (runAt !== undefined && (typeof runAt !== "string" || Number.isNaN(Date.parse(runAt)))) {
    return res.status(400).json({ error: 'Job "runAt" must be a valid timestamp.' });
  }

  try {
    const jobResult = await pool.query<{ id: string; run_at: string }>(
      `INSERT INTO jobs (type, payload, status, run_at)
        VALUES($1, $2, 'PENDING', COALESCE($3::timestamptz, NOW()))
        RETURNING id, run_at   
        `,
      [type, payload ?? {}, runAt ?? null],
    );

    const job = jobResult.rows[0];
    console.log("SUCCESS: Job scheduled: ", job.id);

    return res.status(202).json({
      message: "Job scheduled for processing",
      jobId: job.id,
      runAt: job.run_at,
    });
  } catch (error) {
    console.error("Error ingesting job:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});
