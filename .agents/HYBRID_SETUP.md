# Hybrid Development Setup

> **Quick Start**: 
> ```bash
> docker compose up -d runtime && OPENCODE_SERVER_URL=http://localhost:7852 npm run dev
> ```

## Architecture

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Web UI     │ ───▶ │   Daemon     │ ───▶ │   Runtime    │
│  (React)     │      │ (SDK Client) │      │(OpenCode Srv)│
│  Port: 7850  │      │  Port: 7851  │      │  Port: 7852  │
└──────────────┘      └──────────────┘      └──────────────┘
     LOCAL                LOCAL               DOCKER
```

| Service | Location | Port | Role |
|---------|----------|------|------|
| **Runtime** | Docker | `7852` | OpenCode Server - AI execution sandbox |
| **Daemon** | Local | `7851` | Orchestrator + SDK Client (`@opencode-ai/sdk`) |
| **Web UI** | Local | `7850` | React Dashboard |

### Daemon = SDK Client

The Daemon uses `createOpencodeClient()` from `@opencode-ai/sdk` to connect to the Runtime. It is a **client** that talks to the Runtime **server**.

```typescript
// services/daemon/server/bridge.ts
import { createOpencodeClient } from '@opencode-ai/sdk'
const client = createOpencodeClient({ baseUrl: process.env.OPENCODE_SERVER_URL })
```

---

## How to Start

```bash
# 1. Start Runtime (Docker)
docker compose up -d runtime

# 2. Start Local Services (with API key)
MISTRAL_API_KEY=your-key OPENCODE_SERVER_URL=http://localhost:7852 npm run dev
```

---

## Provider Configuration

> ⚠️ **Important**: OpenCode uses a specific JSON schema. Incorrect keys will crash the container.

### Correct Config Format (`opencode.json`)

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "mistral": {
      "options": {
        "apiKey": "{env:MISTRAL_API_KEY}"
      }
    }
  },
  "model": "mistral/mistral-medium",
  "mcp": {
    "filesystem": {
      "type": "local",
      "command": "npx",
      "args": ["-y", "@anthropics/mcp-server-filesystem"]
    }
  }
}
```

### Common Mistakes

| ❌ Wrong | ✅ Correct |
|----------|-----------|
| `"providers": {}` | `"provider": {}` |
| `"mcpServers": {}` | `"mcp": {}` |
| `"apiKey": "key"` at root | `"options": { "apiKey": "..." }` nested |

### API Key Storage Options

1. **Environment variable** (recommended): `MISTRAL_API_KEY=xxx`
2. **Via `/connect` command**: Stored in `~/.local/share/opencode/auth.json`
3. **Config file**: `"apiKey": "{env:MISTRAL_API_KEY}"`

---

## Docker Compose

The runtime container needs the config file mounted:

```yaml
runtime:
  volumes:
    - ./.agent-config/opencode.json:/root/.config/opencode/opencode.json:ro
  environment:
    - MISTRAL_API_KEY=${MISTRAL_API_KEY}
```

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Container crash loop | Invalid JSON keys | Use correct schema (`provider`, `mcp`) |
| "No response from AI" | Missing API key | Set `MISTRAL_API_KEY` env var |
| Connection refused | Runtime not running | `docker compose up -d runtime` |

### Check Config
```bash
docker exec opencoworkers-runtime cat /root/.config/opencode/opencode.json
```

---

## SDK Reference

### Create Client
```typescript
import { createOpencodeClient } from "@opencode-ai/sdk"
const client = createOpencodeClient({ baseUrl: "http://localhost:4096" })
```

### Key API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/config` | Get current config |
| `PATCH` | `/config` | Update config |
| `POST` | `/session` | Create session |
| `POST` | `/session/:id/message` | Send message |

### Message with Model Override
```json
{
  "parts": [{ "type": "text", "text": "Hello" }],
  "model": { "providerID": "mistral", "modelID": "mistral-medium" }
}
```

---

## Full Documentation

See [docs/](./docs/) for complete OpenCode reference:
- [`config.mdx`](./docs/config.mdx) - Configuration schema
- [`providers.mdx`](./docs/providers.mdx) - Provider setup
- [`server.mdx`](./docs/server.mdx) - Server API
- [`sdk.mdx`](./docs/sdk.mdx) - SDK usage
