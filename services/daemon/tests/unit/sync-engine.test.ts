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

describe('SyncEngine', () => {
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

    (mockWatcher as any).getTasks = jest.fn().mockResolvedValue({
      meta: { last_updated: new Date().toISOString() },
      tasks: [],
      features: []
    } as any);

    engine = new SyncEngine(mockWatcher, mockAdapter, { 
      debounceMs: 10,
      tasksFilePath: 'mock-path',
      projectId: 'PROJ'
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should start and validate adapter', async () => {
    await engine.start();
    expect(mockAdapter.validateConfig).toHaveBeenCalled();
    expect(mockWatcher.start).toHaveBeenCalled();
  });

  it('should sync local changes to remote (create ticket)', async () => {
    await engine.start();

    const mockTasks = {
      meta: {} as any,
      features: [],
      tasks: [
        { id: 'TASK-1', title: 'Test', status: 'todo', priority: 'medium', created: '', updated: new Date().toISOString() }
      ]
    };

    const mockTicket: any = {
        id: 'REMOTE-1',
        title: 'Test',
        status: 'todo',
        priority: 'medium',
        createdAt: new Date(),
        updatedAt: new Date()
    };
    mockAdapter.createTicket.mockResolvedValue(mockTicket);

    watcherEmitter.emit('change', mockTasks);

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockAdapter.createTicket).toHaveBeenCalledWith(mockTasks.tasks[0]);
    expect(mockWatcher.suspend).toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalled();
    
    const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
    const writtenJson = JSON.parse(writeCall[1]);
    expect(writtenJson.tasks[0].external_refs).toContain('mock-adapter:REMOTE-1');
  });

  it('should skip creation if already exists', async () => {
    await engine.start();

    const mockTasks = {
      meta: {} as any,
      features: [],
      tasks: [
        { 
            id: 'TASK-1', 
            title: 'Test', 
            status: 'todo', 
            priority: 'medium', 
            created: '',
            external_refs: ['mock-adapter:REMOTE-1']
        }
      ]
    };

    watcherEmitter.emit('change', mockTasks);

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockAdapter.createTicket).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('should skip update if task not modified since last sync', async () => {
    await engine.start();

    const now = new Date().toISOString();
    const mockTasks = {
      meta: {} as any,
      features: [],
      tasks: [
        { 
            id: 'TASK-1', 
            title: 'Test', 
            status: 'todo', 
            priority: 'medium', 
            created: now,
            updated: now,
            last_synced_at: now,
            external_refs: ['mock-adapter:REMOTE-1']
        }
      ]
    };

    watcherEmitter.emit('change', mockTasks);

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockAdapter.updateTicket).not.toHaveBeenCalled();
  });

  it('should sync local changes to remote (update ticket)', async () => {
    await engine.start();

    const now = new Date();
    const earlier = new Date(now.getTime() - 1000).toISOString();
    const later = now.toISOString();

    const mockTasks = {
      meta: {} as any,
      features: [],
      tasks: [
        { 
            id: 'TASK-1', 
            title: 'Updated Title', 
            status: 'in_progress', 
            priority: 'high', 
            created: earlier,
            updated: later,
            last_synced_at: earlier,
            external_refs: ['mock-adapter:REMOTE-1']
        }
      ]
    };

    const mockTicket: any = {
        id: 'REMOTE-1',
        title: 'Updated Title',
        status: 'in_progress',
        priority: 'high',
        createdAt: new Date(earlier),
        updatedAt: new Date(later)
    };
    mockAdapter.updateTicket.mockResolvedValue(mockTicket);

    watcherEmitter.emit('change', mockTasks);

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockAdapter.updateTicket).toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it('should sync remote changes to local (create new local task)', async () => {
    const mockRemoteTicket: any = {
      id: 'REMOTE-2',
      title: 'New Remote Task',
      status: 'todo',
      priority: 'high',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mockAdapter.pullTasks.mockResolvedValue([mockRemoteTicket]);
    
    await engine.start();

    expect(mockAdapter.pullTasks).toHaveBeenCalledWith('PROJ');
    expect(fs.writeFile).toHaveBeenCalled();
    
    const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
    const writtenJson = JSON.parse(writeCall[1]);
    expect(writtenJson.tasks.length).toBe(1);
    expect(writtenJson.tasks[0].title).toBe('New Remote Task');
    expect(writtenJson.tasks[0].external_refs).toContain('mock-adapter:REMOTE-2');
  });

  it('should pause sync after consecutive failures (circuit breaker)', async () => {
    mockAdapter.pullTasks.mockRejectedValue(new Error('API Down'));
    mockAdapter.createTicket.mockRejectedValue(new Error('API Down'));
    
    await engine.start(); 
    
    const mockTasks = {
      meta: {} as any,
      features: [],
      tasks: [{ id: 'TASK-1', title: 'Test', status: 'todo', priority: 'medium', created: '', updated: new Date().toISOString() }]
    };

    for (let i = 0; i < 4; i++) {
        watcherEmitter.emit('change', mockTasks);
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    expect(engine.isPaused).toBe(true);

    jest.clearAllMocks();
    watcherEmitter.emit('change', mockTasks);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(mockAdapter.createTicket).not.toHaveBeenCalled();
  });

  describe('pull', () => {
    it('should call syncRemoteToLocal', async () => {
      const mockRemoteTicket: any = {
        id: 'REMOTE-PULL',
        title: 'Pulled Task',
        status: 'todo',
        priority: 'high',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockAdapter.pullTasks.mockResolvedValue([mockRemoteTicket]);
      
      await engine.pull();
      
      expect(mockAdapter.pullTasks).toHaveBeenCalledWith('PROJ');
      expect(fs.writeFile).toHaveBeenCalled();
      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const writtenJson = JSON.parse(writeCall[1]);
      expect(writtenJson.tasks[0].title).toBe('Pulled Task');
    });
  });

  describe('push', () => {
    it('should call syncLocalToRemote', async () => {
      const mockTasks = {
        meta: {} as any,
        features: [],
        tasks: [
          { id: 'TASK-PUSH', title: 'Pushed Task', status: 'todo', priority: 'medium', created: '', updated: new Date().toISOString() }
        ]
      };
      mockWatcher.getTasks.mockResolvedValue(mockTasks);

      const mockTicket: any = {
          id: 'REMOTE-PUSH',
          title: 'Pushed Task',
          status: 'todo',
          priority: 'medium',
          createdAt: new Date(),
          updatedAt: new Date()
      };
      mockAdapter.createTicket.mockResolvedValue(mockTicket);

      await engine.push();

      expect(mockAdapter.createTicket).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });
});
