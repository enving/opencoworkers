
import { EventEmitter } from 'events';
import { WebDavStorageProvider } from '../storage/providers/webdav.js';

export interface WatcherConfig {
    intervalMs?: number;
}

export class NextcloudWatcher extends EventEmitter {
    private provider: WebDavStorageProvider;
    private watchedFiles: Map<string, { etag: string, lastmod: string }> = new Map();
    private timer: NodeJS.Timeout | null = null;
    private intervalMs: number;

    constructor(provider: WebDavStorageProvider, config: WatcherConfig = {}) {
        super();
        this.provider = provider;
        this.intervalMs = config.intervalMs || 30000; // 30s default
    }

    public watch(filePath: string) {
        if (this.watchedFiles.has(filePath)) return;
        this.watchedFiles.set(filePath, { etag: '', lastmod: '' });
        console.log(`[NextcloudWatcher] Started watching ${filePath}`);

        // Initial stat to baseline
        this.checkFile(filePath).catch(() => { });
    }

    public unwatch(filePath: string) {
        this.watchedFiles.delete(filePath);
        console.log(`[NextcloudWatcher] Stopped watching ${filePath}`);
    }

    public start() {
        if (this.timer) return;
        console.log(`[NextcloudWatcher] Starting poll loop (Interval: ${this.intervalMs}ms)`);
        this.timer = setInterval(() => this.poll(), this.intervalMs);
    }

    public stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    private async poll() {
        for (const filePath of this.watchedFiles.keys()) {
            await this.checkFile(filePath);
        }
    }

    private async checkFile(filePath: string) {
        const stat = await this.provider.getStat(filePath);
        if (!stat) return; // File might rely unavailable

        const current = this.watchedFiles.get(filePath);
        if (!current) return;

        // If it's the first check (empty baseline), just update
        if (!current.etag && !current.lastmod) {
            this.watchedFiles.set(filePath, { etag: stat.etag, lastmod: stat.lastmod });
            return;
        }

        if (stat.etag !== current.etag || stat.lastmod !== current.lastmod) {
            console.log(`[NextcloudWatcher] Change detected in ${filePath}`);
            this.watchedFiles.set(filePath, { etag: stat.etag, lastmod: stat.lastmod });
            this.emit('change', { path: filePath, stat });
        }
    }
}
