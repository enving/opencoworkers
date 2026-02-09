# Implementation Guide: Automatic Review Workflow

## 🎯 Goal
Implement Auto-Claude-style autonomous task execution triggered by `automatic-review` label in Jira tickets.

---

## 📐 Architecture Pattern (Inspired by Auto-Claude + Claude Code GitHub App)

### Reference Implementations:
1. **Auto-Claude** (GitHub Issues):
   - Watches GitHub Issues for new/updated issues
   - Detects agent mentions or labels
   - Spawns autonomous agent in repository context
   - Agent commits changes back to repo
   - Updates GitHub Issue with progress

2. **Claude Code GitHub App**:
   - @claude mention in GitHub triggers Claude
   - Claude has repository context
   - Responds with code suggestions/implementations

### Our Implementation (Jira + OpenCode):
```
┌─────────────────────────────────────────────────────────────┐
│  JIRA TICKET                                                │
│  Labels: ["opencode-sync", "automatic-review"]             │
│  Status: "In Progress"                                      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ (1) Plugin Pull Command
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  JiraAdapter.pullTasks()                                    │
│  - Detect "automatic-review" label                          │
│  - Extract workflow_type field                              │
│  - Map to UnifiedTicket                                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ (2) Sync to Local
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  SyncEngine.pull()                                          │
│  - Write to tasks.json with workflow_type                   │
│  - Trigger agent execution (if configured)                  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ (3) Agent Execution
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  OpenCode Agent Workspace                                   │
│  1. Reads task from tasks.json                              │
│  2. Implements feature/fix                                  │
│  3. Runs self-review (code quality, tests, requirements)    │
│  4. Fixes issues found                                      │
│  5. Updates tasks.json (status = completed)                 │
│  6. Executes /checkpoint (git commit + cleanup)             │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ (4) Push Back to Jira
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  SyncEngine.push()                                          │
│  - Update Jira ticket status → "Done"                       │
│  - Post comment with commit SHA                             │
│  - Attach deliverables (if any)                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Implementation Steps

### Step 1: Detect `automatic-review` Label

**File**: `src/adapters/jira/jira-adapter.ts`

**Changes Needed**:
```typescript
// Add new method to extract workflow type
private extractWorkflowType(labels: string[]): string | undefined {
  if (labels.includes('automatic-review')) {
    return 'automatic-review';
  }
  return undefined;
}

// Update mapResponseToUnified to include workflow_type
private mapResponseToUnified(data: any): UnifiedTicket {
  const labels = data.fields.labels || [];
  return {
    id: data.key,
    title: data.fields.summary,
    description: data.fields.description?.content?.[0]?.content?.[0]?.text || '',
    status: this.mapStatusFromNative(data.fields.status.name),
    priority: ...,
    skill: this.extractSkill(labels),
    workflow_type: this.extractWorkflowType(labels), // ← NEW
    createdAt: new Date(data.fields.created),
    updatedAt: new Date(data.fields.updated),
    url: `${this.config!.baseUrl}/browse/${data.key}`,
    nativeData: data
  };
}
```

---

### Step 2: Update Type Definitions

**File**: `src/types/adapter.ts`

```typescript
export interface UnifiedTicket {
  id: string;
  title: string;
  description?: string;
  status: UnifiedStatus;
  priority: UnifiedPriority;
  skill?: string;
  workflow_type?: 'automatic-review' | 'manual'; // ← NEW
  url?: string;
  assignee?: string;
  createdAt: Date;
  updatedAt: Date;
  nativeData?: any;
}
```

**File**: `src/types/tasks.ts`

```typescript
export const TaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked']),
  skill: z.string().optional(),
  workflow_type: z.enum(['automatic-review', 'manual']).optional(), // ← NEW
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  // ... rest of schema
});
```

---

### Step 3: Propagate to tasks.json

**File**: `src/sync/sync-engine.ts`

**Update pull() method**:
```typescript
async pull(dryRun = false): Promise<void> {
  // ... existing code

  for (const ticket of remoteTickets) {
    const localTask = tasksJson.tasks.find(t =>
      t.external_refs?.includes(`${this.adapter.name}:${ticket.id}`)
    );

    if (localTask) {
      // Update existing task
      if (remoteChanged && !localChanged) {
        localTask.title = ticket.title;
        localTask.description = ticket.description;
        localTask.status = this.mapUnifiedToTaskStatus(ticket.status);
        localTask.priority = ticket.priority;
        localTask.skill = ticket.skill;
        localTask.workflow_type = ticket.workflow_type; // ← NEW
        // ... rest
      }
    } else {
      // Create new task
      const newTask: Task = {
        id: newId,
        title: ticket.title,
        description: ticket.description,
        status: this.mapUnifiedToTaskStatus(ticket.status),
        priority: ticket.priority,
        skill: ticket.skill,
        workflow_type: ticket.workflow_type, // ← NEW
        // ... rest
      };

      tasksJson.tasks.push(newTask);

      // ← NEW: Trigger automatic execution if workflow_type is automatic-review
      if (ticket.workflow_type === 'automatic-review' && ticket.status === 'in_progress') {
        console.log(`[AutoReview] Task ${newTask.id} queued for automatic execution`);
        // TODO: Trigger agent execution (Phase 2 - see Step 4)
      }
    }
  }

  // ... save tasks.json
}
```

---

### Step 4: Trigger Agent Execution (Future Implementation)

**Concept** (not implemented in Phase 1.5):

```typescript
// Future: src/orchestration/auto-executor.ts

