import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface ConfigBackup {
    id: string;
    timestamp: string;
    description: string;
    opencode: any;
    omo: any;
}

export interface ValidationError {
    field: string;
    message: string;
    fixable: boolean;
}

export interface ExternalConfig {
    source: string;
    name: string;
    path: string;
    detected: boolean;
}

export class BackupManager {
    private backupDir: string;

    constructor(baseDir: string = '.agent-config') {
        this.backupDir = path.join(baseDir, 'backups');
    }

    async ensureBackupDir(): Promise<void> {
        await fs.mkdir(this.backupDir, { recursive: true });
    }

    async listBackups(): Promise<Array<{ id: string; timestamp: string; description: string }>> {
        await this.ensureBackupDir();
        try {
            const files = await fs.readdir(this.backupDir);
            const backups: Array<{ id: string; timestamp: string; description: string }> = [];

            for (const file of files) {
                if (!file.endsWith('.json')) continue;
                try {
                    const content = await fs.readFile(path.join(this.backupDir, file), 'utf-8');
                    const backup = JSON.parse(content) as ConfigBackup;
                    backups.push({
                        id: backup.id,
                        timestamp: backup.timestamp,
                        description: backup.description
                    });
                } catch { /* skip invalid files */ }
            }

            return backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        } catch {
            return [];
        }
    }

    async createBackup(opencode: any, omo: any, description?: string): Promise<{ success: boolean; backupId: string }> {
        await this.ensureBackupDir();
        const id = `backup-${Date.now()}`;
        const backup: ConfigBackup = {
            id,
            timestamp: new Date().toISOString(),
            description: description || `Backup at ${new Date().toLocaleString()}`,
            opencode,
            omo
        };

        await fs.writeFile(
            path.join(this.backupDir, `${id}.json`),
            JSON.stringify(backup, null, 2),
            'utf-8'
        );

        return { success: true, backupId: id };
    }

    async restoreBackup(backupId: string): Promise<{ success: boolean; opencode: any; omo: any } | { success: false; error: string }> {
        try {
            const content = await fs.readFile(path.join(this.backupDir, `${backupId}.json`), 'utf-8');
            const backup = JSON.parse(content) as ConfigBackup;
            return { success: true, opencode: backup.opencode, omo: backup.omo };
        } catch (err) {
            return { success: false, error: (err as Error).message };
        }
    }

    async deleteBackup(backupId: string): Promise<{ success: boolean }> {
        try {
            await fs.unlink(path.join(this.backupDir, `${backupId}.json`));
            return { success: true };
        } catch {
            return { success: false };
        }
    }
}

export class ConfigValidator {
    validateOpencode(config: any): ValidationError[] {
        const errors: ValidationError[] = [];

        if (!config || typeof config !== 'object') {
            errors.push({ field: 'root', message: 'Config must be an object', fixable: true });
            return errors;
        }

        // Check provider section
        if (config.provider && typeof config.provider !== 'object') {
            errors.push({ field: 'provider', message: 'provider must be an object', fixable: true });
        }

        // Check model section
        if (config.model && typeof config.model !== 'object') {
            errors.push({ field: 'model', message: 'model must be an object', fixable: true });
        }

        // Check MCP section
        if (config.mcp && typeof config.mcp !== 'object') {
            errors.push({ field: 'mcp', message: 'mcp must be an object', fixable: true });
        } else if (config.mcp) {
            for (const [key, value] of Object.entries(config.mcp)) {
                if (typeof value !== 'object') {
                    errors.push({ field: `mcp.${key}`, message: `MCP server ${key} must be an object`, fixable: false });
                }
            }
        }

        // Check agent section
        if (config.agent && typeof config.agent !== 'object') {
            errors.push({ field: 'agent', message: 'agent must be an object', fixable: true });
        }

        // Check permission section
        if (config.permission && typeof config.permission !== 'object') {
            errors.push({ field: 'permission', message: 'permission must be an object', fixable: true });
        }

        return errors;
    }

    validateOmo(config: any): ValidationError[] {
        const errors: ValidationError[] = [];

        if (!config || typeof config !== 'object') {
            errors.push({ field: 'root', message: 'OMO config must be an object', fixable: true });
            return errors;
        }

        // Check agents section
        if (config.agents && typeof config.agents !== 'object') {
            errors.push({ field: 'agents', message: 'agents must be an object', fixable: true });
        }

        return errors;
    }

