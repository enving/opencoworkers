# Services

This directory contains the microservices that make up the OpenCode application.

## 1. Daemon (`services/daemon`)
- **Role**: The central orchestration backend.
- **Port**: 3847
- **Tech**: Node.js, Fastify, TypeScript.
- **Responsibilities**:
  - Syncing with Jira/Plane.
  - Managing Agents (running on OpenCode Server).
  - Webhooks & Events.

## 2. Web UI (`services/web-ui`)
- **Role**: The frontend dashboard for users.
- **Port**: 5173
- **Tech**: React, Vite, Tailwind.
- **Responsibilities**:
  - Task Board (Kanban).
  - Agent Monitoring.
  - Configuration.

## 3. OpenCode Runtime (`services/agent-runtime`)
- **Role**: The runtime environment for AI Agents.
- **Location**: Local Container (Port 4096) or Remote VPS.
- **Docker**: Included in the stack.
- **Installation**: Installs via `opencode.ai` script inside the container.
