import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// Mock fs module before importing ConfigLoader
const mockExistsSync = jest.fn();
const mockReadFileSync = jest.fn();

jest.unstable_mockModule('fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
  }
}));

const { ConfigLoader }: any = await import('../../config/config-loader.js');

describe('ConfigLoader', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset mocks
    mockExistsSync.mockReset();
    mockReadFileSync.mockReset();

    // Reset env
    process.env = { ...originalEnv };
    delete process.env.PM_ADAPTER;
    delete process.env.PLANE_API_KEY;
    delete process.env.PLANE_WORKSPACE_SLUG;
    delete process.env.PLANE_PROJECT_ID;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should throw if missing required plane config', () => {
    mockExistsSync.mockReturnValue(false);
    process.env.PM_ADAPTER = 'plane';
    expect(() => ConfigLoader.load()).toThrow();
  });

  it('should load from env vars', () => {
    mockExistsSync.mockReturnValue(false);
    process.env.PM_ADAPTER = 'plane';
    process.env.PLANE_API_KEY = 'env-key';
    process.env.PLANE_WORKSPACE_SLUG = 'env-slug';
    process.env.PLANE_PROJECT_ID = 'env-project';

    const config = ConfigLoader.load();

    expect(config.adapter).toBe('plane');
    expect(config.plane?.apiKey).toBe('env-key');
    expect(config.sync.debounceMs).toBe(500);
  });

  it('should load from file', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      adapter: 'plane',
      plane: {
        apiKey: 'file-key',
        workspaceSlug: 'file-slug',
        projectId: 'file-project'
      },
      sync: {
        debounceMs: 1000
      }
    }));

    const config = ConfigLoader.load();

    expect(config.plane?.apiKey).toBe('file-key');
    expect(config.sync.debounceMs).toBe(1000);
  });

  it('should prioritize env over file', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      adapter: 'plane',
      plane: {
        apiKey: 'file-key',
        workspaceSlug: 'file-slug',
        projectId: 'file-project'
      }
    }));

    process.env.PM_ADAPTER = 'plane';
    process.env.PLANE_API_KEY = 'env-key';
    process.env.PLANE_WORKSPACE_SLUG = 'file-slug'; // Keep from file
    process.env.PLANE_PROJECT_ID = 'file-project'; // Keep from file

    const config = ConfigLoader.load();

    expect(config.plane?.apiKey).toBe('env-key');
    expect(config.plane?.workspaceSlug).toBe('file-slug');
  });
});
