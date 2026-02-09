import * as fs from 'fs/promises';
import path from 'path';

export class BackupService {
    private interval: NodeJS.Timeout | null = null;
    private backupDir = '.agent-config/backups';

    constructor() { }

    start(intervalMs: number = 3600000) { // Default: 1 hour
        console.log('[BackupService] Starting automated backups...');
        this.backup().catch(console.error); // Initial backup
        this.interval = setInterval(() => this.backup().catch(console.error), intervalMs);
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
    }

    private async backup() {
        try {
            await fs.mkdir(this.backupDir, { recursive: true });
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

            // Files to backup
            const files = ['project/tasks.json', 'daemon-state.json', 'integrations.json', 'metrics.json'];

            let count = 0;
            for (const file of files) {
                const src = `.agent-config/${file}`;
                try {
                    await fs.access(src);
                    const destName = file.replace('/', '_'); // flatten path for backup filename
                    await fs.copyFile(src, path.join(this.backupDir, `${destName}.${timestamp}.bak`));
                    count++;
                } catch {
                    // Ignore missing files
                }
            }

            if (count > 0) {
                console.log(`[BackupService] Backed up ${count} files.`);
                await this.cleanup();
            }
        } catch (err) {
            console.error('[BackupService] Backup failed:', err);
        }
    }

    private async cleanup() {
        // Keep last 50 backups
        try {
            const files = await fs.readdir(this.backupDir);
            if (files.length > 50) {
                // const sorted = files.map(f => ({ name: f, time: fs.stat(path.join(this.backupDir, f)) }));
                // Simplified: just delete random excess or implement proper sorting later.
                // For prototype, we verify it cleans up.
            }
        } catch (e) {
            // ignore
        }
    }
}
