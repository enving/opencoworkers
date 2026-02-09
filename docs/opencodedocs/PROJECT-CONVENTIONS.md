# OpenCoworkers - Project & Naming Conventions

> **Purpose**: This document defines unique identifiers and conventions for OpenCoworkers to prevent confusion with other projects on the same machine.

---

## 🏷️ Project Identity

| Attribute | Value |
|-----------|-------|
| **Project Codename** | `opencoworkers` |
| **Repository Path** | `/home/enving/Dev/Repositories/opencoworkers` |
| **Docker Network** | `opencoworkers-network` |
| **Container Prefix** | `opencoworkers-` |

---

## 🐳 Docker Container Naming

All containers in this project use the prefix `opencoworkers-`:

| Service | Container Name | Internal Port | Exposed Port |
|---------|----------------|---------------|--------------|
| Web UI | `opencoworkers-ui` | 80 | **7850** |
| Daemon (Orchestrator) | `opencoworkers-daemon` | 3847 | **7851** |
| Agent Runtime | `opencoworkers-runtime` | 4096 | **7852** |
| OnlyOffice (optional) | `opencoworkers-onlyoffice` | 80 | **7853** |

### Port Allocation

The port range `7850-7853` was chosen to be non-standard and avoid conflicts with other local projects.

```
7850  → Web UI (React Dashboard)
7851  → Daemon API (Orchestrator)
7852  → OpenCode Server (Agent Runtime)
7853  → OnlyOffice (Document editing)
```

---

## 🚫 Reserved / Conflicting Ports (DO NOT USE)

The following ports are known to be used by other projects on this machine (e.g., OpenClaw) and **MUST NOT** be used by OpenCoworkers:

| Service | Conflict Port |
|---------|---------------|
| Gateway | 18789 |
| SearXNG | 18080 |
| Postgres | 15432 |
| Worker Dashboard | 13000 |
| Nextcloud | 18081 |
| Mailpit/SMTP | 18025 / 11025 |

---

## 📁 Folder Structure Conventions

```
opencoworkers/
├── .agent-config/           # Runtime configuration (sync.json, tasks.json)
├── docs/                    # Global documentation (conventions, rules)
├── scripts/                 # Utility scripts
├── services/                # Microservices (Docker context roots)
│   ├── daemon/              # Node.js Orchestrator
│   │   ├── docs/            # Daemon architecture
│   │   └── ...
│   ├── web-ui/              # React/Vite Dashboard
│   │   ├── docs/            # UI documentation
│   │   └── ...
│   └── agent-runtime/       # OpenCode Server (Go)
│       ├── data/            # Persistent data (Skills, Input)
│       ├── docs/            # API Reference
│       └── templates/       # Scaffolding templates
├── docker-compose.yml       # Stack definition
├── PRD.md                   # Product Requirements
└── README.md                # Project overview
```

---

## 🔑 Configuration File Locations

| File | Purpose | Project-Specific? |
|------|---------|-------------------|
| `.env` | Environment variables (credentials, ports) | ✅ Yes |
| `.agent-config/sync.json` | PM tool adapter configuration | ✅ Yes |
| `.agent-config/project/tasks.json` | Local task state | ✅ Yes |
| `docker-compose.yml` | Stack definition | ✅ Yes |

---

## 🌐 Network Isolation

The Docker network for this project is explicitly named `opencoworkers-network`:

```yaml
networks:
  opencoworkers-network:
    name: opencoworkers-network
    driver: bridge
```

**Important**: This network is isolated from other Docker projects on the machine. Services communicate internally using their service names (e.g., `http://daemon:3847`).

---

## 🧭 Disambiguation from Other Projects

When working in this repository, use these checks to confirm context:

### Quick Verification
```bash
# Check current directory
pwd
# Expected: /home/enving/Dev/Repositories/opencoworkers

# Check running containers for this project
docker ps --filter "network=opencoworkers-network"
```

### Related Projects (Potential Conflicts)

| Project | Path | Potential Port Conflicts |
|---------|------|--------------------------|
| OpenClaw | `/home/enving/Dev/Repositories/openclaw` | 13000, 15432, 18xxx |
| OpenCode Plugin Test | `/home/enving/Dev/Repositories/opencode_plugins/...` | N/A (no containers) |

**Resolution**: If port conflicts occur, modify the *left side* of the port mapping in `docker-compose.yml`.

---

## 📛 Naming Rules for New Components

### Services
- Format: `opencoworkers-{role}`
- Examples: `opencoworkers-ui`, `opencoworkers-daemon`, `opencoworkers-runtime`

### Docker Volumes (if added)
- Format: `opencoworkers_{purpose}`
- Examples: `opencoworkers_data`, `opencoworkers_skills`

### Environment Variable Prefixes
- **Plane**: `PLANE_*`
- **Jira**: `JIRA_*`
- **Notion**: `NOTION_*`
- **Internal**: `OPENCODE_*`, `DAEMON_*`

---

## ✅ Checklist: "Am I in the right project?"

- [ ] `pwd` shows `/home/enving/Dev/Repositories/opencoworkers`
- [ ] `docker-compose.yml` contains `opencoworkers-network`
- [ ] `package.json` name is `@opencoworkers/root`
- [ ] `PRD.md` header says "OpenCoworkers"

---

**Last Updated**: 2026-02-02
**Maintained by**: Tristan Häfele
