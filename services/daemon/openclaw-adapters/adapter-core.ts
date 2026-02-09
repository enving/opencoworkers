/**
 * OpenClaw Adapter Core
 * 
 * Main orchestrator for OpenClaw operations. Coordinates submodule management,
 * skill validation, and execution. Provides a unified interface for skill management.
 */

import { EventEmitter } from 'events';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { SkillRegistry, OpenClawSkill } from './skill-registry.js';
import { SubmoduleManager, SkillConfig } from './submodule-manager.js';
import { SkillValidator } from './skill-validator.js';
import { SkillExecutor } from './skill-executor.js';
import {
  SkillExecutionContext,
  SkillExecutionResult,
  OpenClawSkillExtended,
  Actor
} from '../types/skill-execution.js';
import { OpenCodeServerBridge } from '../server/bridge.js';
import { AuditLogger } from '../orchestration/audit-trail.js';

export interface OpenClawAdapterOptions {
  /** Path to vendor directory */
  vendorPath: string;
  /** Path to skills configuration */
  configPath: string;
  /** Server bridge for runtime communication */
  bridge: OpenCodeServerBridge;
  /** Optional audit logger */
  auditLogger?: AuditLogger;
}

/**
 * Main OpenClaw adapter - orchestrates all skill operations
 */
export class OpenClawAdapter extends EventEmitter {
  private submoduleManager: SubmoduleManager;
  private skillValidator: SkillValidator;
  private skillExecutor: SkillExecutor;
  private skillRegistry: SkillRegistry;
  private config: SkillConfig | null = null;
  private validatedSkills: Map<string, OpenClawSkillExtended> = new Map();
  private initialized = false;

  constructor(private options: OpenClawAdapterOptions) {
    super();

    // Initialize components
    this.submoduleManager = new SubmoduleManager({
      skillsDir: path.join(options.vendorPath, 'skills'),
      configPath: options.configPath
    });

    this.skillValidator = new SkillValidator();
    this.skillRegistry = new SkillRegistry(options.vendorPath);
    this.skillExecutor = new SkillExecutor(
      options.bridge,
      options.auditLogger
    );

    // Forward executor events
    this.skillExecutor.on('progress', (data) => this.emit('skill:progress', data));
    this.skillExecutor.on('skill:executed', (data) => this.emit('skill:executed', data));
    this.skillExecutor.on('skill:failed', (data) => this.emit('skill:failed', data));
    this.skillExecutor.on('skill:cancelled', (data) => this.emit('skill:cancelled', data));
  }

  /**
   * Initialize the adapter - load config, sync submodules, validate skills
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[OpenClawAdapter] Already initialized');
      return;
    }

    console.log('[OpenClawAdapter] Initializing...');

    try {
      // Initialize submodule manager
      await this.submoduleManager.initialize();

      // Load configuration
      this.config = await this.submoduleManager.loadConfig();
      console.log(`[OpenClawAdapter] Loaded config with ${this.config.skills.length} skills`);

      // Sync submodules if auto-sync is enabled
      if (this.config.autoSync) {
        console.log('[OpenClawAdapter] Auto-syncing submodules...');
        await this.submoduleManager.syncAll();
      }

      // Scan and validate all skills
      await this.scanAndValidateSkills();

      this.initialized = true;
      console.log('[OpenClawAdapter] Initialization complete');

      this.emit('initialized');
    } catch (err: any) {
      console.error('[OpenClawAdapter] Initialization failed:', err);
      throw err;
    }
  }

  /**
   * Register a new skill
   */
  async registerSkill(name: string): Promise<void> {
    console.log(`[OpenClawAdapter] Registering skill: ${name}`);

    // Check if already registered
    if (this.validatedSkills.has(name)) {
      console.log(`[OpenClawAdapter] Skill '${name}' already registered`);
      return;
    }

    // Get skill path
    const skillPath = this.submoduleManager.getSkillPath(name);

    try {
      // Scan the skill
      const skills = await this.skillRegistry.scan();
      const skill = this.skillRegistry.getSkill(name);

      if (!skill) {
        throw new Error(`Skill '${name}' not found in registry`);
      }

      // Validate the skill
      const report = await this.skillValidator.validateAll(skillPath, skill);

      if (!report.isValid) {
        throw new Error(
          `Skill '${name}' failed validation: ${report.structure.errors.join(', ')}`
        );
      }

      // Get repository info
      const submodules = await this.submoduleManager.listSkills();
      const submodule = submodules.find(s => s.name === name);

      // Create extended skill info
      const extendedSkill: OpenClawSkillExtended = {
        ...skill,
        version: '1.0.0', // Could be parsed from SKILL.md
        repository: submodule?.repository || '',
        commit: submodule?.commit || '',
        validated: true,
        lastValidated: new Date()
      };

      // Add to validated skills
      this.validatedSkills.set(name, extendedSkill);

      console.log(`[OpenClawAdapter] Skill '${name}' registered successfully`);

      // Emit event
      this.emit('skill:registered', { name, skill: extendedSkill });

    } catch (err: any) {
      console.error(`[OpenClawAdapter] Failed to register skill '${name}':`, err);
      throw err;
    }
  }

