import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SyncEngine } from '../../sync/sync-engine.js';
import { WebhookServer } from '../../server/webhook-server.js';
import { TaskFileWatcher } from '../../sync/file-watcher.js';
import { TicketAdapter, UnifiedTicket, AdapterConfig, UnifiedStatus } from '../../types/adapter.js';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';

const mockAdapter: TicketAdapter = {
  name: 'mock',
  async init(_config: AdapterConfig) { },
  async validateConfig() { return true; },
  async pullTasks() { return []; },
  async createTicket(): Promise<UnifiedTicket> {
    return {
      id: 'MOCK-1',
      title: 'Mock',
      status: 'todo',
      priority: 'medium',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  },
  async updateTicket(): Promise<UnifiedTicket> {
    return {
      id: 'MOCK-1',
      title: 'Mock',
      status: 'todo',
      priority: 'medium',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  },
  async getTicket() { return null; },
  async postComment() { },
  mapStatusToNative(status: UnifiedStatus): string { return status; },
  mapStatusFromNative(status: string): UnifiedStatus { return status as UnifiedStatus; }
};

describe('WebhookServer REST API', () => {
  let engine: SyncEngine;
  let server: WebhookServer;
  const testTasksFile = '.agent-config/test-tasks.json';
  const testStateDir = '.agent-config/test-state';
  let authToken: string;

  beforeEach(async () => {
    if (!existsSync('.agent-config')) await fs.mkdir('.agent-config');
    if (!existsSync(testStateDir)) await fs.mkdir(testStateDir);

    const stateFile = `${testStateDir}/daemon-state.json`;
    if (existsSync(stateFile)) await fs.unlink(stateFile);

    const testTasks = {
      $schema: './tasks.schema.json',
      meta: {
        version: '1.0.0',
        last_updated: new Date().toISOString(),
        last_agent: 'test',
        project_phase: 'phase-4-web-ui'
      },
      tasks: [
        {
          id: 'TASK-001',
          title: 'Test Task',
          description: 'Test description',
          status: 'pending' as const,
          priority: 'high' as const,
          category: 'feature',
          created: '2026-01-19'
        },
        {
          id: 'TASK-002',
          title: 'In Progress Task',
          description: 'Another test',
          status: 'in_progress' as const,
          priority: 'medium' as const,
          category: 'feature',
          created: '2026-01-19'
        }
      ],
      features: [],
      rules: {
        review_policy: 'test',
        hallucination_prevention: []
      }
    };

    await fs.writeFile(testTasksFile, JSON.stringify(testTasks, null, 2), 'utf-8');

    const watcher = new TaskFileWatcher(testTasksFile);
    engine = new SyncEngine(watcher, mockAdapter, { tasksFilePath: testTasksFile, stateDir: testStateDir });
    server = new WebhookServer(engine, { port: 3009, enableCORS: true, tasksFilePath: testTasksFile });

    await server.start();

    const loginRes = await fetch('http://localhost:3009/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin' })
    });
    const loginData = await loginRes.json();
    authToken = loginData.token;
  });

  afterEach(async () => {
    await server.stop();
    if (existsSync(testTasksFile)) {
      await fs.unlink(testTasksFile);
    }
    const stateFile = `${testStateDir}/daemon-state.json`;
    if (existsSync(stateFile)) {
      await fs.unlink(stateFile);
    }
    if (existsSync(testStateDir)) {
      await fs.rmdir(testStateDir);
    }
  });

  it('GET /api/tasks should return all tasks', async () => {
    const response = await fetch('http://localhost:3009/api/tasks', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tasks).toHaveLength(2);
    expect(data.total).toBe(2);
    expect(data.meta).toBeDefined();
  });

  it('GET /api/tasks with status filter', async () => {
    const response = await fetch('http://localhost:3009/api/tasks?status=pending', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tasks).toHaveLength(1);
    expect(data.tasks[0].id).toBe('TASK-001');
  });

  it('GET /api/tasks/:id should return single task', async () => {
    const response = await fetch('http://localhost:3009/api/tasks/TASK-001', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.task.id).toBe('TASK-001');
    expect(data.task.title).toBe('Test Task');
  });

  it('GET /api/tasks/:id should return 404 for non-existent task', async () => {
    const response = await fetch('http://localhost:3009/api/tasks/TASK-999', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    expect(response.status).toBe(404);
  });

  it('PATCH /api/tasks/:id should update task', async () => {
    const response = await fetch('http://localhost:3009/api/tasks/TASK-001', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ status: 'completed' })
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.updated).toBe(true);
    expect(data.task.status).toBe('completed');
    expect(data.task.updated).toBeDefined();
  });

  it('PATCH /api/tasks/:id with refinement feedback', async () => {
    const response = await fetch('http://localhost:3009/api/tasks/TASK-001', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        status: 'pending',
        refinement_feedback: 'Needs more detail',
        refinement_loop: 1
      })
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.task.status).toBe('pending');
    expect(data.task.refinement_feedback).toBe('Needs more detail');
    expect(data.task.refinement_loop).toBe(1);
  });

  it('PATCH /api/tasks/:id should return 404 for non-existent task', async () => {
    const response = await fetch('http://localhost:3009/api/tasks/TASK-999', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ status: 'completed' })
    });

    expect(response.status).toBe(404);
  });

  it('GET /api/status should return daemon status', async () => {
    const response = await fetch('http://localhost:3009/api/status');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('running');
    expect(data.uptime).toBeGreaterThan(0);
    expect(data.version).toBe('1.0.0');
  });

  it('GET /api/agents should return active agents', async () => {
    const response = await fetch('http://localhost:3009/api/agents');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.agents).toBeDefined();
    expect(data.count).toBe(0);
  });

  it('GET /health should return health status', async () => {
    const response = await fetch('http://localhost:3009/health');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.engine).toBe('pm-sync-webhook');
  });
});
