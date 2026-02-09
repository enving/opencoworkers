# Product Requirements Document (PRD) v4
## OpenCoworkers - Virtual Workforce Automation Platform

**Project Name**: OpenCoworkers (formerly OpenCode PM Sync)
**Version**: 4.0.1 - Rebranding & Architecture
**Last Updated**: 2026-01-30 13:15
**Owner**: Tristan Häfele
**LinkedIn**: https://de.linkedin.com/in/tristan-wilms-812b8011b

---

## 📋 Document History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| v1.0 | 2026-01-16 | Initial PRD - PM Sync Focus | Tristan Häfele |
| ... | ... | ... | ... |
| v3.7.2 | 2026-01-27 | Stability Audit & Architecture Documentation | Antigravity |
| v4.0.0 | 2026-01-30 | **Product Transformation: Docker, Local-First, One-Line Install** | Antigravity |

**🆕 What's New in v4.0.0:**
- ✅ **Dockerized Stack**: Complete architecture moved to 3-container stack (UI, Daemon, Runtime).
- 🛠️ **Local-First**: Default execution happens in local container (no VPS dependency).
- 🔒 **Dynamic Config**: Hardcoded IPs removed; fully configurable via `.env`.
- 🚀 **Product Ready**: Structure prepared for `curl | bash` installation flow.

---

## 1. Executive Summary

### The Big Picture

**OpenCoworkers is the "Operations Center" for teams.**
While tools like OpenClaw focus on personal assistance via chat, OpenCoworkers orchestrates complex, long-running development tasks managed via Kanban boards. It utilizes the **OpenCode** engine as its underlying agent runtime.

**Pitch:** *"OpenClaw organizes your life. OpenCoworkers organizes your firm."*

### The Transformation

```
BEFORE (Hybrid):
Local UI/Daemon -> SSH Tunnel -> VPS Runtime (Complex Setup)

AFTER (Product):
Local Docker Stack (UI + Daemon + Runtime) -> Works out of the box
```

---

## 2. Product Architecture

We support two modes of operation: **Production (Docker)** and **Development (Hybrid)**.

### A. Production (3-Container Docker Stack)
Defined in `docker-compose.yml`. Recommended for deployment and end-users.

| Container | Service | Port | Description |
|-----------|---------|------|-------------|
| **opencode-ui** | Web UI | 7850 | React Dashboard + Nginx Reverse Proxy. |
| **opencode-daemon** | Orchestrator | 7851 | Node.js backend. Manages PM tool sync and Agent state. |
| **opencode-runtime** | Execution | 7852 | Go-based Agent Runtime (OpenCode Server). Sandboxed. |

### B. Development (Hybrid Workflow)
Defined in `HYBRID_SETUP.md`. Recommended for active coding (fast HMR/restart).
- **opencode-runtime**: Runs in **Docker** (to protect your host).
- **opencode-daemon**: Runs **Locally** (`npm run dev:daemon`).
- **opencode-ui**: Runs **Locally** (`npm run dev:ui`).

*Note: The "Brain" and "Body" logic resides in the Daemon. In Hybrid mode, you edit the Daemon/UI code locally, while the Agent executes tools safely inside the Docker container.*

---

## 3. Roadmap & Requirements

### Phase 1: Containerization (✅ COMPLETE)
- [x] Dockerfile for UI (Multi-stage build)
- [x] Dockerfile for Daemon (TypeScript build)
- [x] Dockerfile for Runtime (Install script)
- [x] `docker-compose.yml` for orchestration

### Phase 2: User Experience (🔜 NEXT)
- [ ] **One-Line Install**: `curl -sL opencode.sh | bash` wrapper script.
- [ ] **First-Run Wizard**: UI overlay to configure PM tool/Env credentials on first launch.

### Phase 3: Integrations (PLANNED)
- [ ] **WhatsApp/Telegram Plugin**: Allow creating tickets via chat messages.
- [ ] **Cloudflare Tunnel**: Expose local instance securely for webhooks.

### Phase 4: Enterprise (FUTURE)
- [ ] **Private LLM Gateway**: Connect to local Ollama or Azure OpenAI.
- [ ] **RBAC**: Role-based access control for teams.

---

---

## 2. User Stories (Functional Verification)

These stories guide the Phase 5 development and will be used for manual and automated verification.