export class AutoExecutor {
  async executeTask(taskId: string): Promise<void> {
    console.log(`[AutoExecutor] Starting automatic execution for ${taskId}`);

    // 1. Spawn OpenCode agent in correct repository
    // 2. Pass task description as context
    // 3. Agent implements solution
    // 4. Agent runs self-review
    // 5. Agent commits via /checkpoint
    // 6. Update tasks.json status to 'completed'
    // 7. Trigger SyncEngine.push() to update Jira
  }
}
```

**For Phase 1.5**: Agent execution is **manual** via OpenCode TUI.
- User runs: `opencode` in terminal
- Agent sees tasks.json with `workflow_type: "automatic-review"`
- Agent follows WORKFLOW-001-AUTOMATIC-REVIEW.md handoff

**For Phase 2+**: Implement automatic agent spawning via:
- Background daemon process
- OpenCode API integration
- Task queue system

---

## ✅ Testing the Implementation

### Manual Test (Phase 1.5):

1. **Create Jira Ticket**:
   - Project: KAN
   - Labels: `opencode-sync`, `automatic-review`
   - Status: "In Progress"
   - Title: "Add login validation"

2. **Pull Ticket**:
   ```bash
   cd /home/enving/Dev/Repositories/opencode_dev
   node dist/cli/index.js sync pull
   ```

3. **Verify tasks.json**:
   ```bash
   cat .agent-config/tasks.json | grep -A20 "login validation"
   ```

   Expected output:
   ```json
   {
     "id": "TASK-XXX",
     "title": "Add login validation",
     "workflow_type": "automatic-review",
     "status": "in_progress",
     ...
   }
   ```

4. **Agent Execution**:
   ```bash
   opencode
   ```

   Agent should:
   - Detect `workflow_type: "automatic-review"`
   - Follow WORKFLOW-001-AUTOMATIC-REVIEW.md
   - Implement → Review → Complete → /checkpoint

5. **Push Back**:
   ```bash
   node dist/cli/index.js sync push
   ```

   Jira ticket should:
   - Status → "Done"
   - Comment with commit SHA
   - Closed by agent

---

## 🔄 Comparison with Auto-Claude Architecture

| Feature | Auto-Claude (GitHub) | Our Implementation (Jira) |
|---------|---------------------|---------------------------|
| **Trigger** | New GitHub Issue or @mention | `automatic-review` label + "In Progress" |
| **Detection** | GitHub API webhook | Jira API polling (pull command) |
| **Agent Spawn** | Automatic background process | Manual (Phase 1.5), Automatic (Phase 2+) |
| **Repository Context** | GitHub repo URL | Jira Project → Git Repo mapping (FR-107) |
| **Commit** | GitHub API commits | Local git commits via /checkpoint |
| **Update Issue** | GitHub API comment | Jira API postComment + status transition |
| **Deliverables** | GitHub PR or direct commit | Jira attachment or commit reference |

---

## 📚 Related Documentation

- **Workflow Spec**: `docs/handoffs/WORKFLOW-001-AUTOMATIC-REVIEW.md`
- **Policy**: `docs/handoffs/POLICY-001-LINEAR-DEV.md`
- **PRD Phase 1.5**: `docs/PRD-v3-VirtualWorkforce.md` (FR-105, FR-106, FR-107)
- **TASK-034**: Implementation task in `.agent-config/tasks.json`

---

## 🚀 Next Steps After Implementation

1. **Test with real Jira tickets** (TASK-026, TASK-027, TASK-028)
2. **Implement Multi-Repository Support** (TASK-037, FR-107)
3. **Add automatic agent spawning** (Phase 2: Background daemon)
4. **Webhook support** (Phase 3: Real-time triggers)

---

**Authored-By**: Tristan Häfele
**Date**: 2026-01-18
**Inspired by**: Auto-Claude, Claude Code GitHub App, Claude Cowork
