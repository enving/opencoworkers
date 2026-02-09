/**
 * Persona Runtime
 * 
 * Runtime management for assembled personas with caching and persistence.
 * Handles persona lifecycle, storage, and cleanup.
 */

import { RuntimePersona } from '../types/persona-enhanced.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Options for PersonaRuntime
 */
export interface RuntimeOptions {
  /** Storage directory for personas */
  storageDir?: string;
  /** Default TTL in hours */
  defaultTtlHours?: number;
  /** Max cache size */
  maxCacheSize?: number;
}

/**
 * Cache entry with metadata
 */
interface CacheEntry {
  persona: RuntimePersona;
  taskId?: string;
  cachedAt: Date;
}

/**
 * Runtime persona management and caching
 */
export class PersonaRuntime {
  private cache: Map<string, CacheEntry> = new Map();
  private taskIndex: Map<string, string> = new Map(); // taskId -> personaId
  private storageDir: string;
  private defaultTtlHours: number;
  private maxCacheSize: number;

  constructor(options: RuntimeOptions = {}) {
    this.storageDir = options.storageDir || '.agent-config/personas/runtime';
    this.defaultTtlHours = options.defaultTtlHours || 24;
    this.maxCacheSize = options.maxCacheSize || 100;
  }

  /**
   * Initialize the runtime (load persisted personas)
   */
  async init(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      await this.loadPersistedPersonas();
      console.log(`[PersonaRuntime] Initialized with ${this.cache.size} cached personas`);
    } catch (err) {
      console.error('[PersonaRuntime] Failed to initialize:', err);
    }
  }

  /**
   * Store a persona in cache and persist to disk
   */
  async store(persona: RuntimePersona, taskId?: string): Promise<void> {
    // Check cache size and evict if needed
    if (this.cache.size >= this.maxCacheSize) {
      this.evictLRU();
    }

    // Add to cache
    this.cache.set(persona.id, {
      persona,
      taskId,
      cachedAt: new Date(),
    });

    // Index by task
    if (taskId) {
      this.taskIndex.set(taskId, persona.id);
    }

    // Persist to disk
    await this.persistPersona(persona);

    console.log(`[PersonaRuntime] Stored persona ${persona.id}`);
  }

  /**
   * Retrieve a persona by ID
   */
  retrieve(personaId: string): RuntimePersona | undefined {
    const entry = this.cache.get(personaId);
    
    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (this.isExpired(entry.persona)) {
      this.cache.delete(personaId);
      return undefined;
    }

    return entry.persona;
  }

  /**
   * Get persona for a specific task
   */
  getForTask(taskId: string): RuntimePersona | undefined {
    const personaId = this.taskIndex.get(taskId);
    if (!personaId) {
      return undefined;
    }
    return this.retrieve(personaId);
  }

  /**
   * List all active (non-expired) personas
   */
  listActive(): RuntimePersona[] {
    const active: RuntimePersona[] = [];
    const now = new Date();

    for (const [id, entry] of this.cache.entries()) {
      if (entry.persona.expiresAt > now) {
        active.push(entry.persona);
      } else {
        this.cache.delete(id);
        if (entry.taskId) {
          this.taskIndex.delete(entry.taskId);
        }
      }
    }

    return active;
  }

  /**
   * Invalidate a persona by ID
   */
  async invalidate(personaId: string): Promise<void> {
    const entry = this.cache.get(personaId);
    
    if (entry?.taskId) {
      this.taskIndex.delete(entry.taskId);
    }
    
    this.cache.delete(personaId);
    
    // Remove from disk
    try {
      const filePath = path.join(this.storageDir, `${personaId}.json`);
      await fs.unlink(filePath);
    } catch {
      // File might not exist
    }

    console.log(`[PersonaRuntime] Invalidated persona ${personaId}`);
  }

  /**
   * Invalidate persona for a specific task
   */
  async invalidateForTask(taskId: string): Promise<void> {
    const personaId = this.taskIndex.get(taskId);
    if (personaId) {
      await this.invalidate(personaId);
    }
  }

  /**
   * Clear all cached personas
   */
  async clearCache(): Promise<void> {
    this.cache.clear();
    this.taskIndex.clear();
    
    // Clear disk
    try {
      const files = await fs.readdir(this.storageDir);
      await Promise.all(
        files
          .filter((f) => f.endsWith('.json'))
          .map((f) => fs.unlink(path.join(this.storageDir, f)))
      );
    } catch (err) {
      console.error('[PersonaRuntime] Failed to clear disk cache:', err);
    }

    console.log('[PersonaRuntime] Cache cleared');
  }

  /**
   * Cleanup expired personas
   */
  async cleanup(): Promise<number> {
    const now = new Date();
    let cleaned = 0;

    for (const [id, entry] of this.cache.entries()) {
      if (entry.persona.expiresAt <= now) {
        this.cache.delete(id);
        if (entry.taskId) {
          this.taskIndex.delete(entry.taskId);
        }
        cleaned++;
      }
    }

    console.log(`[PersonaRuntime] Cleaned up ${cleaned} expired personas`);
    return cleaned;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    totalCached: number;
    activeCount: number;
    expiredCount: number;
    taskMappings: number;
  } {
    const now = new Date();
    let activeCount = 0;
    let expiredCount = 0;

    for (const entry of this.cache.values()) {
      if (entry.persona.expiresAt > now) {
        activeCount++;
      } else {
        expiredCount++;
      }
    }

    return {
      totalCached: this.cache.size,
      activeCount,
      expiredCount,
      taskMappings: this.taskIndex.size,
    };
  }

  /**
   * Check if a persona is expired
   */
  private isExpired(persona: RuntimePersona): boolean {
    return new Date() > persona.expiresAt;
  }

  /**
   * Persist a persona to disk
   */
  private async persistPersona(persona: RuntimePersona): Promise<void> {
    try {
      const filePath = path.join(this.storageDir, `${persona.id}.json`);
      const data = JSON.stringify(persona, null, 2);
      await fs.writeFile(filePath, data, 'utf-8');
    } catch (err) {
      console.error(`[PersonaRuntime] Failed to persist persona ${persona.id}:`, err);
    }
  }

  /**
   * Load persisted personas from disk
   */
  private async loadPersistedPersonas(): Promise<void> {
    try {
      const files = await fs.readdir(this.storageDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      await Promise.all(
        jsonFiles.map(async (file) => {
          try {
            const filePath = path.join(this.storageDir, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const persona: RuntimePersona = JSON.parse(content);

            // Convert date strings back to Date objects
            persona.createdAt = new Date(persona.createdAt);
            persona.expiresAt = new Date(persona.expiresAt);

            // Only load if not expired
            if (!this.isExpired(persona)) {
              this.cache.set(persona.id, {
                persona,
                cachedAt: new Date(),
              });
            }
          } catch (err) {
            console.error(`[PersonaRuntime] Failed to load ${file}:`, err);
          }
        })
      );
    } catch (err) {
      // Directory might not exist yet
    }
  }

  /**
   * Evict least recently used persona
   */
  private evictLRU(): void {
    let oldest: { id: string; cachedAt: Date } | null = null;

    for (const [id, entry] of this.cache.entries()) {
      if (!oldest || entry.cachedAt < oldest.cachedAt) {
        oldest = { id, cachedAt: entry.cachedAt };
      }
    }

    if (oldest) {
      this.cache.delete(oldest.id);
      console.log(`[PersonaRuntime] Evicted LRU persona ${oldest.id}`);
    }
  }
}

// Singleton instance
let globalRuntime: PersonaRuntime | null = null;

/**
 * Get global persona runtime
 */
export function getPersonaRuntime(options?: RuntimeOptions): PersonaRuntime {
  if (!globalRuntime) {
    globalRuntime = new PersonaRuntime(options);
  }
  return globalRuntime;
}

/**
 * Reset global runtime (useful for testing)
 */
export function resetPersonaRuntime(): void {
  globalRuntime = null;
}
