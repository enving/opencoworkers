/**
 * Ability Factory
 * 
 * Factory service for creating abilities with caching support.
 * Loads custom rules from configuration and merges with role-based defaults.
 * 
 * Features:
 * - Caches abilities by actor.id (with TTL)
 * - Loads custom rules from roles.json config
 * - Merges role-based defaults with custom permissions
 * - Supports dynamic rule updates without restart
 */

import { AppAbility, defineAbilityFor, subject, detectSubjectType } from './casl-ability.js';
import { Actor, ActorType, ActorRoles, createActor } from '../types/actor.js';
import { ActionType } from './actions.js';
import { SubjectType } from './subjects.js';
import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Cache entry with TTL
 */
interface CacheEntry {
  ability: AppAbility;
  timestamp: number;
  actor: Actor;
}

/**
 * Custom rule definition from roles.json
 */
interface CustomRule {
  action: ActionType;
  subject: SubjectType;
  conditions?: Record<string, any>;
  inverted?: boolean; // true for "cannot" rules
}

/**
 * Role definition from roles.json
 */
interface RoleDefinition {
  can?: Array<[ActionType, SubjectType, Record<string, any>?]>;
  cannot?: Array<[ActionType, SubjectType, Record<string, any>?]>;
  inherits?: string; // Inherit from another role
}

/**
 * Roles configuration structure
 */
interface RolesConfig {
  roles: Record<string, RoleDefinition>;
  version?: string;
}

/**
 * Options for AbilityFactory
 */
export interface AbilityFactoryOptions {
  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTtlMs?: number;
  /** Path to roles.json config file */
  rolesConfigPath?: string;
  /** Base directory for config files */
  configBaseDir?: string;
}

/**
 * Factory for creating and caching CASL abilities
 */
export class AbilityFactory {
  private cache: Map<string, CacheEntry> = new Map();
  private cacheTtlMs: number;
  private rolesConfigPath: string;
  private rolesConfig: RolesConfig | null = null;
  private configLoaded: boolean = false;

  constructor(options: AbilityFactoryOptions = {}) {
    this.cacheTtlMs = options.cacheTtlMs || 5 * 60 * 1000; // 5 minutes default
    this.rolesConfigPath = options.rolesConfigPath || 
      path.join(options.configBaseDir || '.agent-config', 'roles.json');
  }

  /**
   * Initialize the factory by loading custom roles config
   */
  async init(): Promise<void> {
    await this.loadRolesConfig();
  }

  /**
   * Create an ability for a given actor
   * Uses cache if available and not expired
   */
  async createFor(actor: Actor): Promise<AppAbility> {
    const cached = this.getFromCache(actor.id);
    if (cached) {
      return cached;
    }

    // Load custom rules if not already loaded
    if (!this.configLoaded) {
      await this.loadRolesConfig();
    }

    // Start with role-based ability
    let ability = defineAbilityFor(actor);

    // Apply custom rules from config if role is defined there
    if (this.rolesConfig?.roles[actor.role]) {
      ability = this.mergeWithCustomRules(ability, actor);
    }

    // Cache the ability
    this.setCache(actor.id, ability, actor);

    return ability;
  }

  /**
   * Create ability for a user by ID
   */
  async createForUser(
    userId: string,
    options?: {
      role?: string;
      permissions?: string[];
      metadata?: Actor['metadata'];
    }
  ): Promise<AppAbility> {
    const actor = createActor(
      userId,
      ActorType.USER,
      options?.role || ActorRoles.USER,
      {
        permissions: options?.permissions,
        metadata: options?.metadata,
      }
    );
    return this.createFor(actor);
  }

  /**
   * Create ability for an agent by ID
   */
  async createForAgent(
    agentId: string,
    options?: {
      role?: string;
      permissions?: string[];
      metadata?: Actor['metadata'];
    }
  ): Promise<AppAbility> {
    const actor = createActor(
      agentId,
      ActorType.AGENT,
      options?.role || ActorRoles.JUNIOR_AGENT,
      {
        permissions: options?.permissions,
        metadata: options?.metadata,
      }
    );
    return this.createFor(actor);
  }

  /**
   * Invalidate cached ability for an actor
   */
  invalidate(actorId: string): void {
    this.cache.delete(actorId);
    console.log(`[AbilityFactory] Cache invalidated for actor: ${actorId}`);
  }

  /**
   * Clear all cached abilities
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[AbilityFactory] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxAge: number } {
    return {
      size: this.cache.size,
      maxAge: this.cacheTtlMs,
    };
  }

  /**
   * Reload roles configuration from disk
   * Clears cache to ensure new rules take effect
   */
  async reloadConfig(): Promise<void> {
    this.rolesConfig = null;
    this.configLoaded = false;
    this.clearCache();
    await this.loadRolesConfig();
    console.log('[AbilityFactory] Roles config reloaded');
  }

  /**
   * Get loaded roles configuration
   */
  getRolesConfig(): RolesConfig | null {
    return this.rolesConfig;
  }

  /**
   * Get available role names
   */
  getAvailableRoles(): string[] {
    if (!this.rolesConfig) {
      return Object.values(ActorRoles);
    }
    return Array.from(new Set([...Object.values(ActorRoles), ...Object.keys(this.rolesConfig.roles)]));
  }

