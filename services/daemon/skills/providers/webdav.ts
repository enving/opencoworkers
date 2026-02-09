import { ISkillProvider, SkillMetadata } from '../types.js';
import { createClient, WebDAVClient } from 'webdav';

export class WebDavSkillProvider implements ISkillProvider {
    private client: WebDAVClient;
    private basePath: string;

    constructor(url: string, username?: string, password?: string, basePath: string = '/Skills') {
        this.client = createClient(
            url,
            {
                username,
                password
            }
        );
        this.basePath = basePath;
    }

    async initialize(): Promise<void> {
        try {
            if (!(await this.client.exists(this.basePath))) {
                await this.client.createDirectory(this.basePath);
            }
        } catch (err) {
            console.error('[WebDavSkillProvider] Failed to initialize:', err);
            // Don't throw - maybe disconnected, stick to cache if implemented
        }
    }

    async discover(): Promise<SkillMetadata[]> {
        try {
            const items = await this.client.getDirectoryContents(this.basePath) as any[];
            const skillDirs = items.filter(i => i.type === 'directory');
            const results: SkillMetadata[] = [];

            for (const dir of skillDirs) {
                const metadata = await this.loadSkillMetadata(dir.basename);
                if (metadata) {
                    results.push(metadata);
                }
            }
            return results;
        } catch (err) {
            console.error('[WebDavSkillProvider] Discovery failed:', err);
            return [];
        }
    }

    async getFileContent(skillName: string, fileName: string): Promise<Buffer | null> {
        try {
            const remotePath = `${this.basePath}/${skillName}/${fileName}`;
            const content = await this.client.getFileContents(remotePath, { format: 'binary' });
            return Buffer.from(content as any);
        } catch (err) {
            console.error(`[WebDavSkillProvider] Failed to get content for ${skillName}/${fileName}:`, err);
            return null;
        }
    }

    async saveSkill(skillName: string, files: Map<string, Buffer>): Promise<boolean> {
        try {
            const skillDir = `${this.basePath}/${skillName}`;

            if (!(await this.client.exists(skillDir))) {
                await this.client.createDirectory(skillDir);
            }

            for (const [fileName, content] of files.entries()) {
                const remotePath = `${skillDir}/${fileName}`;
                await this.client.putFileContents(remotePath, content);
            }
            return true;
        } catch (err) {
            console.error('[WebDavSkillProvider] Failed to save skill:', err);
            return false;
        }
    }

    private async loadSkillMetadata(skillName: string): Promise<SkillMetadata | null> {
        try {
            const skillDocPath = `${this.basePath}/${skillName}/SKILL.md`;
            const content = (await this.client.getFileContents(skillDocPath, { format: 'text' })) as string;

            const nameMatch = content.match(/#\s+(.+)/);
            const descMatch = content.match(/Description:\s*(.+)/i);

            const commands: string[] = [];
            const commandRegex = /-\s+`(\/\w+)`/g;
            let match;
            while ((match = commandRegex.exec(content)) !== null) {
                if (match[1]) {
                    commands.push(match[1]);
                }
            }

            const name = nameMatch && nameMatch[1] ? nameMatch[1].trim() : skillName;
            const description = descMatch && descMatch[1] ? descMatch[1].trim() : 'No description provided';

            return {
                name,
                description,
                commands,
                scope: 'team',
                path: `webdav://${skillName}` // Virtual path
            };
        } catch (err) {
            // console.warn(`[WebDav] No SKILL.md found for ${skillName}`);
            return null;
        }
    }
}
