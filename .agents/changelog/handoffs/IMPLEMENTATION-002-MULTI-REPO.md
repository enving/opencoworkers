# Implementation Guide: Multi-Repository Support

## 🎯 Goal
Implement GitHub Issues pattern where each Jira ticket maps to a specific Git repository, enabling one Jira board to manage work across multiple codebases.

---

## 📐 Architecture Pattern (GitHub Issues Analogy)

### How GitHub Issues Work:
```
GitHub Organization: "MyCompany"
├─ Repository: "frontend"
│  └─ Issues: #1, #2, #3 (work on frontend repo)
├─ Repository: "backend"
│  └─ Issues: #10, #11 (work on backend repo)
└─ Repository: "infrastructure"
   └─ Issues: #5, #6 (work on infra repo)

Each issue belongs to EXACTLY ONE repository.
When agent works on Issue #2, it operates in "frontend" repo context.
```

### Our Implementation (Jira → Multiple Git Repos):
```
Jira Board: "Company Kanban"
├─ Jira Project: "KAN" (Kanban App)
│  ├─ KAN-1, KAN-2 → Git Repo: /home/user/repos/kanban-app
│  └─ Agent works in /home/user/repos/kanban-app
├─ Jira Project: "INFRA" (Infrastructure)
│  ├─ INFRA-5, INFRA-6 → Git Repo: /home/user/repos/infrastructure
│  └─ Agent works in /home/user/repos/infrastructure
└─ Jira Project: "WEB" (Website)
   ├─ WEB-10 → Git Repo: /home/user/repos/website
   └─ Agent works in /home/user/repos/website

Mapping defined in sync.json configuration.
```

---

## 🛠️ Implementation Steps

### Step 1: Update Configuration Schema

**File**: `sync.json` (example config)

```json
{
  "adapter": "jira",
  "sync_mode": "manual",
  "conflict_resolution": "tasks_json_wins",
  "jira": {
    "baseUrl": "https://yourcompany.atlassian.net",
    "jql": "labels = opencode-sync",
    "projects": {
      "KAN": {
        "repository": "/home/enving/Dev/Repositories/kanban-app",
        "default_branch": "main",
        "description": "Kanban Application"
      },
      "INFRA": {
        "repository": "/home/enving/Dev/Repositories/infrastructure",
        "default_branch": "main",
        "description": "Infrastructure & DevOps"
      },
      "WEB": {
        "repository": "/home/enving/Dev/Repositories/website",
        "default_branch": "main",
        "description": "Company Website"
      }
    }
  }
}
```

