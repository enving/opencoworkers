export const mockTasks = {
  tasks: [
    {
      id: "TASK-001",
      title: "Implement login feature",
      description: "Add user authentication system",
      status: "pending",
      priority: "high",
      category: "core",
      skill: null,
      created: "2026-01-19",
      verified: false,
      phase: "phase-4-web-ui"
    },
    {
      id: "TASK-002",
      title: "Create dashboard UI",
      description: "Design and implement main dashboard",
      status: "in_progress",
      priority: "medium",
      category: "ui",
      skill: null,
      created: "2026-01-19",
      verified: false,
      phase: "phase-4-web-ui"
    },
    {
      id: "TASK-003",
      title: "Write API documentation",
      description: "Document all REST endpoints",
      status: "completed",
      priority: "low",
      category: "docs",
      skill: null,
      created: "2026-01-18",
      completed: "2026-01-19",
      verified: true,
      verified_by: "test-agent",
      phase: "phase-4-web-ui"
    }
  ],
  meta: {
    version: "1.0.0",
    project: "OpenCode PM Sync"
  }
};

export const mockDaemonStatus = {
  status: "running",
  lastPoll: "2026-01-19T12:00:00.000Z",
  activeSessions: 2,
  recentErrors: [],
  uptime: 3600,
  version: "1.0.0"
};

export const mockAgents = {
  agents: [
    {
      sessionId: "sess_001",
      taskId: "TASK-002",
      skill: "ui",
      startedAt: "2026-01-19T12:00:00.000Z",
      duration: 300000
    }
  ],
  count: 1
};
