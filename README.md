# TaskForge - Distributed Job Scheduler

A production-grade, distributed job scheduler built to demonstrate backend and distributed systems architecture.

## Overview

TaskForge is designed to reliably schedule, distribute, and execute jobs across multiple worker nodes. It handles immediate execution, delayed scheduling, and periodic (cron-style) tasks, with robust mechanisms for retries, failure handling, and observability.

## Key Features

- **Flexible Scheduling**: Schedule jobs for immediate, delayed, or recurring execution.
- **Distributed Execution**: Horizontally scalable worker pool to process jobs in parallel.
- **Reliability & Retries**: Built-in exponential backoff for failed jobs and Dead Letter Queue (DLQ) integration.
- **Idempotency**: Strict execution tokens and unique constraints to prevent duplicate processing.
- **Observability**: Job status tracking, execution metrics, queue depth monitoring, and a lightweight dashboard.

## Architecture

At a high level, the system consists of:

- **API Service**: REST API handling job creation, cancellation, and status retrieval.
- **Scheduler Service**: Polls for due jobs and enqueues them, ensuring exactly-once enqueueing via distributed locks.
- **Worker Service**: Consumes jobs from the queue, executes the business logic, and manages retries or failures.
- **Queue (RabbitMQ)**: Robust message broker configured with main, retry, and dead letter queues.
- **Database (PostgreSQL)**: Source of truth for job state, scheduling timestamps, and metadata.

## Tech Stack

- **Backend**: Node.js / TypeScript
- **Database**: PostgreSQL
- **Message Broker**: RabbitMQ
- **Infrastructure**: Docker & Docker Compose
- **Frontend (Dashboard)**: React / Next.js

## Implementation Phases

1. **Phase 1**: Core Architecture & Component Definition.
2. **Phase 2**: Core Implementation (API, DB, Scheduler, Queue, Worker, Retry/DLQ, Idempotency, Scaling).
3. **Phase 3**: Observability (Metrics, Logging).
4. **Phase 4**: Management Dashboard.
5. **Phase 5**: Advanced Features (Distributed Locks, Priorities, Graceful Shutdown).
