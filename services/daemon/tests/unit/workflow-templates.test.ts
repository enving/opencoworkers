import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

jest.unstable_mockModule('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  access: jest.fn(),
  mkdir: jest.fn(),
  appendFile: jest.fn(),
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
const { SyncEngine } = await import('../../sync/sync-engine.js');

jest.useFakeTimers();

describe('SyncEngine Workflow Templates', () => {
  let engine: any;
  let watcher: any;
  let mockAdapter: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    watcher = {
      on: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      suspend: jest.fn(),
      resume: jest.fn(),
      getTasks: jest.fn()
    };

    mockAdapter = {
      name: 'mock',
      init: jest.fn().mockResolvedValue(undefined),
      validateConfig: jest.fn().mockResolvedValue(true),
      getTicket: jest.fn().mockResolvedValue(null),
      pullTasks: jest.fn().mockResolvedValue([]),
      createTicket: jest.fn().mockImplementation((task: any) => Promise.resolve({
        id: 'REMOTE-1',
        title: task.title,
        description: task.description || '',
        status: 'todo',
        priority: 'medium',
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'http://mock/1',
        nativeData: {}
      })),
      updateTicket: jest.fn().mockImplementation((id: string, updates: any) => Promise.resolve({
        id: id || 'REMOTE-1',
        title: updates.title || 'Updated',
        description: updates.description || '',
        status: updates.status || 'todo',
        priority: updates.priority || 'medium',
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'http://mock/1',
        nativeData: {}
      })),
      postComment: jest.fn().mockResolvedValue(undefined),
      mapStatusToNative: jest.fn().mockImplementation((s: any) => s),
      mapStatusFromNative: jest.fn().mockReturnValue('todo')
    };

    engine = new SyncEngine(watcher as any, mockAdapter as any, { 
      tasksFilePath: 'tasks.json',
      debounceMs: 10
    });
    
    (engine as any).serverBridge = {
      triggerTaskExecution: jest.fn<any>().mockResolvedValue('session-1')
    };
    
    (engine as any).config.fullConfig = {
      server: {
        baseUrl: 'http://localhost:3000',
        password: 'pass',
        autoTrigger: true
      }
    };

    fs.access.mockResolvedValue(undefined);
    fs.mkdir.mockResolvedValue(undefined);
    fs.appendFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if ((engine as any).debounceTimer) {
      clearTimeout((engine as any).debounceTimer);
    }
  });

  it('should expand template into subtasks', async () => {
    const tasksJson: any = {
      meta: { version: '1.0', last_updated: '', last_agent: '', project_phase: '' },
      tasks: [
        {
          id: 'TASK-1',
          title: 'Onboard John Doe',
          status: 'in_progress',
          priority: 'high',
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          workflow_type: 'orchestration',
          template: 'onboarding',
          external_refs: ['mock:REMOTE-1']
        }
      ],
      features: []
    };

    fs.readFile.mockResolvedValue(JSON.stringify({
      name: "Onboarding",
      tasks: [
        { title: "Email", skill: "email" },
        { title: "Calendar", skill: "calendar" }
      ]
    }));

    await (engine as any).handleLocalChange(tasksJson);
    
    jest.runAllTimers();
    
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }

    expect(tasksJson.tasks.length).toBe(3); 
    expect(tasksJson.tasks[0].subtasks).toHaveLength(2);
    expect(tasksJson.tasks[0].orchestration_state).toBe('ready');
    
    expect(tasksJson.tasks[1].title).toBe('Email');
    expect(tasksJson.tasks[1].skill).toBe('email');
    expect(tasksJson.tasks[1].parent_id).toBe('TASK-1');

    expect(mockAdapter.postComment).toHaveBeenCalledWith(
      'REMOTE-1',
      expect.stringContaining("Template 'Onboarding' applied")
    );
  });
});
