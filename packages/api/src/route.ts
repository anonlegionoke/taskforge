import { Router } from "express";
import { pool } from "@taskforge/shared";

export const jobRouter = Router();

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
        VALUES($1, $2, "PENDING", COALESCE($3::timestampz, NOW()))
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