  /**
   * Unregister a skill
   */
  unregisterSkill(name: string): void {
    if (!this.validatedSkills.has(name)) {
      console.warn(`[OpenClawAdapter] Skill '${name}' not found in registry`);
      return;
    }

    this.validatedSkills.delete(name);
    console.log(`[OpenClawAdapter] Skill '${name}' unregistered`);

    this.emit('skill:unregistered', { name });
  }

  /**
   * Execute a skill
   */
  async executeSkill(
    name: string,
    inputs: Record<string, any> = {},
    partialContext: Partial<SkillExecutionContext> = {}
  ): Promise<SkillExecutionResult> {
    // Get the skill
    const skill = this.validatedSkills.get(name) || this.skillRegistry.getSkill(name);
    
    if (!skill) {
      throw new Error(`Skill '${name}' not found`);
    }

    // Create execution context
    const context: SkillExecutionContext = {
      skill,
      inputs,
      taskId: partialContext.taskId,
      sessionId: partialContext.sessionId || uuidv4(),
      actor: partialContext.actor || {
        id: 'system',
        type: 'system',
        name: 'OpenClaw Adapter'
      },
      workingDirectory: partialContext.workingDirectory || path.join(process.cwd(), 'tmp', 'skills', name),
      environment: partialContext.environment || {}
    };

    console.log(`[OpenClawAdapter] Executing skill '${name}' (session: ${context.sessionId})`);

    // Execute via the skill executor
    const result = await this.skillExecutor.execute(context);

    return result;
  }

  /**
   * List all available (validated) skills
   */
  listAvailableSkills(): OpenClawSkillExtended[] {
    return Array.from(this.validatedSkills.values());
  }

  /**
   * Get a specific skill
   */
  getSkill(name: string): OpenClawSkillExtended | undefined {
    return this.validatedSkills.get(name);
  }

  /**
   * Get all registered skills (including raw registry)
   */
  getAllSkills(): OpenClawSkill[] {
    const validated = Array.from(this.validatedSkills.values());
    // Note: Would need to merge with skillRegistry skills
    return validated;
  }

  /**
   * Check if a skill is registered and validated
   */
  isSkillAvailable(name: string): boolean {
    return this.validatedSkills.has(name);
  }

  /**
   * Get the underlying submodule manager
   */
  getSubmoduleManager(): SubmoduleManager {
    return this.submoduleManager;
  }

  /**
   * Get the underlying skill validator
   */
  getSkillValidator(): SkillValidator {
    return this.skillValidator;
  }

  /**
   * Get the underlying skill executor
   */
  getSkillExecutor(): SkillExecutor {
    return this.skillExecutor;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('[OpenClawAdapter] Shutting down...');

    // Cancel any active executions
    const activeSessions = this.skillExecutor.getActiveSessions();
    for (const session of activeSessions) {
      console.log(`[OpenClawAdapter] Cancelling session ${session.sessionId}`);
      await this.skillExecutor.cancel(session.sessionId);
    }

    this.initialized = false;
    this.emit('shutdown');

    console.log('[OpenClawAdapter] Shutdown complete');
  }

  /**
   * Scan and validate all skills
   */
  private async scanAndValidateSkills(): Promise<void> {
    console.log('[OpenClawAdapter] Scanning for skills...');

    try {
      // Scan the registry
      const skills = await this.skillRegistry.scan();
      console.log(`[OpenClawAdapter] Found ${skills.length} skills`);

      // Validate each skill
      for (const skill of skills) {
        try {
          const skillPath = this.submoduleManager.getSkillPath(skill.name);
          const report = await this.skillValidator.validateAll(skillPath, skill);

          if (report.isValid) {
            // Get repository info
            const submodules = await this.submoduleManager.listSkills();
            const submodule = submodules.find(s => s.name === skill.name);

            const extendedSkill: OpenClawSkillExtended = {
              ...skill,
              version: '1.0.0',
              repository: submodule?.repository || '',
              commit: submodule?.commit || '',
              validated: true,
              lastValidated: new Date()
            };

            this.validatedSkills.set(skill.name, extendedSkill);
            console.log(`[OpenClawAdapter] ✓ Skill '${skill.name}' validated`);
          } else {
            console.warn(`[OpenClawAdapter] ✗ Skill '${skill.name}' failed validation`);
          }
        } catch (err) {
          console.error(`[OpenClawAdapter] Failed to validate skill '${skill.name}':`, err);
        }
      }

      console.log(`[OpenClawAdapter] ${this.validatedSkills.size} skills validated and ready`);

    } catch (err) {
      console.error('[OpenClawAdapter] Failed to scan skills:', err);
    }
  }

  /**
   * Refresh skills from disk and re-validate
   */
  async refreshSkills(): Promise<void> {
    console.log('[OpenClawAdapter] Refreshing skills...');
    this.validatedSkills.clear();
    await this.scanAndValidateSkills();
    this.emit('skills:refreshed');
  }

  /**
   * Add a new skill from a repository
   */
  async addSkill(repoUrl: string, name: string): Promise<void> {
    await this.submoduleManager.addSkill(repoUrl, name);
    await this.registerSkill(name);
  }

  /**
   * Remove a skill
   */
  async removeSkill(name: string): Promise<void> {
    this.unregisterSkill(name);
    await this.submoduleManager.removeSkill(name);
  }
}
