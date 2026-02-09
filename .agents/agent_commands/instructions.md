# 🤖 Agent Instructions - OpenCoworkers

> **You are an AI agent working on OpenCoworkers.**
> This document provides everything you need to understand the project and contribute effectively.

---

## 📍 Project Identity

| Attribute | Value |
|-----------|-------|
| **Project** | OpenCoworkers - Virtual Workforce Automation Platform |
| **Repository** | `/home/enving/Dev/Repositories/opencoworkers` |
| **Current Phase** | **Phase 6 - Autonomous Capabilities & OpenClaw Integration** |
| **Docker Network** | `opencoworkers-network` |
| **Port Range** | 7850-7853 |

---

## 🎯 What Is OpenCoworkers?

OpenCoworkers is the **"Operations Center" for teams**. It bridges:
- **Business Teams** → Working in PM tools (Plane, Jira, Notion)
- **AI Agents** → OpenCode-based autonomous execution

**Key Pitch:** *"OpenClaw organizes your life. OpenCoworkers organizes your firm."*

---

## 🏗️ Architecture: The "Brain Transplant"

The project architecture mimics a living organism, explicitly separating cognition from execution:

| Service | Component | Role | Description |
|---------|-----------|------|-------------|
| **Daemon** | `opencoworkers-daemon` | **The Brain** | Hosted in `services/daemon`. Runs the **OpenClaw Cognitive Engine**: <br>• **Thinking**: `<think>` variable reasoning loops.<br>• **Identity**: Enforces `SOUL.md` persona.<br>• **Memory**: Manages vector storage (RAG). |
| **Runtime** | `opencoworkers-runtime` | **The Hands** | Hosted in `services/agent-runtime`. A sandboxed OpenCode server (Go) that *executes* tools. It has no brain; it only obeys the Daemon. |
| **UI** | `opencoworkers-ui` | **The Face** | React/Vite dashboard for users to observe and control the workforce. |

### 🔑 Key Subsystems
1. **OCCM (OpenCode Config Manager)**: Visual administration of the agent's tools, models, and skills.
2. **Heartbeat Loop**: A 30s pulse in the Daemon that ensures agents are alive and processes scheduled tasks.
3. **Observability**: Visualizes the invisible "Thinking" process to the user.

---

## 📁 Repository Structure

```
opencoworkers/
├── .agent-config/           # Runtime state (tasks, backups, logs)
├── .agents/                 # Agent commands & workflows
├── docs/                    # Global documentation
├── services/                # Microservices
│   ├── daemon/              # << THE BRAIN (Node.js)
│   │   └── occm/            # Config Manager Logic
│   ├── web-ui/              # << THE FACE (React/Vite)
│   └── agent-runtime/       # << THE HANDS (OpenCode/Go)
├── scripts/                 # Utility scripts
├── docker-compose.yml       # Production Stack
└── PRD.md                   # Product Requirements (Source of Truth)
```

---

## 📚 Essential Documents

| Document | Purpose |
|----------|---------|
| **`PRD.md`** | **The Source of Truth**. Requirements, roadmap, and user stories. |
| **`.agents/agent_commands/features.json`** | Granular feature tracking and status. |
| **`docs/PROJECT-CONVENTIONS.md`** | Ports, naming, disambiguation. |

---

## ⚠️ Critical Rules

### 1. Safety First
All agent code execution **MUST** happen inside the `opencoworkers-runtime` container. Never execute untrusted code on the host system.

### 2. "No Magic" Principle (We Build the Brain)
We are not just *using* an agent; we are **building** the agent's brain.
- Logic for "Thinking", "Persona", and "Memory" belongs in the **Daemon**.
- The **Runtime** is dumb. Do not put business logic there.

### 3. PRD-Driven Development
Only work on tasks defined in **`PRD.md`**. Update the PRD when completing tasks.

### 4. System Config Protection
**NEVER** manually edit `.agent-config/project/tasks.json`. It is the system DB.

### 5. Development Environment: Hybrid by Default
**ALWAYS** assume the environment is in **Hybrid Mode** (Runtime in Docker, Daemon/UI Local).
- **DO NOT** run `docker compose up` blindly. It will break the local dev environment.
- **DO NOT** try to install tools in the `runtime` container unless checking `Dockerfile`.

