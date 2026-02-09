import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EventEmitter } from 'events';

jest.unstable_mockModule('fs/promises', () => ({
  writeFile: jest.fn(),
  appendFile: jest.fn(),
  readFile: jest.fn(),
  mkdir: jest.fn(),
  access: jest.fn(),
}));

jest.unstable_mockModule('../../sync/file-watcher.js', () => ({
  TaskFileWatcher: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    suspend: jest.fn(),
    resume: jest.fn(),
    getTasks: jest.fn(),
  })),
}));

const fs: any = await import('fs/promises');
const { TaskFileWatcher }: any = await import('../../sync/file-watcher.js');
const { SyncEngine }: any = await import('../../sync/sync-engine.js');

describe('SyncEngine Orchestration', () => {
  let engine: any;
  let mockWatcher: any;
  let mockAdapter: any;
  let watcherEmitter: EventEmitter;

  beforeEach(() => {
    watcherEmitter = new EventEmitter();
    mockWatcher = {
      start: jest.fn().mockResolvedValue(undefined as any),
      stop: jest.fn().mockResolvedValue(undefined as any),
      suspend: jest.fn(),
      resume: jest.fn(),
      on: jest.fn().mockImplementation((event: any, listener: any) => {
        watcherEmitter.on(event, listener);
      }),
      getTasks: jest.fn().mockResolvedValue({
        meta: { last_updated: new Date().toISOString() },
        tasks: [],
        features: []
      } as any)
    };

    mockAdapter = {
      name: 'mock-adapter',
      init: jest.fn().mockResolvedValue(undefined as any) as any,
      validateConfig: jest.fn().mockResolvedValue(true as any) as any,
      createTicket: jest.fn(),
      updateTicket: jest.fn(),
      getTicket: jest.fn(),
      pullTasks: jest.fn().mockResolvedValue([] as any) as any,
      postComment: jest.fn().mockResolvedValue(undefined as any) as any,
      mapStatusToNative: jest.fn(),
      mapStatusFromNative: jest.fn()
    } as any;

    engine = new SyncEngine(mockWatcher, mockAdapter, { 
      debounceMs: 10,
      tasksFilePath: 'mock-path',
      projectId: 'PROJ'
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should trigger decomposition for complex tasks (existing task)', async () => {
    const now = new Date();
    const lastSynced = new Date(now.getTime() - 2000).toISOString();
    const remoteUpdated = new Date(now.getTime() - 1000);

    const mockLocalTasks = {
      meta: {} as any,
      features: [],
      tasks: [
        { 
          id: 'TASK-001', 
          title: 'Complex Task', 
          status: 'in_progress', 
          priority: 'high', 
          created: lastSynced,
          updated: lastSynced,
          last_synced_at: lastSynced,
          external_refs: ['mock-adapter:REMOTE-1']
        }
      ]
    };

    const mockRemoteTicket: any = {
      id: 'REMOTE-1',
      title: 'Complex Task',
      description: '- Subtask 1\n- Subtask 2',
      status: 'in_progress',
      priority: 'high',
      workflow_type: 'orchestration',
      createdAt: new Date(lastSynced),
      updatedAt: remoteUpdated,
      project_key: 'PROJ'
    };

    mockAdapter.pullTasks.mockResolvedValue([mockRemoteTicket]);
    mockWatcher.getTasks.mockResolvedValue(mockLocalTasks);

    await engine.pull();

    expect(mockLocalTasks.tasks[0].orchestration_state).toBe('ready');
    expect(mockLocalTasks.tasks.length).toBeGreaterThan(1);
    const subtask = mockLocalTasks.tasks.find((t: any) => t.parent_id === 'TASK-001');
    expect(subtask).toBeDefined();
    if (subtask) {
        expect(subtask.title).toBe('Subtask 1');
    }
    
    expect(mockAdapter.postComment).toHaveBeenCalledWith(
      'REMOTE-1',
      expect.stringContaining('successfully decomposed')
    );
  });

  it('should trigger decomposition for new complex tasks', async () => {
    const mockRemoteTicket: any = {
      id: 'REMOTE-2',
      title: 'New Complex Task',
      description: '- Subtask A\n- Subtask B',
      status: 'in_progress',
      priority: 'high',
      workflow_type: 'orchestration',
      createdAt: new Date(),
      updatedAt: new Date(),
      project_key: 'PROJ'
    };

    mockAdapter.pullTasks.mockResolvedValue([mockRemoteTicket]);
    
    const mockLocalTasks = {
      meta: {} as any,
      features: [],
      tasks: []
    };
    mockWatcher.getTasks.mockResolvedValue(mockLocalTasks);

    await engine.pull();

    expect(mockLocalTasks.tasks.length).toBe(3);
    expect(mockLocalTasks.tasks[0].orchestration_state).toBe('ready');
    expect(mockAdapter.postComment).toHaveBeenCalled();
  });

  it('should handle agent handoff (pending -> accepted)', async () => {
    const mockLocalTasks = {
      meta: {} as any,
      features: [],
      tasks: [
        { 
          id: 'TASK-001', 
          title: 'Handoff Task', 
          status: 'in_progress', 
          priority: 'high', 
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          assigned_to: 'agent-1',
          handoff_to: 'agent-2',
          handoff_notes: 'Please finish the documentation.',
          handoff_state: 'pending', // Initially pending
          external_refs: ['mock-adapter:REMOTE-1'],
          last_synced_at: new Date(Date.now() - 1000).toISOString()
        }
      ]
    };

    mockWatcher.getTasks.mockResolvedValue(mockLocalTasks);
    mockAdapter.updateTicket.mockResolvedValue({ 
      id: 'REMOTE-1', 
      updatedAt: new Date() 
    } as any);

    await engine.push();
    expect(mockLocalTasks.tasks[0].assigned_to).toBe('agent-1');
    expect(mockLocalTasks.tasks[0].handoff_state).toBe('pending');
    expect(mockAdapter.postComment).toHaveBeenCalledWith(
        'REMOTE-1',
        expect.stringContaining('Agent Handoff Requested')
    );

    mockLocalTasks.tasks[0].handoff_state = 'accepted';
    mockLocalTasks.tasks[0].updated = new Date().toISOString();

    await engine.push();
    expect(mockLocalTasks.tasks[0].assigned_to).toBe('agent-2');
    expect(mockLocalTasks.tasks[0].handoff_to).toBeUndefined();
    expect(mockLocalTasks.tasks[0].handoff_state).toBeUndefined();
    expect(mockAdapter.postComment).toHaveBeenCalledWith(
      'REMOTE-1',
      expect.stringContaining('Agent Handoff Complete')
    );
  });

  it('should log orchestration actions to audit trail', async () => {
    const mockRemoteTicket: any = {
      id: 'REMOTE-3',
      title: 'Audit Task',
      status: 'in_progress',
      priority: 'medium',
      workflow_type: 'orchestration',
      createdAt: new Date(),
      updatedAt: new Date(),
      project_key: 'PROJ'
    };

    mockAdapter.pullTasks.mockResolvedValue([mockRemoteTicket]);
    mockWatcher.getTasks.mockResolvedValue({ meta: {}, features: [], tasks: [] });

    await engine.pull();

    const auditAppendCall = (fs.appendFile as jest.Mock).mock.calls.find(
      (call: any) => call[0].includes('audit-trail.json')
    );
    
    expect(auditAppendCall).toBeDefined();
    expect((auditAppendCall as any)[1]).toContain('decompose');
  });
});
