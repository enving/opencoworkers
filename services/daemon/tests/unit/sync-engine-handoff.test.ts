import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EventEmitter } from 'events';

// Mocks
jest.unstable_mockModule('fs/promises', () => ({
  writeFile: jest.fn(),
  readFile: jest.fn(),
  appendFile: jest.fn(),
  access: jest.fn(),
  mkdir: jest.fn(),
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

jest.unstable_mockModule('../../orchestration/audit-trail.js', () => ({
  AuditLogger: jest.fn().mockImplementation(() => ({
    logAction: jest.fn().mockResolvedValue(undefined),
  })),
}));

const fs: any = await import('fs/promises');
const { TaskFileWatcher }: any = await import('../../sync/file-watcher.js');
const { AuditLogger }: any = await import('../../orchestration/audit-trail.js');
const { SyncEngine }: any = await import('../../sync/sync-engine.js');

describe('SyncEngine Handoff Workflow', () => {
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
      mapStatusFromNative: jest.fn(),
      // Mock updateTicket to return a ticket
      updateTicket: jest.fn().mockImplementation((id, data) => Promise.resolve({
        id: id,
        updatedAt: new Date()
      }))
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

  it('should request handoff acceptance when pending', async () => {
    await engine.start();

    const mockTasks = {
      meta: {} as any,
      features: [],
      tasks: [
        { 
            id: 'TASK-1', 
            title: 'Test Handoff', 
            status: 'in_progress', 
            priority: 'medium', 
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            last_synced_at: new Date(Date.now() - 1000).toISOString(),
            external_refs: ['mock-adapter:REMOTE-1'],
            assigned_to: 'AgentA',
            handoff_to: 'AgentB',
            handoff_notes: 'Please review',
            handoff_state: 'pending'
        }
      ]
    };

    // Simulate file change
    watcherEmitter.emit('change', mockTasks);
    await new Promise(resolve => setTimeout(resolve, 50));

    // Should call updateTicket (standard sync)
    expect(mockAdapter.updateTicket).toHaveBeenCalled();
    
    // Should post comment requesting acceptance
    expect(mockAdapter.postComment).toHaveBeenCalledWith(
        'REMOTE-1',
        expect.stringContaining('Agent Handoff Requested: AgentA -> AgentB')
    );
    expect(mockAdapter.postComment).toHaveBeenCalledWith(
        'REMOTE-1',
        expect.stringContaining('[Action Required] New agent must accept to proceed')
    );
  });

  it('should clear fields when handoff rejected', async () => {
    await engine.start();

    const mockTasks = {
      meta: {} as any,
      features: [],
      tasks: [
        { 
            id: 'TASK-1', 
            title: 'Test Handoff', 
            status: 'in_progress', 
            updated: new Date().toISOString(),
            last_synced_at: new Date(Date.now() - 1000).toISOString(),
            external_refs: ['mock-adapter:REMOTE-1'],
            assigned_to: 'AgentA',
            handoff_to: 'AgentB',
            handoff_state: 'rejected'
        }
      ]
    };

    watcherEmitter.emit('change', mockTasks);
    await new Promise(resolve => setTimeout(resolve, 50));

    // Check if tasks.json was updated with cleared fields
    expect(fs.writeFile).toHaveBeenCalled();
    const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
    const writtenJson = JSON.parse(writeCall[1]);
    const task = writtenJson.tasks[0];
    
    expect(task.handoff_to).toBeUndefined();
    expect(task.handoff_state).toBeUndefined();
    expect(task.assigned_to).toBe('AgentA'); // Remains AgentA
  });

  it('should complete handoff when accepted', async () => {
    await engine.start();

    const mockTasks = {
      meta: {} as any,
      features: [],
      tasks: [
        { 
            id: 'TASK-1', 
            title: 'Test Handoff', 
            status: 'in_progress', 
            updated: new Date().toISOString(),
            last_synced_at: new Date(Date.now() - 1000).toISOString(),
            external_refs: ['mock-adapter:REMOTE-1'],
            assigned_to: 'AgentA',
            handoff_to: 'AgentB',
            handoff_state: 'accepted',
            handoff_notes: 'Take over'
        }
      ]
    };

    watcherEmitter.emit('change', mockTasks);
    await new Promise(resolve => setTimeout(resolve, 50));

    // Verify audit log
    // Access the private auditLogger directly from the engine instance
    const auditLogger = engine['auditLogger'];
    expect(auditLogger.logAction).toHaveBeenCalledWith(expect.objectContaining({
        action: 'handoff',
        agentId: 'AgentA',
        result: 'success'
    }));

    // Verify confirmation comment
    expect(mockAdapter.postComment).toHaveBeenCalledWith(
        'REMOTE-1',
        expect.stringContaining('Agent Handoff Complete: AgentA -> AgentB')
    );

    // Verify task update
    expect(fs.writeFile).toHaveBeenCalled();
    const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
    const writtenJson = JSON.parse(writeCall[1]);
    const task = writtenJson.tasks[0];
    
    expect(task.assigned_to).toBe('AgentB'); // Switched to AgentB
    expect(task.handoff_to).toBeUndefined();
    expect(task.handoff_state).toBeUndefined();
  });
});