---

## 🔧 Development Workflow (Hybrid)

> **CRITICAL**: The system runs in **Hybrid Mode** by default to enable HMR (Hot Module Replacement).
> **DO NOT** run `docker compose up` unless you are verifying the full production stack.

```bash
# 1. Start safely isolated Runtime
docker compose up -d runtime vector-db

# 2. Run Daemon (The Brain) locally
cd services/daemon && npm run dev

# 3. Run UI (The Face) locally
cd services/web-ui && npm run dev
```

Use `docker compose up --build` **only** for final system verification.

---

## 🎯 Current Focus (Phase 6)

We have successfully completed the Admin Config (OCCM). Now we are building **Autonomy**.

### Phase 5: Polish & Config (Mostly Complete)
- [x] **Visual Admin Config (OCCM)**: Full management of Models, Providers, Skills.
- [x] **Config Backup & Restore**: Robust versioning of agent state.
- [x] **External Import**: Import configs from Cursor/Claude.
### Phase 6: Autonomous Capabilities & OpenClaw Integration (In Progress)
#### Completed
- [x] **OpenClaw Prompt Engine** `(FEAT-OPENCLAW-PROMPT-ENGINE)`: Ported standard prompt builder & skill scanning.
- [x] **Visual Observability** `(FEAT-VISUAL-AUTONOMY)`: Agent Activity Panel & Thinking Loop Visualization.
- [x] **Secrets Research** `(RES-SECRETS-MANAGEMENT)`: Setup `.env` loading implementation (Research complete).
- [x] **OpenClaw Integration Research** `(RES-OPENCLAW-INTEGRATION)`: Analysis of reusable components.
- [x] **Default Config Presets** `(FEAT-PREPOPULATE)`: Pre-populated skills and agent groups.

#### Planned (See `features.json` for details)
> **⚠ WARNING**: Do not mark tasks as completed unless you have verified the CODE exists. `features.json` is the source of truth, but verify it!

- [ ] **Chat Interface** `(FEAT-CHAT)`: Sidebar chat for direct agent interaction. [TODO]
- [ ] **Agent Memory (RAG)** `(FEAT-MEMORIES)`: Persistent knowledge via ChromaDB. [IN PROGRESS]
- [ ] **Cognitive Core** `(FEAT-OPENCLAW-THINKING)`: `<think>` loops and Persona/Soul (SOUL.md).
- [ ] **Visual Workflow Designer** `(FEAT-WORKFLOW-DESIGNER)`: Visual automation builder (n8n-style).
- [ ] **Automation** `(FEAT-CRON-JOBS)`: Cron Jobs and Webhooks.
- [ ] **Heartbeat System** `(FEAT-HEARTBEATS)`: Self-healing loop & health monitoring.
- [ ] **Secrets Vault** `(FEAT-SECRETS)`: Secure storage for API keys/tokens.
- [ ] **Multi-Channel** `(FEAT-WEBHOOKS)`: Telegram, Slack, Discord integration.
- [ ] **Session & Presence**: User presence and typing indicators.
- [ ] **Model Failover**: Automatic fallback for reliability.

---

## 📝 Session Handoff Protocol

1. **Update `features.json`**: Ensure all metadata (status, verification) is accurate.
2. **Run `/checkpoint`**: Commit changes with a standardized message.
3. **Explicit Context Handoff**:
   - If you leave the system in **Hybrid Mode** (servers running), **YOU MUST** mention this in your final message.
   - Example: "System is running in Hybrid Mode. Daemon limits are set to X."
4. **State IS the Handoff**: The repo state (PRD, features.json) is the only context the next agent needs.

---

## ✅ Quick Verification Checklist

- [ ] `pwd` → `/home/enving/Dev/Repositories/opencoworkers`
- [ ] **Hybrid Mode**: Runtime in Docker, Daemon/UI local?
- [ ] **Features**: `features.json` reflects reality?

---

**Document Version**: 2.0.0 (Brain Transplant Edition)
**Last Updated**: 2026-02-05
**Author**: Antigravity
