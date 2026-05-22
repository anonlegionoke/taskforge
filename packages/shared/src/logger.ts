import { pool } from "./db";

export class SystemLogger {
  constructor(private source: string) {}

  private async writeLog(level: string, args: unknown[]) {
    const message = args.map(a => {
      if (a instanceof Error) {
        return a.stack || a.message;
      }
      return typeof a === 'object' ? JSON.stringify(a) : String(a);
    }).join(' ');
    
    // Output to stdout
    if (level === 'INFO') console.log(`[${this.source}]`, message);
    if (level === 'WARN') console.warn(`[${this.source}]`, message);
    if (level === 'ERROR') console.error(`[${this.source}]`, message);

    // Write to DB
    try {
      await pool.query(
        `INSERT INTO system_logs (source, level, message) VALUES ($1, $2, $3)`,
        [this.source, level, message]
      );
    } catch (e) {
      // Ignore DB write errors for logs
    }
  }

  info(...args: unknown[]) { return this.writeLog('INFO', args); }
  warn(...args: unknown[]) { return this.writeLog('WARN', args); }
  error(...args: unknown[]) { return this.writeLog('ERROR', args); }
}
