
import { createClient, WebDAVClient } from 'webdav';
import { IStorageProvider } from '../types.js';

export class WebDavStorageProvider implements IStorageProvider {
    private client: WebDAVClient;
    private baseUrl: string;
    private username?: string;
    private password?: string;

    constructor(url: string, username?: string, password?: string) {
        this.baseUrl = url;
        this.username = username;
        this.password = password;
        this.client = createClient(url, {
            username,
            password
        });
    }

    async initialize(): Promise<void> {
        // Test connection
        const exists = await this.client.exists('/');
        if (!exists) {
            throw new Error(`WebDAV endpoint not accessible: ${this.baseUrl}`);
        }
    }

    async readFile(filePath: string): Promise<Buffer | null> {
        try {
            const content = await this.client.getFileContents(filePath);
            return Buffer.from(content as ArrayBuffer);
        } catch (err) {
            return null;
        }
    }

    async writeFile(filePath: string, content: Buffer): Promise<boolean> {
        try {
            // Ensure parent directory exists
            const parts = filePath.split('/').filter(p => p);
            let currentPath = '';
            for (let i = 0; i < parts.length - 1; i++) {
                currentPath += '/' + parts[i];
                if (!(await this.client.exists(currentPath))) {
                    await this.client.createDirectory(currentPath);
                }
            }

            await this.client.putFileContents(filePath, content);
            return true;
        } catch (err) {
            console.error(`[WebDAVStorage] Failed to write ${filePath}:`, err);
            return false;
        }
    }

    async list(dirPath: string): Promise<string[]> {
        try {
            const contents = await this.client.getDirectoryContents(dirPath);
            return (contents as any[]).map(item => item.basename);
        } catch (err) {
            return [];
        }
    }

    async exists(pathName: string): Promise<boolean> {
        return await this.client.exists(pathName);
    }

    async getPublicUrl(filePath: string): Promise<string | null> {
        // Try Nextcloud OCS share if it looks like a Nextcloud instance
        if (this.baseUrl.includes('nextcloud') || this.baseUrl.includes('remote.php/dav')) {
            try {
                const shareUrl = await this.createNextcloudShare(filePath);
                if (shareUrl) return shareUrl;
            } catch (err) {
                console.warn('[WebDavStorage] Nextcloud share creation failed, falling back to WebDAV link');
            }
        }

        try {
            return this.client.getFileDownloadLink(filePath);
        } catch {
            return null;
        }
    }

    private async createNextcloudShare(filePath: string): Promise<string | null> {
        if (!this.username || !this.password) return null;

        // Derive OCS endpoint from WebDAV base URL
        // Example: https://cloud.com/remote.php/dav/files/user -> https://cloud.com/ocs/v2.php/...
        const urlObj = new URL(this.baseUrl);
        const ocsBase = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname.split('/remote.php')[0]}/ocs/v2.php/apps/files_sharing/api/v1/shares`;

        // Nextcloud WebDAV paths in OCS API are relative to the user root usually, 
        // but often they want the full path within the dav scope or just the relative path from the app's view.
        // Actually, for the OCS share API, 'path' is relative to the user root.

        try {
            const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
            
            // Nextcloud OCS API expects form-urlencoded data, not JSON
            const params = new URLSearchParams();
            params.append('path', filePath);
            params.append('shareType', '3'); // Public link
            params.append('permissions', '1'); // Read only

            const response = await fetch(ocsBase, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'OCS-APIRequest': 'true',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: params.toString()
            });

            if (!response.ok) {
                const text = await response.text();
                console.warn(`[WebDavStorage] OCS Share failed (${response.status}): ${text}`);
                return null;
            }

            const data: any = await response.json();
            const url = data?.ocs?.data?.url;
            if (url) {
                return url;
            } else {
                console.warn('[WebDavStorage] OCS response missing URL:', JSON.stringify(data));
                return null;
            }
        } catch (err) {
            console.error('[WebDavStorage] OCS API error:', err);
            return null;
        }
    }
    async getStat(filePath: string): Promise<{ etag: string; lastmod: string; size: number } | null> {
        try {
            const stat = await this.client.stat(filePath) as any;
            return {
                etag: stat.etag || '',
                lastmod: stat.lastmod || '',
                size: stat.size || 0
            };
        } catch (err) {
            return null;
        }
    }
}
