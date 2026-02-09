import * as fs from 'fs/promises';
import * as path from 'path';
import { ISkillProvider, SkillMetadata } from '../types.js';

export class PosixSkillProvider implements ISkillProvider {
    private skillDir: string;

    constructor(workspaceRoot: string = process.cwd()) {
        this.skillDir = path.join(workspaceRoot, 'runtime-data/Skills');
    }

    async initialize(): Promise<void> {
        try {
            await fs.access(this.skillDir);
        } catch {
            await fs.mkdir(this.skillDir, { recursive: true });
        }
    }

    async discover(): Promise<SkillMetadata[]> {
        try {
            await this.initialize();
            const entries = await fs.readdir(this.skillDir, { withFileTypes: true });
            const skillDirs = entries.filter(e => e.isDirectory());

            const results: SkillMetadata[] = [];

            for (const dir of skillDirs) {
                const metadata = await this.loadSkillMetadata(dir.name);
                if (metadata) {
                    results.push(metadata);
                }
            }
            return results;
        } catch (err) {
            console.error('[PosixSkillProvider] Discovery failed:', err);
            return [];
        }
    }

    async getFileContent(skillName: string, fileName: string): Promise<Buffer | null> {
        try {
            const filePath = path.join(this.skillDir, skillName, fileName);
            return await fs.readFile(filePath);
        } catch {
            return null;
        }
    }

    async saveSkill(skillName: string, files: Map<string, Buffer>): Promise<boolean> {
        try {
            const targetDir = path.join(this.skillDir, skillName);
            await fs.mkdir(targetDir, { recursive: true });

            for (const [fileName, content] of files.entries()) {
                const filePath = path.join(targetDir, fileName);
                await fs.mkdir(path.dirname(filePath), { recursive: true });
                await fs.writeFile(filePath, content);
            }
            return true;
        } catch (err) {
            console.error('[PosixSkillProvider] Failed to save skill:', err);
            return false;
        }
    }

    private async loadSkillMetadata(skillName: string): Promise<SkillMetadata | null> {
        const skillPath = path.join(this.skillDir, skillName);
        const skillDocPath = path.join(skillPath, 'SKILL.md');

        try {
            const content = await fs.readFile(skillDocPath, 'utf-8');

            const nameMatch = content.match(/name:\s*(.+)/);
            const descMatch = content.match(/description:\s*(.+)/i);

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
                path: skillPath
            };
        } catch {
            return null;
        }
    }
}
