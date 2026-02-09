import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export class RulesManager {
    private static GLOBAL_AGENTS_MD = path.join(os.homedir(), '.config', 'opencode', 'AGENTS.md');
    private static PROJECT_AGENTS_MD = path.join(process.cwd(), '.opencode', 'AGENTS.md');

    async getAgentsMd(isGlobal: boolean = false): Promise<{ content: string, path: string }> {
        const filePath = isGlobal ? RulesManager.GLOBAL_AGENTS_MD : RulesManager.PROJECT_AGENTS_MD;
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return { content, path: filePath };
        } catch {
            return { content: '', path: filePath };
        }
    }

    async saveAgentsMd(content: string, isGlobal: boolean = false): Promise<void> {
        const filePath = isGlobal ? RulesManager.GLOBAL_AGENTS_MD : RulesManager.PROJECT_AGENTS_MD;
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, 'utf-8');
    }

    getTemplate(): string {
        return `# Agent Instructions Template

## Core Principles
- Be concise and accurate.
- Always check the workspace state before making changes.

## Workflow
1. Plan
2. Execute
3. Verify
`;
    }
}
