import { Router } from "express";
import { pool, logJobEvent, SystemLogger } from "@taskforge/shared";

const logger = new SystemLogger("API_ROUTE");

export const jobRouter = Router();
export const systemRouter = Router();

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
    logger.error("Error fetching stats:", error);
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
    logger.error(`Error fetching logs for job ${id}:`, error);
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
    logger.error("Error fetching jobs:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET "/system/logs"
systemRouter.get("/logs", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 100`
    );
    return res.status(200).json(rows);
  } catch (error) {
    logger.error("Error fetching system logs:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET "/system/health"
systemRouter.get("/health", async (req, res) => {
  const health = {
    api: "UP",
    db: "DOWN",
    rabbitmq: "DOWN",
    worker: "DOWN",
    scheduler: "DOWN",
    timestamp: new Date().toISOString()
  };

  try {
    await pool.query('SELECT 1');
    health.db = "UP";
    
    try {
      const schedulerCheck = await pool.query(`
        SELECT 1 FROM system_logs 
        WHERE source = 'SCHEDULER' 
        AND created_at > NOW() - INTERVAL '30 seconds' 
        LIMIT 1
      `);
      health.scheduler = (schedulerCheck.rowCount && schedulerCheck.rowCount > 0) ? "UP" : "DOWN";
    } catch (e) {
      health.scheduler = "DOWN";
    }
  } catch (e) {
    health.db = "DOWN";
  }

  try {
    const { initRabbitMQ } = await import("@taskforge/shared");
    const { channel } = await initRabbitMQ();
    health.rabbitmq = "UP";
    
    try {
      const queueName = process.env.RABBITMQ_QUEUE;
      if (!queueName) throw new Error("Missing queue config");
      const q = await channel.checkQueue(queueName);
      health.worker = q.consumerCount > 0 ? "UP" : "DOWN";
    } catch (e) {
      health.worker = "DOWN";
    }
  } catch (e) {
    health.rabbitmq = "DOWN";
    health.worker = "DOWN";
  }

  return res.status(200).json(health);
});

// POST "/jobs"
jobRouter.post("/", async (req, res) => {
  const { type, payload, runAt, max_attempts } = req.body;

  if (typeof type !== "string" || type.trim().length === 0 || type.length > 255) {
    return res.status(400).json({ error: 'Job "type" must be a non-empty string (max 255 chars).' });
  }

  if (payload !== undefined && (typeof payload !== "object" || payload === null || Array.isArray(payload))) {
    return res.status(400).json({ error: 'Job "payload" must be a JSON object.' });
  }

  if (runAt !== undefined && (typeof runAt !== "string" || Number.isNaN(Date.parse(runAt)))) {
    return res.status(400).json({ error: 'Job "runAt" must be a valid timestamp string.' });
  }

  if (max_attempts !== undefined) {
    if (typeof max_attempts !== "number" || !Number.isInteger(max_attempts) || max_attempts < 1 || max_attempts > 10) {
      return res.status(400).json({ error: 'Job "max_attempts" must be an integer between 1 and 10.' });
    }
  }

  try {
    const maxAttemptsVal = max_attempts ?? 3;
    const jobResult = await pool.query<{ id: string; run_at: string }>(
      `INSERT INTO jobs (type, payload, status, run_at, max_attempts)
        VALUES($1, $2, 'PENDING', COALESCE($3::timestamptz, NOW()), $4)
        RETURNING id, run_at   
        `,
      [type, payload ?? {}, runAt ?? null, maxAttemptsVal],
    );

    const job = jobResult.rows[0];
    await logJobEvent(job.id, "API", "SCHEDULED");
    logger.info("SUCCESS: Job scheduled: ", job.id);

    return res.status(202).json({
      message: "Job scheduled for processing",
      jobId: job.id,
      runAt: job.run_at,
    });
  } catch (error) {
    logger.error("Error ingesting job:", error);
    return res.status(500).json({ error: "Failed to queue job" });
  }
});