    autoFix(opencode: any, omo: any): { opencode: any; omo: any; fixedIssues: string[] } {
        const fixedIssues: string[] = [];
        let fixedOpencode = opencode || {};
        let fixedOmo = omo || {};

        // Fix non-object types
        if (typeof fixedOpencode !== 'object') {
            fixedOpencode = {};
            fixedIssues.push('Reset invalid opencode config to empty object');
        }

        if (typeof fixedOmo !== 'object') {
            fixedOmo = {};
            fixedIssues.push('Reset invalid omo config to empty object');
        }

        // Initialize required sections
        const requiredSections = ['provider', 'model', 'mcp', 'agent', 'permission'];
        for (const section of requiredSections) {
            if (fixedOpencode[section] && typeof fixedOpencode[section] !== 'object') {
                fixedOpencode[section] = {};
                fixedIssues.push(`Reset invalid ${section} section to empty object`);
            }
        }

        if (fixedOmo.agents && typeof fixedOmo.agents !== 'object') {
            fixedOmo.agents = {};
            fixedIssues.push('Reset invalid omo agents section to empty object');
        }

        return { opencode: fixedOpencode, omo: fixedOmo, fixedIssues };
    }
}

export class ExternalConfigImporter {
    private static EXTERNAL_CONFIGS: Array<{ source: string; name: string; paths: string[] }> = [
        {
            source: 'claude-code',
            name: 'Claude Code',
            paths: [
                path.join(os.homedir(), '.claude', 'claude_desktop_config.json'),
                path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
            ]
        },
        {
            source: 'codex',
            name: 'Codex',
            paths: [
                path.join(os.homedir(), '.codex', 'config.json'),
                path.join(os.homedir(), '.config', 'codex', 'config.json')
            ]
        },
        {
            source: 'gemini',
            name: 'Gemini Code Assist',
            paths: [
                path.join(os.homedir(), '.config', 'gemini', 'config.json')
            ]
        },
        {
            source: 'cc-switch',
            name: 'CC-Switch',
            paths: [
                path.join(os.homedir(), '.cc-switch', 'config.json')
            ]
        },
        {
            source: 'cursor',
            name: 'Cursor',
            paths: [
                path.join(os.homedir(), '.cursor', 'settings.json'),
                path.join(os.homedir(), 'Library', 'Application Support', 'Cursor', 'User', 'settings.json')
            ]
        },
        {
            source: 'windsurf',
            name: 'Windsurf',
            paths: [
                path.join(os.homedir(), '.windsurf', 'config.json')
            ]
        }
    ];

    async detectAll(): Promise<ExternalConfig[]> {
        const results: ExternalConfig[] = [];

        for (const config of ExternalConfigImporter.EXTERNAL_CONFIGS) {
            let detectedPath: string | null = null;

            for (const p of config.paths) {
                try {
                    await fs.access(p);
                    detectedPath = p;
                    break;
                } catch { /* continue */ }
            }

            results.push({
                source: config.source,
                name: config.name,
                path: detectedPath || config.paths[0] || '',
                detected: detectedPath !== null
            });
        }

        return results;
    }

    async importConfig(source: string): Promise<{ success: boolean; imported?: any; error?: string }> {
        const configDef = ExternalConfigImporter.EXTERNAL_CONFIGS.find(c => c.source === source);
        if (!configDef) return { success: false, error: 'Unknown config source' };

        for (const p of configDef.paths) {
            try {
                const content = await fs.readFile(p, 'utf-8');
                const config = JSON.parse(content);

                // Transform based on source
                const imported = this.transformConfig(source, config);
                return { success: true, imported };
            } catch { /* try next path */ }
        }

        return { success: false, error: `Could not find ${configDef.name} config file` };
    }

    private transformConfig(source: string, config: any): any {
        // Transform external configs to OpenCode format
        switch (source) {
            case 'claude-code':
                return this.transformClaudeCode(config);
            case 'cursor':
                return this.transformCursor(config);
            default:
                // Return as-is for unknown formats
                return { raw: config, source };
        }
    }

    private transformClaudeCode(config: any): any {
        const result: any = { provider: {}, mcp: {} };

        // Extract MCP servers from Claude desktop config
        if (config.mcpServers) {
            for (const [name, server] of Object.entries(config.mcpServers)) {
                const srv = server as any;
                if (srv.command) {
                    result.mcp[name] = {
                        type: 'local',
                        command: srv.command,
                        args: srv.args || [],
                        env: srv.env || {}
                    };
                }
            }
        }

        return result;
    }

    private transformCursor(config: any): any {
        const result: any = {};

        // Extract relevant settings from Cursor
        if (config['ai.provider']) {
            result.provider = { cursor: { type: config['ai.provider'] } };
        }

        return result;
    }
}