| ID | Persona | Story | Acceptance Criteria |
|----|---------|-------|---------------------|
| **US-1** | Developer | **Safe Execution**: I want to run AI agents in a local IDolated Docker container so that my host system is safe. | Agent runs in local `opencode-runtime` container; host system is untouched; connection via local Docker network. |
| **US-2** | PM / Lead | **Local Visibility**: I want to trigger a task from the Web UI and see the agent working in the local container in real-time. | SSE connection stays stable; logs from local container stream to UI; task status updates on board. |
| **US-3** | User | **UI Cohesion**: I want a polished, professional dashboard that handles connection losses gracefully and provides clear guidance. | No "naked" red error messages; skeleton loaders during fetch; clear "Reconnect" action for SSE/API. |
| **US-4** | Developer | **Environment Control**: I want to easily start/stop the entire workforce with a single command. | `docker-compose up/down` manages all services; no zombie processes; clear logs. |
| **US-5** | Developer | **Iterative Improvement**: I want to provide feedback on completed tasks to trigger a refinement loop for the agent. | UI allows "Send back for refinement" with comments; `refinement_loop` increments in tasks.json. |

---

## 3. Vision & Mission

### Vision Statement

**"Every business team should have access to a virtual workforce of AI agents who autonomously handle routine tasks, accessible through the project management tools they already use."**

---

## 4. Technical Requirements

### Phase 0-4: ✅ COMPLETE

### Phase 5: Enterprise, Sandboxing & UX Polish 🔄 IN PROGRESS

