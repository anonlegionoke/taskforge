# TaskForge Observer

This is the frontend dashboard for the TaskForge distributed job scheduler. It provides a real-time Kanban-style interface, global system logs, and live health monitoring.

## Overview

For full system architecture, chaos engineering details, and comprehensive documentation, please see the **[Root TaskForge README](../../README.md)**.

## Getting Started

First, ensure the backend API, PostgreSQL, and RabbitMQ are running via Docker Compose (see root README).

Then, start the development server for the dashboard:

```bash
npm install
NEXT_PUBLIC_API_URL=http://localhost:3000 npm run dev --workspace=frontend
```

The application will start on `http://localhost:3001` (or the next available port if 3000 is occupied by the API).

If your backend is running somewhere else, you can configure the API URL:

```bash
NEXT_PUBLIC_API_URL=http://your-api-url:3000 npm run dev --workspace=frontend
```

## Built With

- **Next.js 16** (App Router)
- **Tailwind CSS**
- **SWR** (for high-frequency short-polling)
- **Lucide Icons**