**Alternative: Label-Based Mapping** (if you don't want to use Jira Projects):
```json
{
  "jira": {
    "repository_mapping": {
      "mode": "label",
      "mappings": {
        "repo:frontend": "/home/user/repos/frontend",
        "repo:backend": "/home/user/repos/backend",
        "repo:infra": "/home/user/repos/infrastructure"
      }
    }
  }
}
```

---

### Step 2: Update Type Definitions

**File**: `src/types/config.ts`

```typescript
export interface JiraProjectConfig {
  repository: string;           // Absolute path to git repository
  default_branch: string;        // Usually "main" or "master"
  description?: string;          // Human-readable description
}

export interface JiraConfig {
  baseUrl: string;
  jql?: string;
  email?: string;
  apiToken?: string;
  projects?: Record<string, JiraProjectConfig>; // ← NEW
}

export interface AdapterConfig {
  adapter: 'jira' | 'plane' | 'notion';
  jira?: JiraConfig;
  plane?: PlaneConfig;
  notion?: NotionConfig;
  sync_mode: 'manual' | 'auto';
  conflict_resolution: 'tasks_json_wins' | 'remote_wins';
}
```

---

### Step 3: Extract Project from Jira Ticket

**File**: `src/adapters/jira/jira-adapter.ts`

```typescript
private mapResponseToUnified(data: any): UnifiedTicket {
  const labels = data.fields.labels || [];

  // Extract Jira Project Key from ticket ID (e.g., "KAN-25" → "KAN")
  const projectKey = data.key.split('-')[0];

  return {
    id: data.key,
    title: data.fields.summary,
    description: data.fields.description?.content?.[0]?.content?.[0]?.text || '',
    status: this.mapStatusFromNative(data.fields.status.name),
    priority: ...,
    skill: this.extractSkill(labels),
    workflow_type: this.extractWorkflowType(labels),
    project_key: projectKey, // ← NEW
    createdAt: new Date(data.fields.created),
    updatedAt: new Date(data.fields.updated),
    url: `${this.config!.baseUrl}/browse/${data.key}`,
    nativeData: data
  };
}
```

**File**: `src/types/adapter.ts`

```typescript
export interface UnifiedTicket {
  id: string;
  title: string;
  description?: string;
  status: UnifiedStatus;
  priority: UnifiedPriority;
  skill?: string;
  workflow_type?: 'automatic-review' | 'manual';
  project_key?: string; // ← NEW (Jira Project Key like "KAN", "INFRA")
  url?: string;
  assignee?: string;
  createdAt: Date;
  updatedAt: Date;
  nativeData?: any;
}
```

---

### Step 4: Propagate Repository Path to tasks.json

**File**: `src/types/tasks.ts`

```typescript
export const TaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked']),
  skill: z.string().optional(),
  workflow_type: z.enum(['automatic-review', 'manual']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  category: z.string().optional(),
  repository: z.string().optional(), // ← NEW (absolute path to git repo)
  project_key: z.string().optional(), // ← NEW (Jira Project Key)
  created: z.string(),
  updated: z.string().optional(),
  verified: z.boolean().optional(),
  verified_by: z.string().optional(),
  verified_date: z.string().optional(),
  requires_review: z.boolean().optional(),
  reviewed_by: z.string().optional(),
  external_refs: z.array(z.string()).optional(),
  last_synced_at: z.string().optional(),
});
```

---

### Step 5: Resolve Repository Path in SyncEngine

**File**: `src/sync/sync-engine.ts`

```typescript
async pull(dryRun = false): Promise<void> {
  const remoteTickets = await this.adapter.pullTasks();
  const tasksJson = this.loadTasksJson();

  for (const ticket of remoteTickets) {
    // Resolve repository path from config
    const repository = this.resolveRepository(ticket.project_key);

    if (!repository) {
      console.warn(`[SyncEngine] No repository mapping for project ${ticket.project_key}. Skipping ticket ${ticket.id}.`);
      continue;
    }

    const localTask = tasksJson.tasks.find(t =>
      t.external_refs?.includes(`${this.adapter.name}:${ticket.id}`)
    );

    if (localTask) {
      // Update existing task
      localTask.repository = repository; // ← NEW
      localTask.project_key = ticket.project_key; // ← NEW
      // ... rest of update logic
    } else {
      // Create new task
      const newTask: Task = {
        id: newId,
        title: ticket.title,
        description: ticket.description,
        status: this.mapUnifiedToTaskStatus(ticket.status),
        priority: ticket.priority,
        skill: ticket.skill,
        workflow_type: ticket.workflow_type,
        repository: repository, // ← NEW
        project_key: ticket.project_key, // ← NEW
        created: ticket.createdAt.toISOString(),
        updated: ticket.updatedAt.toISOString(),
        external_refs: [`${this.adapter.name}:${ticket.id}`]
      };

      tasksJson.tasks.push(newTask);
    }
  }

  this.saveTasksJson(tasksJson);
}

private resolveRepository(projectKey?: string): string | undefined {
  if (!projectKey) return undefined;

  const config = this.config as AdapterConfig;
  if (config.jira?.projects?.[projectKey]) {
    return config.jira.projects[projectKey].repository;
  }

  console.warn(`[SyncEngine] No repository mapping found for project ${projectKey}`);
  return undefined;
}
```

---

## 🤖 Agent Workflow with Multi-Repository

### Scenario: Agent Picks Up Task from Different Repo

**tasks.json**:
```json
{
  "id": "TASK-050",
  "title": "Update pricing page",
  "description": "Modernize the pricing section",
  "status": "pending",
  "project_key": "WEB",
  "repository": "/home/user/repos/website",
  "external_refs": ["jira:WEB-15"]
}
```

**Agent Process**:
1. Agent reads tasks.json
2. Sees `repository: "/home/user/repos/website"`
3. Changes working directory: `cd /home/user/repos/website`
4. Implements changes
5. Commits in that repository: `git commit -m "feat: update pricing page"`
6. Updates tasks.json status
7. SyncEngine pushes update back to Jira WEB-15

### Handling Multiple Concurrent Tasks (Different Repos):

**Scenario**: Agent A works on TASK-050 (WEB repo), Agent B works on TASK-051 (INFRA repo)

✅ **SAFE** - They are in different repositories, no git conflicts!

**Scenario**: Agent A works on TASK-050 (WEB repo), Agent B works on TASK-052 (WEB repo, different files)

✅ **SAFE** - Same repo, but different files (linear commits, no worktrees needed)

**Scenario**: Agent A works on TASK-050 (WEB repo), Agent B works on TASK-053 (WEB repo, SAME files)

⚠️ **CONFLICT RISK** - Process sequentially to avoid local conflicts

---

## ✅ Testing Multi-Repository Support

### Test Case 1: Map Two Jira Projects to Different Repos

1. **Setup sync.json**:
   ```json
   {
     "jira": {
       "projects": {
         "KAN": { "repository": "/path/to/kanban-app" },
         "WEB": { "repository": "/path/to/website" }
       }
     }
   }
   ```

2. **Create Jira Tickets**:
   - KAN-50: "Add dashboard widget"
   - WEB-10: "Update homepage hero"

3. **Pull Tasks**:
   ```bash
   node dist/cli/index.js sync pull
   ```

4. **Verify tasks.json**:
   ```bash
   cat .agent-config/tasks.json | jq '.tasks[] | select(.project_key == "KAN")'
   # Should show repository: "/path/to/kanban-app"

   cat .agent-config/tasks.json | jq '.tasks[] | select(.project_key == "WEB")'
   # Should show repository: "/path/to/website"
   ```

5. **Agent Execution**:
   - Agent should spawn in correct repository based on `repository` field

---

## 🔀 Decision Tree: Which Repository?

```
┌─────────────────────────────────────────────┐
│ Jira Ticket Pulled                          │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│ Extract Project Key (e.g., "KAN-25" → "KAN")│
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│ Lookup config.jira.projects["KAN"]          │
└────────────────┬────────────────────────────┘
                 │
                 ├─── Found? → Use repository path
                 │
                 └─── Not Found? → Log warning, skip task
```

---

## 🚧 Future Enhancements (Phase 3+)

### 1. Global Tasks (No Specific Repository)
Some tasks might be "meta" tasks (e.g., "Update PRD", "Create handoff docs")
- **Solution**: Allow `repository: "global"` or `repository: null`
- Agent picks up in current working directory

### 2. Cross-Repository Tasks
Task requires changes in BOTH frontend and backend
- **Solution**: Parent task with subtasks, each in different repos
- Orchestration layer handles handoff between repos

### 3. Repository Auto-Detection
If no project mapping exists, try to infer from ticket content
- **Example**: Ticket mentions "React component" → likely frontend repo
- Use ML/heuristics to suggest repository

---

## 🔗 Related Documentation

- **PRD**: `docs/PRD-v3-VirtualWorkforce.md` Phase 1.5 (FR-107)
- **Config Schema**: `src/types/config.ts`
- **TASK-037**: Implementation task in `.agent-config/tasks.json`
- **Reference**: GitHub Issues → Repository relationship (1:1 mapping)

---

## 📊 Comparison: GitHub vs Our Implementation

| Concept | GitHub Issues | Our Jira Implementation |
|---------|---------------|-------------------------|
| **Issue Container** | GitHub Repository | Jira Project |
| **Issue ID** | `owner/repo#123` | `PROJECT-123` |
| **Mapping** | Implicit (issue in repo) | Explicit (config.jira.projects) |
| **Agent Context** | Clone repo from GitHub | Work in local repo path |
| **Multi-Repo** | Multiple repo instances | One Jira board, multiple repos |

---

**Authored-By**: Tristan Häfele
**Date**: 2026-01-18
**Inspired by**: GitHub Issues architecture, Multi-repository CI/CD patterns