- [ ] FR-501: **Docker Sandbox Hardening** (TASK-075) - Ensure runtime container cannot access host network/fs beyond volumes.
- [ ] FR-502: **Docker Compose Service** (TASK-076) - Unified startup script `up.sh`.
- [ ] FR-503: **Local Configuration** (TASK-077) - `.env` based configuration for all containers.
- [ ] FR-504: **UX Polish & Error Resilience** (TASK-081) - Improve layout cohesion and connection recovery.
- [ ] FR-505: **Agent Memory (Context Persistence)** (TASK-078) - Persistence across task boundaries.
- [ ] FR-506: **Multi-User & Auth Skeleton** (TASK-080) - Foundation for RBAC.
- [ ] FR-507: **Iterative Improvement UI** (TASK-084) - Refinement loop triggers from Kanban cards.
- [ ] FR-508: **Skill Registry UI** (TASK-085) - Visibility into available agent capabilities.
- [ ] FR-509: **Visual Admin Config** (TASK-090) - Integration of OpenCode Config Manager (OCCM).
    - **Goal**: Manage Models, Providers, and Skills visually.
    - **Acceptance Test**: Install `firecrawl/cli` skill purely via the new Admin UI (no CLI access).
    - **Reference**: [OpenCode-Config-Manager](https://github.com/icysaintdx/OpenCode-Config-Manager)


### Phase 6: Independent Intelligence & Automation (🚀 NEW)

- [ ] FR-601: **OpenClaw Integration** (FEAT-OPENCLAW-INTEGRATION)
  - **Goal**: Integrate OpenClaw components (Channels, Tools) via git submodule `vendor/openclaw`.
  - **Strategy**: Selective adapter pattern to reuse battle-tested agent capabilities.

- [ ] FR-602: **Agent Memory System** (FEAT-MEMORIES)
  - **Goal**: Persistent vector storage (RAG) for long-term knowledge retention.
  - **Tech**: ChromaDB + MCP Memory Server.

- [ ] FR-603: **Visual Workflow Designer** (FEAT-WORKFLOW-DESIGNER)
  - **Goal**: Drag-and-drop automation builder (n8n-style) for agent pipelines.
  - **Features**: Triggers (Cron, Webhook), Logic (If/Else), Actions (Agent Call, HTTP).

- [ ] FR-604: **Automation Suite** (FEAT-CRON-JOBS, FEAT-HEARTBEATS, FEAT-WEBHOOKS)
  - **Goal**: Enable fully autonomous agent behavior.
  - **Components**: Distributed cron, self-healing heartbeats, and external event triggers.

- [ ] FR-605: **Chat & Collaboration** (FEAT-CHAT, FEAT-MULTI-CHANNEL)
  - **Goal**: Direct interaction via Web Chat, Telegram, Slack, and Discord.
  - **UI**: New "Chat" sidebar item + real-time streaming.

- [ ] FR-606: **Security & Reliability** (FEAT-SECRETS, FEAT-MODEL-FAILOVER)
  - **Goal**: Secure credentials vault and robust model fallback chains.

### Phase 7: Enterprise Expansion (Integrations & Collaboration) 🔜 PLANNED

- [ ] FR-701: **Refinement Workflow** (TASK-174)
  - **Goal**: Full round-trip refinement. Moving a ticket to "Refinement" in PM tools should reset the agent task state.
  - **Strategy**: Extend `RefinementModal.tsx` logic to the backend adapters. Listen for webhook events from PM tools.

- [ ] FR-702: **Collaborative Editing** (TASK-175)
  - **Goal**: Simultaneous human-agent-human editing of documents.
  - **Strategy**: Integrate OnlyOffice/LibreOffice Online Docker container. Use OpenCode Plugin SDK to sync file events to the editor.

- [ ] FR-703: **Skill Customization** (TASK-177)
  - **Goal**: Allow teams to inject "Company Context" (CI/CD rules, Tone of Voice) into standard skills.
  - **Strategy**: Extend `SettingsView.tsx` -> `Skill Explorer` to allow editing. Store `context_files` mapped to skill IDs.

- [ ] FR-704: **Integration Builder** (TASK-178)
  - **Goal**: connect external enterprise systems (CRM, CMS) without coding.
  - **Strategy**: UI Builder that generates valid MCP Server configurations (JSON) and registers them with the OpenCode instance.

- [ ] FR-705: **Server Remote Access** (TASK-180)
  - **Goal**: Configure `opencode.json` for remote access (CORS, 0.0.0.0 binding).
  - **Reference**: https://opencode.ai/docs/reference/configuration#server
  - **Config Target**:
    ```json
    {
      "server": {
        "port": 4096,
        "hostname": "0.0.0.0",
        "mdns": true,
        "cors": ["http://your-ui-domain.com"]
      }
    }
    ```

---

---

## 5. Architecture Deep Dive: The "Brain Transplant" (v4.1+)

As of February 2026, we have transitioned from a simple tool wrapper to a fully autonomous agent architecture.

### 5.1 The "Body" (OpenCoworkers Daemon)
- **Role**: The physical infrastructure.
- **Responsibilities**:
    - Manage Docker containers ("The Skeleton").
    - Sync with PM tools like Linear/Jira ("The Nervous System").
    - Handle user auth and UI socket streams ("The Senses").
    - **New**: Hosting the *Heartbeat* loop (30s pulse).

### 5.2 The "Brain" (OpenClaw Adoption)
We have adopted **OpenClaw's cognitive engine** (ported to `prompt-builder.ts`):
- **Cognitive Loop**:
    1.  **Thinking**: Uses `<think>` blocks for internal Chain of Thought (not visible to user initially, but streamed to UI).
    2.  **Identity**: Enforces `SOUL.md` persona.
    3.  **Skills**: Scans `SKILL.md` files dynamically.
    4.  **Secrets**: Injects secure `RES-SECRETS-MANAGEMENT` variables (`GH_TOKEN`, etc.) only when needed.

### 5.3 The "Hands" (OpenCode Runtime)
- **Role**: The execution layer.
- **Responsibilities**:
    - Sandboxed Docker container.
    - Runs the actual tools (bash, python, node).
    - **Constraint**: The Brain *commands*, the Hands *do*. The Hands never make decisions.

### 5.4 Key Subsystems
- **OCCM (OpenCode Config Manager)**: Visual administration of the agent's tools and models.
- **Heartbeat & Cron**: The automation layer that allows the agent to wake up without human input.
- **Observability**: The `AgentActivityPanel` now visualizes the *Thinking Process* `🧠`, bridging the gap between "Magic" and "Engineering".

## 6. Reference Documentation

Central repository for external documentation links relevant to implementation.

| Topic | URL | Relevance |
|-------|-----|-----------|
| **OpenCode Server** | https://opencode.ai/docs/server | Core Runtime configuration, endpoints, authentication. |
| **Server Config** | https://opencode.ai/docs/reference/configuration | `opencode.json` schema details (CORS, Ports). |
| **Config Manager** | https://github.com/icysaintdx/OpenCode-Config-Manager | Admin UI Reference Implementation (OCCM). |
| **Oh My OpenCode** | https://github.com/code-yeongyu/oh-my-opencode | Default presets for Agents/Skills. |
| **OpenClaw** | https://github.com/Start-OpenClaw/OpenClaw | Source of the "Brain" logic and Skills. |

---
