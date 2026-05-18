import { pool } from "./db";

let isPatching = false;

export const captureLogs = (sourceName: string) => {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  // Create table if it doesn't exist
  pool.query(`
    CREATE TABLE IF NOT EXISTS system_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source VARCHAR(255) NOT NULL,
      level VARCHAR(50) NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `).catch(() => {});

  const writeLog = (level: string, args: any[]) => {
    if (isPatching) return;
    isPatching = true;
    try {
      const message = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      pool.query(
        `INSERT INTO system_logs (source, level, message) VALUES ($1, $2, $3)`,
        [sourceName, level, message]
      ).catch(() => {});
    } catch (e) {
      // Ignore
    } finally {
      isPatching = false;
    }
  };

  console.log = (...args) => {
    originalLog(...args);
    writeLog('INFO', args);
  };

  console.warn = (...args) => {
    originalWarn(...args);
    writeLog('WARN', args);
  };

  console.error = (...args) => {
    originalError(...args);
    writeLog('ERROR', args);
  };
};
