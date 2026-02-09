
import * as fs from 'fs/promises';
import path from 'path';
import { IStorageProvider } from '../types.js';

export class PosixStorageProvider implements IStorageProvider {
    private root: string;

    constructor(root?: string) {
        this.root = root || process.cwd();
    }

    async initialize(): Promise<void> {
        await fs.mkdir(this.root, { recursive: true });
    }

    async readFile(filePath: string): Promise<Buffer | null> {
        try {
            const fullPath = path.join(this.root, filePath);
            return await fs.readFile(fullPath);
        } catch (err) {
            return null;
        }
    }

    async writeFile(filePath: string, content: Buffer): Promise<boolean> {
        try {
            const fullPath = path.join(this.root, filePath);
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, content);
            return true;
        } catch (err) {
            console.error(`[PosixStorage] Failed to write ${filePath}:`, err);
            return false;
        }
    }

    async list(dirPath: string): Promise<string[]> {
        try {
            const fullPath = path.join(this.root, dirPath);
            return await fs.readdir(fullPath);
        } catch (err) {
            return [];
        }
    }

    async exists(pathName: string): Promise<boolean> {
        try {
            await fs.access(path.join(this.root, pathName));
            return true;
        } catch {
            return false;
        }
    }
}
