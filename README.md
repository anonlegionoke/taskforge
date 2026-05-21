<p align="center">
  <img src="packages/frontend/public/logo.svg" width="120" alt="TaskForge Logo" />
</p>

<h1 align="center">TaskForge</h1>

<p align="center">
  <strong>A production-grade, distributed job scheduler built to demonstrate resilient backend systems architecture and modern observability.</strong>
</p>

## Overview

TaskForge is a distributed job scheduler capable of handling job creation, execution, retries, and failures across horizontally scaled worker nodes. It comes equipped with a **real-time, Kanban-style Observer Dashboard** that visualizes system health, job queues, and live event logs.

TaskForge intentionally implements "Chaos Engineering" features, allowing you to forcefully crash worker nodes to observe the system's robust auto-recovery and idempotency mechanisms in action.

## Key Features

- **Distributed Execution**: Horizontally scalable worker pool leveraging RabbitMQ for message distribution.
- **Resilience & Chaos Engineering**: Built-in "Kill Worker" fault-injection to demonstrate recovery from ungraceful shutdowns. Stale locks are automatically broken and re-queued by the Scheduler.
- **Execution Guarantees**: Guarantees **At-Least-Once** execution with **Strict FIFO** chronological ordering. Uses database-level locks, transactional integrity, and exponential backoff for failing jobs to provide robust internal idempotency guards.
- **Real-Time Observability Dashboard**: A Next.js frontend using `SWR` for high-frequency short-polling, providing a responsive Kanban view of job states.
- **Global Event Console**: Centralized polling-based logs capturing every major event across the API, Scheduler, and Worker nodes.
- **Live System Health**: Continuous pulse-checks on PostgreSQL, RabbitMQ, and Worker nodes with dynamic UI indicators.

## Architecture

TaskForge is decoupled into independent, highly-available services:

- **API Service** (`packages/api`): Exposes REST endpoints to ingest jobs, query statistics, and fetch system logs.
- **Scheduler Service** (`packages/worker/src/scheduler.ts`): Periodically sweeps the database for jobs due for execution, handling stale lock recovery (the "Healer").
- **Worker Service** (`packages/worker/src/consumer.ts`): Consumes tasks from RabbitMQ, executes business logic, maintains a continuous heartbeat, and handles failures.
- **Frontend Observer** (`packages/frontend`): A visually rich Next.js dashboard for monitoring and interacting with the cluster.
- **PostgreSQL**: The absolute source of truth for job states, execution locks, and system logs.
- **RabbitMQ**: The high-throughput message broker handling job distribution.

## Tech Stack

- **Backend**: Node.js, TypeScript, Express
- **Database**: PostgreSQL
- **Message Broker**: RabbitMQ
- **Frontend**: React, Next.js, Tailwind CSS, Lucide Icons, SWR
- **Infrastructure**: Docker & Docker Compose

## Getting Started

### 1. Start the Backend Infrastructure

The backend is fully containerized. Start the database, message broker, API, worker, and scheduler using Docker Compose:

```bash
docker-compose up --build
```

> _Note: The backend API runs on `http://localhost:3000`._

### 2. Start the Frontend Dashboard

In a separate terminal, install dependencies and start the Next.js observer dashboard:

```bash
npm install
npm run dev --workspace=frontend
```

The dashboard will automatically start on [http://localhost:3001](http://localhost:3001) (as port 3000 is utilized by the API).

## Try the "Chaos Demo"

TaskForge was built to be broken. Open the Dashboard and try the following:

1. **Spawn Jobs:** Click **`Spawn 1`** or **`Chaos 50`** to flood the system with tasks. Watch them flow through the Kanban board from _Queued_ to _Running_ to _Completed_.
2. **Kill Worker:** While jobs are processing, click **`Kill Worker`**. This injects a fatal crash into the Node.js worker process.
3. **Observe:** Watch the **Health** indicator instantly flip to `Degraded (Worker: DOWN)`. Manually restart the worker via Docker or rely on restart policies.
4. **Auto-Recovery:** Because the crashed worker stopped sending its heartbeat, the Scheduler will eventually identify its claimed jobs as "stale", break their locks, and gracefully return them to the queue for processing.

## License

MIT
