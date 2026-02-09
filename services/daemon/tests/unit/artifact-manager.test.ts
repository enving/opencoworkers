import { jest, describe, it, expect, afterEach } from '@jest/globals';

// Mock providers MUST be before dynamic imports
jest.unstable_mockModule('../../storage/providers/posix.js', () => ({
    PosixStorageProvider: jest.fn().mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(undefined as never),
        writeFile: jest.fn().mockResolvedValue(true as never),
        readFile: jest.fn().mockResolvedValue(Buffer.from('hello') as never),
        list: jest.fn().mockResolvedValue(['file1.txt'] as never)
    }))
}));

jest.unstable_mockModule('../../storage/providers/webdav.js', () => ({
    WebDavStorageProvider: jest.fn().mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(undefined as never),
        writeFile: jest.fn().mockResolvedValue(true as never),
        readFile: jest.fn().mockResolvedValue(Buffer.from('remote hello') as never),
        list: jest.fn().mockResolvedValue(['remote1.txt'] as never),
        getPublicUrl: jest.fn().mockResolvedValue('https://cloud.example.com/share/123' as never)
    }))
}));

const { PosixStorageProvider }: any = await import('../../storage/providers/posix.js');
const { WebDavStorageProvider }: any = await import('../../storage/providers/webdav.js');
const { ArtifactManager }: any = await import('../../storage/artifact-manager.js');

describe('ArtifactManager', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should use PosixStorageProvider by default', async () => {
        const manager = new ArtifactManager();
        await manager.init();
        expect(PosixStorageProvider).toHaveBeenCalled();
    });

    it('should use WebDavStorageProvider when configured', async () => {
        const config = {
            type: 'webdav' as const,
            webdav: {
                url: 'https://cloud.example.com',
                username: 'user',
                password: 'pass'
            }
        };
        const manager = new ArtifactManager(config);
        await manager.init();
        expect(WebDavStorageProvider).toHaveBeenCalledWith(
            'https://cloud.example.com',
            'user',
            'pass'
        );
    });

    it('should return public URL if provider supports it', async () => {
        const config = {
            type: 'webdav' as const,
            webdav: { url: 'https://cloud.example.com' }
        };
        const manager = new ArtifactManager(config);
        const url = await manager.saveArtifact('task-1', 'test.pptx', Buffer.from('data'));

        expect(url).toBe('https://cloud.example.com/share/123');
    });

    it('should return internal path if no public URL available', async () => {
        const manager = new ArtifactManager({ type: 'posix', rootPath: '/tmp' });
        const path = await manager.saveArtifact('task-1', 'test.pptx', Buffer.from('data'));

        expect(path).toBe('/task-1/test.pptx');
    });
});

export { }; // Ensure it's a module
