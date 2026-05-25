export type JobStatus = "PENDING" | "PROCESSING" | "RUNNING" | "COMPLETED" | "FAILED";

export type ServiceStatus = "UP" | "DOWN";

export type JsonObject = Record<string, unknown>;

export type JobStats = Record<JobStatus, number>;

export interface JobRecord {
  id: string;
  type: string;
  payload: JsonObject;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  run_at: string;
  locked_at: string | null;
  locked_by: string | null;
  completed_at: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobLogRecord {
  event_type: string;
  error_message: string | null;
  worker_id: string;
  created_at: string;
}

export interface SystemLogRecord {
  id: string;
  source: string;
  level: string;
  message: string;
  created_at: string;
}

export interface SystemHealth {
  api: ServiceStatus;
  db: ServiceStatus;
  rabbitmq: ServiceStatus;
  worker: ServiceStatus;
  scheduler: ServiceStatus;
  timestamp: string;
}

export interface CreateJobRequest {
  type: string;
  payload?: JsonObject;
  runAt?: string;
  max_attempts?: number;
}

export interface CreateJobResponse {
  message: string;
  jobId: string;
  runAt: string;
}

export interface ApiErrorResponse {
  error: string;
}
