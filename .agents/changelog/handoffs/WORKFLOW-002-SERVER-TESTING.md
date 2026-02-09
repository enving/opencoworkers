# WORKFLOW-002: Server-Side Workflow Testing

This document describes how to perform end-to-end workflow tests using a live OpenCode server.

## 🏗️ Setup

To test the server integration, you need a running OpenCode server instance.

```bash
# Start the server in a separate terminal
opencode serve --port 4096
```

## 🚀 Execution

### 1. Manual Trigger via CLI Tool
The plugin provides a custom tool to verify server connectivity:

```
/server-test --title "My Test Session"
```

This will:
1. Connect to the server at `http://127.0.0.1:4096`.
2. Create a new session.
3. Dispatch a prompt to the `git` agent.

### 2. Automatic Trigger via Jira/tasks.json
When `server.autoTrigger` is enabled in `.agent-config/sync.json`, moving a task to `in_progress` with an assigned `skill` will automatically start an agent session.

**Test Case: Automatic Skill Execution**
1. Sync a task from Jira with a skill label (e.g., `skill:pptx`).
2. Move the task to `in_progress` in Jira.
3. Run `/sync-pull` in OpenCode.
4. Verify in the OpenCode server logs (or UI) that a session was created for the `pptx` agent.

## 🧪 Integration Test Script
A dedicated integration test script is available at `scripts/test-server-workflow.ts`.

```bash
# Run the integration test (assumes server on 4099)
opencode serve --port 4099 & sleep 5 && npx tsx scripts/test-server-workflow.ts && kill $!
```

## 📊 Verification Points
- [ ] Session is created on the server.
- [ ] Correct agent is selected based on task `skill`.
- [ ] Audit trail (`.agent-config/logs/audit-trail.json`) contains `trigger-agent` entries.
- [ ] UI Activity Monitor reflects the server session status.
