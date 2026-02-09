import { SyncEngine } from '../sync/sync-engine.js';
import { EventEmitter } from 'events';
// import axios from 'axios';

export class CollaborationBridgePlugin extends EventEmitter {
    private syncEngine: SyncEngine;
    private editorUrl: string;

    constructor(syncEngine: SyncEngine, editorUrl: string = 'http://localhost:9980') {
        super();
        this.syncEngine = syncEngine;
        this.editorUrl = editorUrl;
    }

    async start(): Promise<void> {
        console.log('[CollaborationBridge] Starting bridge to OnlyOffice at', this.editorUrl);

        // Subscribe to task updates which might contain artifact changes
        this.syncEngine.on('task_updated', async (data) => {
            if (data.updates.artifacts) {
                console.log('[CollaborationBridge] Artifacts updated for task', data.taskId, '- pushing to editor');
                await this.syncWithEditor(data.taskId, data.updates.artifacts);
            }
        });
    }

    // private async syncWithEditor(_taskId: string, artifacts: any[]): Promise<void> {
    private async syncWithEditor(_taskId: string, _artifacts: any[]): Promise<void> {
        // Logic to push artifact metadata to OnlyOffice callback or storage
        // For now, we log the attempt. In a real scenario, we'd use the OnlyOffice Command API.
        try {
            for (const artifact of _artifacts) {
                if (this.isEditable(artifact.name)) {
                    console.log(`[CollaborationBridge] Tracking editable artifact: ${artifact.name}`);
                    // Mock call to OnlyOffice API
                    // await axios.post(`${this.editorUrl}/track`, { taskId, artifact });
                }
            }
        } catch (err) {
            console.error('[CollaborationBridge] Failed to sync with editor:', err);
        }
    }

    private isEditable(fileName: string): boolean {
        const editableExtensions = ['.docx', '.xlsx', '.pptx', '.txt', '.csv'];
        return editableExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
    }

    public getEditorConfig(taskId: string, fileName: string, userBaseUrl: string) {
        if (!this.isEditable(fileName)) return null;

        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        const key = Buffer.from(`${taskId}-${fileName}`).toString('base64'); // Simple stable key

        return {
            document: {
                fileType: ext,
                key: key,
                title: fileName,
                url: `${userBaseUrl}/api/artifacts/${taskId}/${fileName}`,
                permissions: {
                    edit: true,
                    download: true
                }
            },
            editorConfig: {
                callbackUrl: `${userBaseUrl}/api/editor/callback?taskId=${taskId}&fileName=${fileName}`,
                user: {
                    id: "user-system",
                    name: "OpenCoworker User"
                },
                mode: "edit",
                lang: "en",
                customization: {
                    forcesave: true
                }
            },
            documentType: this.getDocumentType(ext)
        };
    }

    private getDocumentType(ext: string): string {
        if (['doc', 'docx', 'txt'].includes(ext)) return 'text';
        if (['xls', 'xlsx', 'csv'].includes(ext)) return 'spreadsheet';
        if (['ppt', 'pptx'].includes(ext)) return 'presentation';
        return 'text';
    }
}