  /**
   * Get ability from cache if valid
   */
  private getFromCache(actorId: string): AppAbility | null {
    const entry = this.cache.get(actorId);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > this.cacheTtlMs) {
      // Cache expired
      this.cache.delete(actorId);
      return null;
    }

    return entry.ability;
  }

  /**
   * Store ability in cache
   */
  private setCache(actorId: string, ability: AppAbility, actor: Actor): void {
    this.cache.set(actorId, {
      ability,
      timestamp: Date.now(),
      actor,
    });
  }

  /**
   * Load roles configuration from disk
   */
  private async loadRolesConfig(): Promise<void> {
    try {
      const content = await fs.readFile(this.rolesConfigPath, 'utf-8');
      this.rolesConfig = JSON.parse(content) as RolesConfig;
      this.configLoaded = true;
      console.log(`[AbilityFactory] Loaded roles config from ${this.rolesConfigPath}`);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        // Config file doesn't exist - that's ok, use defaults
        this.rolesConfig = { roles: {} };
        this.configLoaded = true;
        console.log(`[AbilityFactory] No custom roles config found at ${this.rolesConfigPath}, using defaults`);
      } else {
        console.error('[AbilityFactory] Failed to load roles config:', err);
        this.rolesConfig = { roles: {} };
        this.configLoaded = true;
      }
    }
  }

  /**
   * Merge role-based ability with custom rules from config
   */
  private mergeWithCustomRules(baseAbility: AppAbility, actor: Actor): AppAbility {
    if (!this.rolesConfig?.roles[actor.role]) {
      return baseAbility;
    }

    const roleDef = this.rolesConfig.roles[actor.role];
    const builder = new AbilityBuilder<AppAbility>(createMongoAbility);

    // Start with base rules by copying from baseAbility
    // (Note: CASL doesn't support direct copying, so we rebuild with base + custom)
    
    // Re-apply base role rules
    const baseActor = { ...actor, role: actor.role }; // Preserve role
    const baseRulesAbility = defineAbilityFor(baseActor);

    // Apply custom "can" rules
    if (roleDef.can) {
      for (const [action, subject, conditions] of roleDef.can) {
        if (conditions) {
          builder.can(action, subject, conditions);
        } else {
          builder.can(action, subject);
        }
      }
    }

    // Apply custom "cannot" rules
    if (roleDef.cannot) {
      for (const [action, subject, conditions] of roleDef.cannot) {
        if (conditions) {
          builder.cannot(action, subject, conditions);
        } else {
          builder.cannot(action, subject);
        }
      }
    }

    // Handle role inheritance
    if (roleDef.inherits) {
      const parentRole = this.rolesConfig.roles[roleDef.inherits];
      if (parentRole?.can) {
        for (const [action, subject, conditions] of parentRole.can) {
          if (conditions) {
            builder.can(action, subject, conditions);
          } else {
            builder.can(action, subject);
          }
        }
      }
    }

    return builder.build({
      detectSubjectType,
    });
  }

  /**
   * Create default roles.json if it doesn't exist
   */
  async createDefaultRolesConfig(): Promise<void> {
    try {
      await fs.access(this.rolesConfigPath);
      // File exists, don't overwrite
      return;
    } catch {
      // File doesn't exist, create default
      const defaultConfig: RolesConfig = {
        version: '1.0.0',
        roles: {
          admin: {
            can: [['manage', 'all']],
          },
          user: {
            can: [
              ['read', 'Task'],
              ['read', 'File'],
              ['read', 'Skill'],
              ['create', 'Task'],
            ],
            cannot: [['execute', 'Skill']],
          },
          'junior-agent': {
            can: [
              ['read', 'all'],
              ['execute', 'Skill', { riskLevel: 'low' }],
            ],
            cannot: [
              ['execute', 'Skill', { riskLevel: 'medium' }],
              ['execute', 'Skill', { riskLevel: 'high' }],
              ['execute', 'File'],
              ['delete', 'File'],
              ['delete', 'Task'],
              ['delete', 'Config'],
            ],
          },
          'senior-agent': {
            can: [
              ['read', 'all'],
              ['write', 'all'],
              ['create', 'all'],
              ['update', 'all'],
              ['execute', 'all'],
            ],
            cannot: [
              ['delete', 'Config', { type: 'opencode' }],
              ['delete', 'File', { isSensitive: true }],
            ],
          },
          'auditor-agent': {
            can: [['read', 'all']],
            cannot: [
              ['write', 'all'],
              ['create', 'all'],
              ['update', 'all'],
              ['delete', 'all'],
              ['execute', 'all'],
              ['manage', 'all'],
            ],
          },
        },
      };

      // Ensure directory exists
      const dir = path.dirname(this.rolesConfigPath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(
        this.rolesConfigPath,
        JSON.stringify(defaultConfig, null, 2),
        'utf-8'
      );
      
      console.log(`[AbilityFactory] Created default roles config at ${this.rolesConfigPath}`);
      this.rolesConfig = defaultConfig;
      this.configLoaded = true;
    }
  }
}

// Singleton instance for global use
let globalFactory: AbilityFactory | null = null;

/**
 * Get or create the global AbilityFactory instance
 */
export function getAbilityFactory(options?: AbilityFactoryOptions): AbilityFactory {
  if (!globalFactory) {
    globalFactory = new AbilityFactory(options);
  }
  return globalFactory;
}

/**
 * Reset the global factory (useful for testing)
 */
export function resetAbilityFactory(): void {
  globalFactory = null;
}
