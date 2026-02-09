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

const fs: any = await import('fs/promises');
const { TaskFileWatcher }: any = await import('../../sync/file-watcher.js');
const { SyncEngine }: any = await import('../../sync/sync-engine.js');

describe('Skill-Based Routing', () => {
  let engine: any;
  let mockWatcher: any;
  let mockAdapter: any;
  let watcherEmitter: EventEmitter;

  beforeEach(() => {
    watcherEmitter = new EventEmitter();
    mockWatcher = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      suspend: jest.fn(),
      resume: jest.fn(),
      on: jest.fn().mockImplementation((event: any, listener: any) => {
        watcherEmitter.on(event, listener);
      }),
      getTasks: jest.fn().mockResolvedValue({
        meta: { last_updated: new Date().toISOString() },
        tasks: [],
        features: []
      })
    };

    mockAdapter = {
      name: 'mock-adapter',
      init: jest.fn().mockResolvedValue(undefined),
      validateConfig: jest.fn().mockResolvedValue(true),
      createTicket: jest.fn(),
      updateTicket: jest.fn(),
      getTicket: jest.fn(),
      pullTasks: jest.fn().mockResolvedValue([]),
      postComment: jest.fn().mockResolvedValue(undefined),
      mapStatusToNative: jest.fn(),
      mapStatusFromNative: jest.fn()
    };

    engine = new SyncEngine(mockWatcher, mockAdapter, { 
      debounceMs: 10,
      tasksFilePath: 'mock-path',
      projectId: 'PROJ'
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should handle duplicate instructions by replacing them', async () => {
    const existingTask = {
        id: 'TASK-1',
        title: 'Test',
        description: 'Original description.\n\n[pm-sync] 🤖 Agent instruction: Use /old skill for this task.',
        status: 'todo',
        priority: 'medium',
        skill: 'old',
        created: new Date().toISOString(),
        updated: new Date(Date.now() - 100000).toISOString(),
        last_synced_at: new Date(Date.now() - 100000).toISOString(),
        external_refs: ['mock-adapter:REMOTE-1']
    };

    mockWatcher.getTasks.mockResolvedValue({
        meta: {},
        tasks: [existingTask],
        features: []
    });

    const mockRemoteTicket: any = {
        id: 'REMOTE-1',
        title: 'Test',
        description: 'Original description.', 
        status: 'todo',
        priority: 'medium',
        skill: 'new',
        createdAt: new Date(),
        updatedAt: new Date()
    };

    mockAdapter.pullTasks.mockResolvedValue([mockRemoteTicket]);

    await engine.pull();

    expect(fs.writeFile).toHaveBeenCalled();
    const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
    const writtenJson = JSON.parse(writeCall[1] as string);
    const updatedTask = writtenJson.tasks[0];

    expect(updatedTask.skill).toBe('new');
    
    expect(updatedTask.description).toContain('Use /new skill');
    expect(updatedTask.description).not.toContain('Use /old skill');
    
    expect(mockAdapter.postComment).toHaveBeenCalledWith(
        'REMOTE-1', 
        expect.stringContaining('Switching to /new skill')
    );
  });

  it('should post comment when skill is added to existing task', async () => {
    const existingTask = {
        id: 'TASK-1',
        title: 'Test',
        description: 'Original description.',
        status: 'todo',
        priority: 'medium',
        created: new Date().toISOString(),
        updated: new Date(Date.now() - 100000).toISOString(),
        last_synced_at: new Date(Date.now() - 100000).toISOString(),
        external_refs: ['mock-adapter:REMOTE-1']
    };

    mockWatcher.getTasks.mockResolvedValue({
        meta: {},
        tasks: [existingTask],
        features: []
    });

    const mockRemoteTicket: any = {
        id: 'REMOTE-1',
        title: 'Test',
        description: 'Original description.',
        status: 'todo',
        priority: 'medium',
        skill: 'pptx',
        createdAt: new Date(),
        updatedAt: new Date() 
    };

    mockAdapter.pullTasks.mockResolvedValue([mockRemoteTicket]);

    await engine.pull();

    expect(mockAdapter.postComment).toHaveBeenCalledWith(
        'REMOTE-1', 
        expect.stringContaining('Switching to /pptx skill')
    );
  });

  it('should NOT post comment if skill did not change', async () => {
    const existingTask = {
        id: 'TASK-1',
        title: 'Test',
        description: 'Original description.\n\n[pm-sync] 🤖 Agent instruction: Use /pptx skill for this task.',
        status: 'todo',
        priority: 'medium',
        skill: 'pptx',
        created: new Date().toISOString(),
        updated: new Date(Date.now() - 100000).toISOString(),
        last_synced_at: new Date(Date.now() - 100000).toISOString(),
        external_refs: ['mock-adapter:REMOTE-1']
    };

    mockWatcher.getTasks.mockResolvedValue({
        meta: {},
        tasks: [existingTask],
        features: []
    });

    const mockRemoteTicket: any = {
        id: 'REMOTE-1',
        title: 'Test Updated',
        description: 'Original description.',
        status: 'todo',
        priority: 'medium',
        skill: 'pptx',
        createdAt: new Date(),
        updatedAt: new Date()
    };

    mockAdapter.pullTasks.mockResolvedValue([mockRemoteTicket]);

    await engine.pull();

    expect(mockAdapter.postComment).not.toHaveBeenCalled();
  });
});
