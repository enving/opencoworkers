/**
 * Memories API - FEAT-MEMORIES
 * 
 * Data definitions and API client for the Agent Memory System (RAG).
 */

const API_BASE = '/api';

export interface MemoryEntry {
    taskId: string;
    agentId: string;
    timestamp: string;
    category: string;
    content: string;
    tags: string[];
}

export interface MemorySearchParams {
    search?: string;
    category?: string;
    agentId?: string;
    tags?: string; // Comma separated
    limit?: number;
}

export const memoriesApi = {
    /**
     * Search/Retrieve memories based on criteria
     */
    async search(params: MemorySearchParams): Promise<MemoryEntry[]> {
        const query = new URLSearchParams();
        if (params.search) query.set('search', params.search);
        if (params.category) query.set('category', params.category);
        if (params.agentId) query.set('agentId', params.agentId);
        if (params.tags) query.set('tags', params.tags);
        if (params.limit) query.set('limit', String(params.limit));

        const res = await fetch(`${API_BASE}/memories?${query.toString()}`);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to fetch memories');
        }
        const data = await res.json();
        return data.memories;
    },

    /**
     * Manually add a memory entry
     */
    async add(entry: {
        agentId: string;
        content: string;
        category?: string;
        tags?: string[];
        taskId?: string;
    }): Promise<void> {
        const res = await fetch(`${API_BASE}/memories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to add memory');
        }
    }
};
