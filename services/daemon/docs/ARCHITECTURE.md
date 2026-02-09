# OpenCoworkers Daemon Architecture

## Overview
The **OpenCoworkers Daemon** is the central orchestrator (The Brain) of the platform. It is a long-running background process designed to ensure 24/7 synchronization between Project Management tools (Plane, Notion, Jira) and the AI Agent Workforce (OpenCode Runtime).

## Core Responsibilities
1. **Continuous Polling**: Periodically fetch tickets from configured PM adapters (Plane, Jira, etc.).
2. **Webhook Intake**: Provide an HTTP endpoint to receive real-time events from PM tools.
3. **Session Orchestration**: Trigger and monitor agent sessions via the OpenCode Server API.
4. **Health Monitoring**: Self-heal and report status of the synchronization engine.

## Components

### 1. Polling Service
- **Interval-based**: Configurable polling frequency (default: 60s).
- **Differential Sync**: Only processes tickets modified since the last poll.
- **Backoff Logic**: Increases interval on consecutive API failures.

### 2. Webhook Listener (HTTP Server)
- **Framework**: Fastify-based implementation.
- **Endpoints**:
    - `POST /webhooks/plane`: Plane webhook support.
    - `GET /health`: Daemon health status.

### 3. Queue Manager
- **Task Queue**: Manage pending agent triggers.
- **Concurrency Control**: Enforce `maxConcurrentAgents` to prevent resource exhaustion.

### 4. Persistence Layer
- **State Registry**: Shared file in `.agent-config/` to store poll timestamps and active session IDs.

## Deployment Model (Docker)
The daemon runs as the `daemon` service in the Docker Compose stack. It connects to the `runtime` service over the internal network.

## Integration with SyncEngine
The `SyncEngine` manages the bidirectional mapping between the PM tool's state and the local `tasks.json`.

### Lifecycle:
1. Daemon starts the `SyncEngine`.
2. `SyncEngine` initializes the selected `Adapter` (e.g., PlaneAdapter).
3. `PollingService` triggers `pullTasks`.
4. Detected changes are written to `tasks.json`.
5. If a task is marked `in_progress`, the `ServerBridge` triggers an OpenCode session.

## Configuration (.env / sync.json)
Configuration is primarily managed via `.env` for the Docker stack and `.agent-config/sync.json` for persistence.
