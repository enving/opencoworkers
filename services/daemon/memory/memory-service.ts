import * as fs from 'fs/promises';
import path from 'path';
import { AuditLogger } from '../orchestration/audit-trail.js';
import { ChromaClient, Collection } from 'chromadb';
import { pipeline } from '@xenova/transformers';

export interface MemoryEntry {
  taskId: string;
  agentId: string;
  timestamp: string;
  category: string;
  content: string;
  tags: string[];
}

export class MemoryService {
  private memoryDir: string;
  private auditLogger: AuditLogger;
  private chromaPromise: Promise<ChromaClient | null>;
  private collection: Collection | null = null;
  private embedder: any = null;
  private chromaUrl: string;

  constructor(memoryDir: string = '.agent-config/memory') {
    this.memoryDir = memoryDir;
    this.auditLogger = new AuditLogger();
    this.chromaUrl = process.env.CHROMA_URL || 'http://localhost:7854';

    // Initialize Chroma client lazily
    this.chromaPromise = this.initChroma();
  }

  private async initChroma(): Promise<ChromaClient | null> {
    try {
      // Load embedding model
      console.log('[Memory] Loading embedding model...');
      this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      console.log('[Memory] Embedding model loaded.');

      const client = new ChromaClient({ path: this.chromaUrl });

      // Test connection
      const heartbeat = await client.heartbeat();
      console.log(`[Memory] ChromaDB connected (heartbeat: ${heartbeat})`);

      // Get or create collection
      this.collection = await client.getOrCreateCollection({
        name: "agent_memory",
        metadata: { "hnsw:space": "cosine" }
      });

      return client;
    } catch (err) {
      console.warn('[Memory] Failed to connect to ChromaDB or load embedding model. Running in file-only mode.', err);
      return null;
    }
  }

  async init(): Promise<void> {
    try {
      await fs.mkdir(this.memoryDir, { recursive: true });
      // Ensure chroma is initialized
      await this.chromaPromise;
    } catch (err) {
      console.error(`[Memory] Failed to initialize memory directory: ${this.memoryDir}`, err);
    }
  }

  private async getEmbedding(text: string): Promise<number[] | null> {
    if (!this.embedder) return null;
    try {
      const output = await this.embedder(text, { pooling: 'mean', normalize: true });
      return Array.from(output.data);
    } catch (err) {
      console.error('[Memory] Embedding generation failed:', err);
      return null;
    }
  }

  async store(entry: Omit<MemoryEntry, 'timestamp'>): Promise<void> {
    const fullEntry: MemoryEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    };

    const id = `${fullEntry.agentId}-${Date.now()}`;
    const fileName = `${id}.json`;
    const filePath = path.join(this.memoryDir, fileName);

    try {
      // 1. Store to File (Backup/Log)
      await fs.writeFile(filePath, JSON.stringify(fullEntry, null, 2));
      await this.auditLogger.logAction({
        agentId: entry.agentId,
        taskId: entry.taskId,
        action: 'store-memory',
        details: { category: entry.category, tags: entry.tags, vectorStore: !!this.collection },
        result: 'success'
      });

      // 2. Store to Vector DB
      if (this.collection) {
        const embedding = await this.getEmbedding(fullEntry.content);
        if (embedding) {
          await this.collection.add({
            ids: [id],
            embeddings: [embedding],
            metadatas: [{
              taskId: fullEntry.taskId,
              agentId: fullEntry.agentId,
              category: fullEntry.category,
              timestamp: fullEntry.timestamp,
              tags: fullEntry.tags.join(','),
              source: 'memory-service'
            }],
            documents: [fullEntry.content]
          });
          // console.log(`[Memory] Stored vector for ${id}`);
        }
      }
    } catch (err) {
      console.error(`[Memory] Failed to store memory for task ${entry.taskId}:`, err);
    }
  }

  async retrieve(query: { agentId?: string; tags?: string[]; category?: string; search?: string; limit?: number }): Promise<MemoryEntry[]> {
    try {
      let vectorResults: MemoryEntry[] = [];
      const limit = query.limit || 10;

      // 1. Vector Search
      if (this.collection && query.search) {
        const embedding = await this.getEmbedding(query.search);
        if (embedding) {
          const results = await this.collection.query({
            queryEmbeddings: [embedding],
            nResults: limit,
            where: query.category ? { category: query.category } : undefined
          });

          if (results.ids.length > 0 && results.ids[0]) {
            vectorResults = results.ids[0].map((_id, index) => {
              const meta = results.metadatas?.[0]?.[index] || {};
              const doc = results.documents?.[0]?.[index] || '';
              return {
                taskId: (meta.taskId as string) || 'unknown',
                agentId: (meta.agentId as string) || 'unknown',
                timestamp: (meta.timestamp as string) || new Date().toISOString(),
                category: (meta.category as string) || 'general',
                tags: ((meta.tags as string) || '').split(',').filter(Boolean),
                content: doc
              };
            });
          }
        }
      }

      // 2. File Fallback (if vector search didn't run or we just need filtering)
      // For now, if we have vector results, return them. 
      // If no search query, fall back to file scan.
      if (query.search && vectorResults.length > 0) {
        return vectorResults;
      }

      // Simple file scan logic (existing)
      const files = await fs.readdir(this.memoryDir);
      const entries: MemoryEntry[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(this.memoryDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const entry: MemoryEntry = JSON.parse(content);

        let match = true;
        if (query.agentId && entry.agentId !== query.agentId) match = false;
        if (query.category && entry.category !== query.category) match = false;
        if (query.tags && !query.tags.every(tag => entry.tags.includes(tag))) match = false;

        // Basic text search if vector search unavailable
        if (query.search && !entry.content.toLowerCase().includes(query.search.toLowerCase())) match = false;

        if (match) {
          entries.push(entry);
        }
      }

      return entries
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);

    } catch (err) {
      console.error(`[Memory] Failed to retrieve memory:`, err);
      return [];
    }
  }
}
