import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;
    
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'jobs_attempts_check'
        ) THEN
            ALTER TABLE jobs ADD CONSTRAINT jobs_attempts_check CHECK (attempts >= 0);
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'jobs_max_attempts_check'
        ) THEN
            ALTER TABLE jobs ADD CONSTRAINT jobs_max_attempts_check CHECK (max_attempts > 0);
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'jobs_check'
        ) THEN
            ALTER TABLE jobs ADD CONSTRAINT jobs_check CHECK (attempts <= max_attempts);
        END IF;
    END $$;

    DROP INDEX IF EXISTS idx_jobs_status_run_at_created_at;
    DROP INDEX IF EXISTS idx_jobs_status_locked_at;

    CREATE INDEX IF NOT EXISTS idx_jobs_pending_run_at 
    ON jobs(run_at) 
    WHERE status = 'PENDING' OR status = 'PROCESSING';

    CREATE INDEX IF NOT EXISTS idx_jobs_running_locked_at 
    ON jobs(locked_at) 
    WHERE status = 'RUNNING';
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_jobs_running_locked_at;
    DROP INDEX IF EXISTS idx_jobs_pending_run_at;
    
    CREATE INDEX IF NOT EXISTS idx_jobs_status_run_at_created_at ON jobs(status, run_at, created_at);
    CREATE INDEX IF NOT EXISTS idx_jobs_status_locked_at ON jobs(status, locked_at);

    ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_check;
    ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_max_attempts_check;
    ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_attempts_check;

    ALTER TABLE jobs DROP COLUMN IF EXISTS failed_at;
    ALTER TABLE jobs DROP COLUMN IF EXISTS completed_at;
  `);
}
