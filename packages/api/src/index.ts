// Express server
import "./config";
import express from "express";
import { pool } from "@taskforge/shared";

const app = express();
app.use(express.json());

const PORT = process.env.API_SERVER_PORT || 3000;

// POST /jobs
app.post("/jobs", async (req, res) => {
  const { type, payload, runAt } = req.body;

  if (!type) {
    return res.status(400).json({ error: 'Job "type" is required.' });
  }

  if (
    runAt !== undefined &&
    (typeof runAt !== "string" || Number.isNaN(Date.parse(runAt)))
  ) {
    return res
      .status(400)
      .json({ error: 'Job "runAt" must be a valid timestamp.' });
  }

  try {
    const dbResult = await pool.query<{ id: string; run_at: string }>(
      `INSERT INTO jobs (type, payload, status, run_at)
       VALUES ($1, $2, 'PENDING', COALESCE($3::timestamptz, NOW()))
       RETURNING id, run_at`,
      [type, payload ?? {}, runAt ?? null],
    );

    const job = dbResult.rows[0];

    console.log("SUCCESS: Job scheduled: ", job.id);

    return res
      .status(202)
      .json({
        message: "Job scheduled for processing",
        jobId: job.id,
        runAt: job.run_at,
      });
  } catch (error) {
    console.error("Error ingesting job: ", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Boot Sequence
const startServer = async () => {
  try {
    console.log("Starting Taskforge API Server...");

    // Test DB
    await pool.query("SELECT 1");
    console.log("SUCCESS: DB connected.");

    app.listen(PORT, () => {
      console.log("SUCCESS: Taskforge API listening on port:", PORT);
    });
  } catch (error) {
    console.error("FAILED: Fatal error during startup", error);
    process.exit(1);
  }
};

startServer();
