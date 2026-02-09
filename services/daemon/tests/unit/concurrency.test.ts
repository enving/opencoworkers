import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EventEmitter } from 'events';

jest.unstable_mockModule('fs/promises', () => ({
  writeFile: jest.fn(),
  readFile: jest.fn(),
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

jest.unstable_mockModule('../../server/bridge.js', () => ({
  OpenCodeServerBridge: jest.fn().mockImplementation(() => {
    const emitter = new EventEmitter();
    (emitter as any).triggerTaskExecution = jest.fn().mockResolvedValue('session-id');
    (emitter as any).getActiveSessionsCount = jest.fn().mockResolvedValue(0);
    return emitter;
  }),
}));

const fs: any = await import('fs/promises');
const { TaskFileWatcher }: any = await import('../../sync/file-watcher.js');
const { SyncEngine }: any = await import('../../sync/sync-engine.js');
const { OpenCodeServerBridge }: any = await import('../../server/bridge.js');

describe('SyncEngine Concurrency Control', () => {
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
      createTicket: jest.fn().mockImplementation((task: any) => Promise.resolve({
        id: `REMOTE-${task.id}`,
        updatedAt: new Date()
      })),
      updateTicket: jest.fn().mockImplementation((id: any) => Promise.resolve({
        id,
        updatedAt: new Date()
      })),
      pullTasks: jest.fn().mockResolvedValue([] as any) as any,
      postComment: jest.fn().mockResolvedValue(undefined as any) as any,
      mapStatusToNative: jest.fn(),
      mapStatusFromNative: jest.fn()
    } as any;

    engine = new SyncEngine(mockWatcher, mockAdapter, { 
      debounceMs: 10,
      tasksFilePath: 'mock-path',
      projectId: 'PROJ',
      fullConfig: {
        adapter: 'mock-adapter',
        server: {
          autoTrigger: true,
          maxConcurrentAgents: 2
        }
      } as any
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should respect maxConcurrentAgents limit', async () => {
    await engine.start();

    const mockTasks: any = {
      meta: {} as any,
      features: [],
      tasks: [
        { id: 'TASK-1', title: 'Task 1', status: 'in_progress', skill: 'git', priority: 'high', created: '', updated: new Date().toISOString() },
        { id: 'TASK-2', title: 'Task 2', status: 'in_progress', skill: 'git', priority: 'high', created: '', updated: new Date().toISOString() },
        { id: 'TASK-3', title: 'Task 3', status: 'in_progress', skill: 'git', priority: 'high', created: '', updated: new Date().toISOString() },
      ]
    };

    watcherEmitter.emit('change', mockTasks);

    await new Promise(resolve => setTimeout(resolve, 100));

    const serverBridge = (engine as any).serverBridges.get('default');
    expect(serverBridge.triggerTaskExecution).toHaveBeenCalledTimes(2);
    expect(mockTasks.tasks[0].orchestration_state).toBe('in_progress');
    expect(mockTasks.tasks[1].orchestration_state).toBe('in_progress');
    expect(mockTasks.tasks[2].orchestration_state).toBeUndefined();
  });

  it('should trigger next task from queue when one completes', async () => {
    await engine.start();

    const mockTasks: any = {
      meta: {} as any,
      features: [],
      tasks: [
        { id: 'TASK-1', title: 'Task 1', status: 'completed', skill: 'git', priority: 'high', created: '', updated: new Date().toISOString(), orchestration_state: 'completed' },
        { id: 'TASK-2', title: 'Task 2', status: 'in_progress', skill: 'git', priority: 'high', created: '', updated: new Date().toISOString(), orchestration_state: 'in_progress' },
        { id: 'TASK-3', title: 'Task 3', status: 'in_progress', skill: 'git', priority: 'high', created: '', updated: new Date().toISOString() },
      ]
    };

    watcherEmitter.emit('change', mockTasks);

    await new Promise(resolve => setTimeout(resolve, 100));

    const serverBridge = (engine as any).serverBridges.get('default');
    expect(serverBridge.triggerTaskExecution).toHaveBeenCalledTimes(1);
    expect(mockTasks.tasks[2].orchestration_state).toBe('in_progress');
  });
});
