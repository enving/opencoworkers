import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EventEmitter } from 'events';

// Mocking dependencies to avoid real file system and server calls
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

const { TaskFileWatcher }: any = await import('../../sync/file-watcher.js');
const { SyncEngine }: any = await import('../../sync/sync-engine.js');

describe('Orchestration Integration Scenarios', () => {
  let engine: any;
  let mockWatcher: any;
  let mockAdapter: any;

  beforeEach(() => {
    mockWatcher = {
      start: jest.fn().mockResolvedValue(undefined as any),
      stop: jest.fn().mockResolvedValue(undefined as any),
      suspend: jest.fn(),
      resume: jest.fn(),
      on: jest.fn().mockImplementation((event: any, listener: any) => {
      }),
      getTasks: jest.fn()
    };

    mockAdapter = {
      name: 'plane',
      validateConfig: jest.fn().mockResolvedValue(true as any) as any,
      createTicket: jest.fn().mockImplementation((task: any) => Promise.resolve({
        id: `plane-${Math.floor(Math.random() * 1000)}`,
        updatedAt: new Date()
      })),
      updateTicket: jest.fn(),
      pullTasks: jest.fn(),
      postComment: jest.fn().mockResolvedValue(undefined as any) as any,
    };

    engine = new SyncEngine(mockWatcher, mockAdapter, {
      debounceMs: 10,
      tasksFilePath: 'test-tasks.json',
      projectId: 'plane-proj'
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('TASK-030: should successfully decompose a complex task and handle agent handoffs', async () => {
    const tasksJson: any = {
      meta: { version: '1.0.0', last_updated: '', last_agent: '', project_phase: '' },
      tasks: [],
      features: []
    };
    mockWatcher.getTasks.mockResolvedValue(tasksJson);

    const complexTicket = {
      id: 'plane-100',
      title: 'Prepare board meeting package',
      description: 'Please prepare the following:\n- Analyze Q4 financials /xlsx\n- Create board deck /pptx\n- Write executive summary /docx',
      status: 'in_progress',
      priority: 'high',
      workflow_type: 'orchestration',
      project_key: 'plane-proj',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockAdapter.pullTasks.mockResolvedValue([complexTicket]);

    await engine.pull();

    const parentTask = tasksJson.tasks.find((t: any) => t.title === 'Prepare board meeting package');
    expect(parentTask).toBeDefined();
    expect(parentTask.orchestration_state).toBe('ready');

    const subTasks = tasksJson.tasks.filter((t: any) => t.parent_id === parentTask.id);
    expect(subTasks.length).toBe(3);
    expect(subTasks.some((t: any) => t.skill === 'xlsx')).toBe(true);
    expect(subTasks.some((t: any) => t.skill === 'pptx')).toBe(true);
    expect(subTasks.some((t: any) => t.skill === 'docx')).toBe(true);

    const xlsxTask = subTasks.find((t: any) => t.skill === 'xlsx')!;
    xlsxTask.assigned_to = 'agent-data';
    xlsxTask.handoff_to = 'agent-reviewer';
    xlsxTask.handoff_notes = 'Financial analysis complete, please review charts.';
    xlsxTask.updated = new Date().toISOString();
    xlsxTask.last_synced_at = new Date(Date.now() - 1000).toISOString();

    xlsxTask.external_refs = ['plane:plane-101'];
    mockAdapter.updateTicket.mockResolvedValue({ id: 'plane-101', updatedAt: new Date() });

    await engine.push();

    expect(xlsxTask.handoff_state).toBe('pending');
    expect(mockAdapter.postComment).toHaveBeenCalledWith('plane-101', expect.stringContaining('Agent Handoff Requested'));

    xlsxTask.handoff_state = 'accepted';
    xlsxTask.updated = new Date().toISOString();

    await engine.push();

    expect(xlsxTask.assigned_to).toBe('agent-reviewer');
    expect(xlsxTask.handoff_to).toBeUndefined();
    expect(xlsxTask.handoff_state).toBeUndefined();
    expect(mockAdapter.postComment).toHaveBeenCalledWith('plane-101', expect.stringContaining('Agent Handoff Complete'));
  });

  it('TASK-027-TEST: should handle calendar integration skill routing', async () => {
    const tasksJson: any = { meta: {}, tasks: [], features: [] };
    mockWatcher.getTasks.mockResolvedValue(tasksJson);

    const calendarTicket = {
      id: 'plane-102',
      title: 'Schedule team meeting',
      description: 'Schedule team meeting Thursday 14:00',
      status: 'todo',
      priority: 'medium',
      skill: 'calendar',
      project_key: 'plane-proj',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockAdapter.pullTasks.mockResolvedValue([calendarTicket]);

    await engine.pull();

    const task = tasksJson.tasks.find((t: any) => t.title === 'Schedule team meeting');
    expect(task).toBeDefined();
    expect(task.skill).toBe('calendar');
    expect(task.description).toContain('Agent instruction: Use /calendar skill');
  });

  it('TASK-028-TEST: should handle email response automation skill routing', async () => {
    const tasksJson: any = { meta: {}, tasks: [], features: [] };
    mockWatcher.getTasks.mockResolvedValue(tasksJson);

    const emailTicket = {
      id: 'plane-103',
      title: 'Respond to customer inquiry',
      description: 'Respond to customer inquiry about pricing',
      status: 'todo',
      priority: 'medium',
      skill: 'email',
      project_key: 'plane-proj',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockAdapter.pullTasks.mockResolvedValue([emailTicket]);

    await engine.pull();

    const task = tasksJson.tasks.find((t: any) => t.title === 'Respond to customer inquiry');
    expect(task).toBeDefined();
    expect(task.skill).toBe('email');
    expect(task.description).toContain('Agent instruction: Use /email skill');
  });

  it('TASK-029: should handle excel analysis workflow skill routing', async () => {
    const tasksJson: any = { meta: {}, tasks: [], features: [] };
    mockWatcher.getTasks.mockResolvedValue(tasksJson);

    const excelTicket = {
      id: 'plane-104',
      title: 'Analyze sales data',
      description: 'Analyze Q4 sales data in sales.xlsx',
      status: 'todo',
      priority: 'medium',
      skill: 'xlsx',
      project_key: 'plane-proj',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockAdapter.pullTasks.mockResolvedValue([excelTicket]);

    await engine.pull();

    const task = tasksJson.tasks.find((t: any) => t.title === 'Analyze sales data');
    expect(task).toBeDefined();
    expect(task.skill).toBe('xlsx');
    expect(task.description).toContain('Agent instruction: Use /xlsx skill');
  });
});


