import { promises as fs } from 'fs';
import * as path from 'path';

export interface OpenCodeConfig {
    agent: Record<string, any>;
    mode?: any;
    plugin?: any[];
    [key: string]: any;
}

export interface OMOConfig {
    agents: Record<string, any>;
    [key: string]: any;
}

export class ConfigManager {
    private configQueue: Promise<void> = Promise.resolve();
    private opencodeConfigPath: string;
    private omoConfigPath: string;

    constructor(
        baseDir: string = '.agent-config'
    ) {
        this.opencodeConfigPath = path.join(baseDir, 'opencode.json');
        this.omoConfigPath = path.join(baseDir, 'oh-my-opencode.json');
    }

    private async enqueue<T>(task: () => Promise<T>): Promise<T> {
        let resolve!: (val: T) => void;
        let reject!: (err: any) => void;
        const promise = new Promise<T>((res, rej) => {
            resolve = res;
            reject = rej;
        });

        const currentQueue = this.configQueue;
        this.configQueue = (async () => {
            await currentQueue.catch(() => { });
            try {
                const result = await task();
                resolve(result);
            } catch (err) {
                reject(err);
            }
        })();

        return promise;
    }

    async loadConfigs(): Promise<{ opencode: OpenCodeConfig; omo: OMOConfig }> {
        return this.enqueue(async () => {
            const opencode = await this.readJsonFile<OpenCodeConfig>(this.opencodeConfigPath, { agent: {} });
            const omo = await this.readJsonFile<OMOConfig>(this.omoConfigPath, { agents: {} });

            // Python Logic Adoption: Ensure necessary structures exist
            if (!opencode.agent) opencode.agent = {};
            if (!omo.agents) omo.agents = {};

            return { opencode, omo };
        });
    }

    async saveConfigs(opencode: OpenCodeConfig, omo: OMOConfig): Promise<void> {
        return this.enqueue(async () => {
            await this.writeJsonFile(this.opencodeConfigPath, opencode);
            await this.writeJsonFile(this.omoConfigPath, omo);
        });
    }

    private async readJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(content) as T;
        } catch (err: any) {
            if (err.code === 'ENOENT') {
                // Return default if file doesn't exist, maybe create it?
                // For now, return default.
                return defaultValue;
            }
            console.error(`[ConfigManager] Failed to read ${filePath}:`, err);
            return defaultValue;
        }
    }

    private async writeJsonFile(filePath: string, data: any): Promise<void> {
        try {
            // Ensure directory exists
            await fs.mkdir(path.dirname(filePath), { recursive: true });

            // Write to temp file first for atomic-ish save
            const tempPath = `${filePath}.tmp`;
            await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
            await fs.rename(tempPath, filePath);
        } catch (err) {
            console.error(`[ConfigManager] Failed to save ${filePath}:`, err);
            throw err;
        }
    }
}
