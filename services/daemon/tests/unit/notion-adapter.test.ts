import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockPost = jest.fn();
const mockGet = jest.fn();
const mockPatch = jest.fn();
const mockDelete = jest.fn();

const mockAxiosInstance = {
  post: mockPost,
  get: mockGet,
  patch: mockPatch,
  delete: mockDelete,
  interceptors: {
    response: { use: jest.fn() }
  }
};

const mockCreate = jest.fn(() => mockAxiosInstance);

jest.unstable_mockModule('axios', () => ({
  default: {
    create: mockCreate
  }
}));

const { NotionAdapter } = await import('../../adapters/notion/notion-adapter.js');

describe('NotionAdapter', () => {
  let adapter: any;
  const config = {
    apiKey: 'secret_123',
    projectId: 'database_id_123'
  };

  beforeEach(async () => {
    adapter = new NotionAdapter();
    await adapter.init(config);
    jest.clearAllMocks();
  });

  it('should validate config successfully', async () => {
    mockGet.mockResolvedValueOnce({ data: { id: 'database_id_123' } } as never);
    const isValid = await adapter.validateConfig();
    expect(isValid).toBe(true);
    expect(mockGet).toHaveBeenCalledWith('/databases/database_id_123');
  });

  it('should create a ticket with description (markdown to blocks)', async () => {
    mockPost.mockResolvedValueOnce({ 
      data: { 
        id: 'page_123',
        created_time: '2023-01-01T00:00:00.000Z',
        last_edited_time: '2023-01-01T00:00:00.000Z',
        url: 'https://notion.so/page_123',
        properties: {
          Name: { title: [{ plain_text: 'Test Task' }] },
          Status: { select: { name: 'To Do' } },
          Priority: { select: { name: 'Medium' } }
        }
      } 
    } as never);

    const task = {
      id: 'TASK-1',
      title: 'Test Task',
      status: 'pending',
      priority: 'medium',
      description: '# Heading\n- Item 1'
    } as any;

    const result = await adapter.createTicket(task);

    expect(mockPost).toHaveBeenCalledWith('/pages', expect.objectContaining({
      parent: { database_id: 'database_id_123' },
      children: [
        { object: 'block', type: 'heading_1', heading_1: { rich_text: [{ type: 'text', text: { content: 'Heading' } }] } },
        { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: 'Item 1' } }] } }
      ]
    }));
    expect(result.description).toBe(task.description);
  });

  it('should get a ticket with description (blocks to markdown)', async () => {
    mockGet.mockResolvedValueOnce({ 
      data: { 
        id: 'page_123',
        created_time: '2023-01-01T00:00:00.000Z',
        last_edited_time: '2023-01-01T00:00:00.000Z',
        url: 'https://notion.so/page_123',
        properties: {
          Name: { title: [{ plain_text: 'Test Task' }] },
          Status: { select: { name: 'To Do' } },
          Priority: { select: { name: 'Medium' } }
        }
      } 
    } as never);

    mockGet.mockResolvedValueOnce({
      data: {
        results: [
          { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Hello world' }] } },
          { type: 'to_do', to_do: { rich_text: [{ plain_text: 'Task 1' }], checked: true } }
        ]
      }
    } as never);

    const result = await adapter.getTicket('page_123');

    expect(result?.description).toBe('Hello world\n\n- [x] Task 1');
  });

  it('should update a ticket description (delete and append)', async () => {
    mockPatch.mockResolvedValueOnce({ 
      data: { 
        id: 'page_123',
        created_time: '2023-01-01T00:00:00.000Z',
        last_edited_time: '2023-01-01T00:00:00.000Z',
        url: 'https://notion.so/page_123',
        properties: {
          Name: { title: [{ plain_text: 'Updated Task' }] },
          Status: { select: { name: 'To Do' } },
          Priority: { select: { name: 'Medium' } }
        }
      } 
    } as never);

    mockGet.mockResolvedValueOnce({
      data: {
        results: [
          { id: 'block_1' },
          { id: 'block_2' }
        ]
      }
    } as never);

    mockDelete.mockResolvedValue({ data: {} } as never);

    mockPatch.mockResolvedValueOnce({ data: {} } as never);

    await adapter.updateTicket('page_123', {
      title: 'Updated Task',
      description: 'New content'
    } as any);

    expect(mockDelete).toHaveBeenCalledTimes(2);
    expect(mockDelete).toHaveBeenCalledWith('/blocks/block_1');
    expect(mockDelete).toHaveBeenCalledWith('/blocks/block_2');

    expect(mockPatch).toHaveBeenCalledWith('/blocks/page_123/children', {
      children: [
        { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: 'New content' } }] } }
      ]
    });
  });
});
