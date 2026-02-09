
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies
const mockBridge = {
    registerMcpServer: jest.fn().mockResolvedValue(true),
    on: jest.fn()
};

const mockWatcher = {};
const mockAdapter = {};

// Mock modules
jest.unstable_mockModule('../../server/bridge.js', () => ({
    OpenCodeServerBridge: jest.fn().mockImplementation(() => mockBridge)
}));

jest.unstable_mockModule('../../server/ssh-tunnel.js', () => ({
    SSHTunnelManager: jest.fn()
}));

jest.unstable_mockModule('../../server/backup-service.js', () => ({
    BackupService: jest.fn().mockImplementation(() => ({ start: jest.fn() }))
}));

jest.unstable_mockModule('../../plugins/collab-bridge.js', () => ({
    CollaborationBridgePlugin: jest.fn().mockImplementation(() => ({ start: jest.fn() }))
}));

jest.unstable_mockModule('fs/promises', () => ({
    readFile: jest.fn().mockImplementation(async (path: string) => {
        if (path.includes('mcp.json')) {
            return JSON.stringify({
                mcpServers: {
                    webdav: {
                        command: ['npx', 'tsx', 'webdav.ts'],
                        env: {}
                    }
                }
            });
        }
        return '{}';
    })
}));

const { SyncEngine } = await import('../../sync/sync-engine.js');

describe('SyncEngine WebDAV MCP Injection', () => {
    let syncEngine: any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should inject WebDAV credentials into MCP config', async () => {
        const fullConfig = {
            storage: {
                webdav: {
                    url: 'https://test.nextcloud.com',
                    username: 'admin',
                    password: 'secret_password'
                }
            },
            daemon: { webhook: { enabled: false } }, // prevent webhook server start
            server: { baseUrl: 'http://localhost' }
        };

        syncEngine = new SyncEngine(mockWatcher, mockAdapter, { fullConfig });

        // Mock internal implementation relying on config
        // access private method or just run bootstrap
        await syncEngine.bootstrapMcpServers();

        expect(mockBridge.registerMcpServer).toHaveBeenCalledWith(
            'webdav',
            expect.objectContaining({
                env: expect.objectContaining({
                    WEBDAV_URL: 'https://test.nextcloud.com',
                    WEBDAV_USER: 'admin',
                    WEBDAV_PASS: 'secret_password'
                })
            })
        );

        console.log('✅ WebDAV Credentials successfully injected into Agent MCP!');
    });
});
