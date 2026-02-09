import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

jest.unstable_mockModule('axios', () => {
  return {
    default: {
      create: jest.fn().mockReturnThis(),
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn()
    }
  };
});

const axios = (await import('axios')).default;
const { PlaneAdapter } = await import('../../adapters/plane/plane-adapter.js');

describe('PlaneAdapter', () => {
  let adapter: any;
  const config = {
    apiKey: 'test-token',
    teamId: 'test-workspace',
    projectId: 'test-project'
  };

  const mockTask = {
    id: 'TASK-001',
    title: 'Test Task',
    description: 'Description',
    status: 'pending',
    priority: 'medium',
    created: new Date().toISOString()
  };

  beforeEach(async () => {
    adapter = new PlaneAdapter();
    // @ts-ignore
    axios.create.mockReturnThis();
    await adapter.init(config);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTicket', () => {
    it('should create a ticket successfully', async () => {
      const mockResponse = {
        data: {
          id: 'issue-123',
          name: 'Test Task',
          description: 'Description',
          state: { name: 'Backlog' },
          priority: 'Medium',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      };

      // @ts-ignore
      axios.post.mockResolvedValueOnce(mockResponse);

      // @ts-ignore
      const result = await adapter.createTicket(mockTask);

      // @ts-ignore
      expect(axios.post).toHaveBeenCalledWith(
        '/workspaces/test-workspace/projects/test-project/issues/',
        {
          name: 'Test Task',
          description: 'Description',
          priority: 'Medium'
        }
      );

      expect(result.id).toBe('issue-123');
      expect(result.title).toBe('Test Task');
      expect(result.status).toBe('todo');
    });

    it('should throw error on failure', async () => {
      // @ts-ignore
      axios.post.mockRejectedValueOnce(new Error('API Error'));

      // @ts-ignore
      await expect(adapter.createTicket(mockTask)).rejects.toThrow('Failed to create ticket');
    });
  });

  describe('getTicket', () => {
    it('should retrieve a ticket', async () => {
      const mockResponse = {
        data: {
          id: 'issue-123',
          name: 'Test Task',
          state: { name: 'In Progress' },
          priority: 'High',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      };

      // @ts-ignore
      axios.get.mockResolvedValueOnce(mockResponse);

      const result = await adapter.getTicket('issue-123');

      expect(result).toBeDefined();
      expect(result?.title).toBe('Test Task');
      expect(result?.status).toBe('in_progress');
      expect(result?.priority).toBe('high');
    });

    it('should return null for 404', async () => {
      // @ts-ignore
      axios.get.mockRejectedValueOnce({
        response: { status: 404 }
      });

      const result = await adapter.getTicket('non-existent');
      expect(result).toBeNull();
    });
  });
});
