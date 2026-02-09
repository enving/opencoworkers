
import { IStorageProvider, StorageConfig } from './types.js';
import { PosixStorageProvider } from './providers/posix.js';
import { WebDavStorageProvider } from './providers/webdav.js';

export class ArtifactManager {
    private provider: IStorageProvider;

    constructor(config?: StorageConfig) {
        if (config?.type === 'webdav' && config.webdav) {
            this.provider = new WebDavStorageProvider(
                config.webdav.url,
                config.webdav.username,
                config.webdav.password
            );
        } else {
            this.provider = new PosixStorageProvider(config?.rootPath || '.agent-config/artifacts');
        }
    }

    async init() {
        await this.provider.initialize();
    }

    async saveArtifact(taskId: string, fileName: string, content: Buffer): Promise<string | null> {
        const filePath = `/${taskId}/${fileName}`;
        const success = await this.provider.writeFile(filePath, content);

        if (success && this.provider.getPublicUrl) {
            return await this.provider.getPublicUrl(filePath);
        }

        return success ? filePath : null;
    }

    async listArtifacts(taskId: string): Promise<string[]> {
        return await this.provider.list(`/${taskId}`);
    }

    async getArtifact(taskId: string, fileName: string): Promise<Buffer | null> {
        return await this.provider.readFile(`/${taskId}/${fileName}`);
    }
}
