import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

export const transaction = false;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
        CREATE TYPE job_status AS ENUM ('PENDING', 'PROCESSING', 'RUNNING', 'COMPLETED', 'FAILED');
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = 'job_status'::regtype
          AND enumlabel = 'PROCESSING'
      ) THEN
        ALTER TYPE job_status ADD VALUE 'PROCESSING';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = 'job_status'::regtype
          AND enumlabel = 'RUNNING'
      ) THEN
        ALTER TYPE job_status ADD VALUE 'RUNNING';
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type VARCHAR(255) NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      status job_status NOT NULL DEFAULT 'PENDING',
      attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
      max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
      CHECK (attempts <= max_attempts),
      run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      locked_at TIMESTAMPTZ,
      locked_by VARCHAR(255),
      completed_at TIMESTAMPTZ,
      failed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS job_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      worker_id VARCHAR(255) NOT NULL,
      event_type VARCHAR(100) NOT NULL,
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS system_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source VARCHAR(255) NOT NULL,
      level VARCHAR(50) NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );


    CREATE INDEX IF NOT EXISTS idx_jobs_status_run_at_created_at ON jobs(status, run_at, created_at);
    CREATE INDEX IF NOT EXISTS idx_jobs_status_locked_at ON jobs(status, locked_at);
    CREATE INDEX IF NOT EXISTS idx_job_logs_job_id ON job_logs(job_id);
    CREATE INDEX IF NOT EXISTS idx_system_logs_source_level_created ON system_logs(source, level, created_at DESC);

    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $trigger$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $trigger$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS jobs_set_updated_at ON jobs;
    CREATE TRIGGER jobs_set_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TRIGGER IF EXISTS jobs_set_updated_at ON jobs;
    DROP FUNCTION IF EXISTS set_updated_at();
    DROP TABLE IF EXISTS system_logs;
    DROP TABLE IF EXISTS job_logs;
    DROP TABLE IF EXISTS jobs;
    DROP TYPE IF EXISTS job_status;
  `);
}
