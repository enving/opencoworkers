/**
 * Git Submodule Manager for OpenClaw skills
 * 
 * Manages the lifecycle of skill repositories as git submodules,
 * including adding, updating, removing, and syncing skills.
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { SubmoduleInfo } from '../types/skill-execution.js';

export interface SkillConfig {
  version: string;
  autoSync: boolean;
  skills: Array<{
    name: string;
    repository: string;
    commit: string;
    enabled: boolean;
    permissions?: string[];
  }>;
}

export interface SubmoduleManagerOptions {
  /** Root path for skill submodules */
  skillsDir: string;
  /** Path to skills configuration file */
  configPath: string;
}

/**
 * Manages git submodules for OpenClaw skills
 */
export class SubmoduleManager {
  private skillsDir: string;
  private configPath: string;
  private config: SkillConfig | null = null;

  constructor(options: SubmoduleManagerOptions) {
    this.skillsDir = path.resolve(options.skillsDir);
    this.configPath = path.resolve(options.configPath);
  }

  /**
   * Initialize the manager and ensure directories exist
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.skillsDir, { recursive: true });
    } catch (err) {
      throw new Error(`Failed to create skills directory: ${err}`);
    }
  }

  /**
   * Load configuration from file
   */
  async loadConfig(): Promise<SkillConfig> {
    try {
      const content = await fs.readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(content) as SkillConfig;
      return this.config;
    } catch (err) {
      // Return default config if file doesn't exist
      this.config = {
        version: '1.0',
        autoSync: false,
        skills: []
      };
      return this.config;
    }
  }

  /**
   * Save configuration to file
   */
  async saveConfig(config: SkillConfig): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });
      await fs.writeFile(
        this.configPath,
        JSON.stringify(config, null, 2),
        'utf-8'
      );
      this.config = config;
    } catch (err) {
      throw new Error(`Failed to save config: ${err}`);
    }
  }

  /**
   * Add a new skill as a git submodule
   */
  async addSkill(repoUrl: string, name: string): Promise<void> {
    const submodulePath = path.join('vendor', 'skills', name);
    const fullPath = path.join(this.skillsDir, name);

    try {
      // Check if already exists
      const exists = await this.submoduleExists(name);
      if (exists) {
        throw new Error(`Skill '${name}' already exists`);
      }

      // Add submodule
      await this.execGit([
        'submodule', 'add',
        '--name', name,
        repoUrl,
        submodulePath
      ]);

      // Initialize and update
      await this.execGit(['submodule', 'update', '--init', submodulePath]);

      console.log(`[SubmoduleManager] Added skill '${name}' from ${repoUrl}`);
    } catch (err: any) {
      console.error(`[SubmoduleManager] Failed to add skill '${name}':`, err);
      throw new Error(`Failed to add skill: ${err.message}`);
    }
  }

  /**
   * Update a skill to a specific commit or latest
   */
  async updateSkill(name: string, ref?: string): Promise<void> {
    const submodulePath = path.join('vendor', 'skills', name);

    try {
      // Check if exists
      const exists = await this.submoduleExists(name);
      if (!exists) {
        throw new Error(`Skill '${name}' not found`);
      }

      if (ref) {
        // Checkout specific ref
        await this.execGit(['-C', submodulePath, 'fetch', 'origin']);
        await this.execGit(['-C', submodulePath, 'checkout', ref]);
        console.log(`[SubmoduleManager] Updated skill '${name}' to ${ref}`);
      } else {
        // Update to latest
        await this.execGit(['submodule', 'update', '--remote', submodulePath]);
        console.log(`[SubmoduleManager] Updated skill '${name}' to latest`);
      }
    } catch (err: any) {
      console.error(`[SubmoduleManager] Failed to update skill '${name}':`, err);
      throw new Error(`Failed to update skill: ${err.message}`);
    }
  }

  /**
   * Remove a skill submodule
   */
  async removeSkill(name: string): Promise<void> {
    const submodulePath = path.join('vendor', 'skills', name);

    try {
      // Check if exists
      const exists = await this.submoduleExists(name);
      if (!exists) {
        throw new Error(`Skill '${name}' not found`);
      }

      // Deinitialize submodule
      await this.execGit(['submodule', 'deinit', '-f', submodulePath]);

      // Remove from .gitmodules
      await this.execGit(['rm', '-f', submodulePath]);

      // Remove from .git/modules
      const gitModulesPath = path.join('.git', 'modules', 'vendor', 'skills', name);
      try {
        await fs.rm(gitModulesPath, { recursive: true, force: true });
      } catch {
        // Ignore errors if directory doesn't exist
      }

      console.log(`[SubmoduleManager] Removed skill '${name}'`);
    } catch (err: any) {
      console.error(`[SubmoduleManager] Failed to remove skill '${name}':`, err);
      throw new Error(`Failed to remove skill: ${err.message}`);
    }
  }

  /**
   * Sync all skills to their configured versions
   */
  async syncAll(): Promise<void> {
    try {
      const config = await this.loadConfig();

      if (!config.autoSync) {
        console.log('[SubmoduleManager] Auto-sync disabled, skipping');
        return;
      }

      for (const skill of config.skills) {
        if (!skill.enabled) continue;

        try {
          const exists = await this.submoduleExists(skill.name);
          if (!exists) {
            console.log(`[SubmoduleManager] Adding missing skill '${skill.name}'`);
            await this.addSkill(skill.repository, skill.name);
          }

          await this.updateSkill(skill.name, skill.commit);
          console.log(`[SubmoduleManager] Synced skill '${skill.name}' to ${skill.commit}`);
        } catch (err) {
          console.error(`[SubmoduleManager] Failed to sync skill '${skill.name}':`, err);
          // Continue with other skills
        }
      }
    } catch (err) {
      console.error('[SubmoduleManager] Failed to sync all skills:', err);
      throw err;
    }
  }

  /**
   * List all managed submodules
   */
  async listSkills(): Promise<SubmoduleInfo[]> {
    const skills: SubmoduleInfo[] = [];

    try {
      const entries = await fs.readdir(this.skillsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const name = entry.name;
        const skillPath = path.join(this.skillsDir, name);

        try {
          // Get repository URL
          const remoteUrl = await this.getRemoteUrl(skillPath);

          // Get current commit
          const commit = await this.getCurrentCommit(skillPath);

          // Check if initialized
          const initialized = await this.isSubmoduleInitialized(skillPath);

          skills.push({
            name,
            repository: remoteUrl,
            commit,
            initialized,
            lastSynced: initialized ? new Date() : undefined
          });
        } catch (err) {
          // Skip invalid entries
          skills.push({
            name,
            repository: '',
            commit: '',
            initialized: false,
            error: String(err)
          });
        }
      }
    } catch (err) {
      console.error('[SubmoduleManager] Failed to list skills:', err);
    }

    return skills;
  }

  /**
   * Get the path to a skill directory
   */
  getSkillPath(name: string): string {
    return path.join(this.skillsDir, name);
  }

  /**
   * Check if a skill submodule exists
   */
  private async submoduleExists(name: string): Promise<boolean> {
    const skillPath = path.join(this.skillsDir, name);
    try {
      const stat = await fs.stat(skillPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Check if a submodule is initialized
   */
  private async isSubmoduleInitialized(skillPath: string): Promise<boolean> {
    try {
      await this.execGit(['-C', skillPath, 'rev-parse', '--git-dir']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the remote URL for a submodule
   */
  private async getRemoteUrl(skillPath: string): Promise<string> {
    try {
      const result = await this.execGit([
        '-C', skillPath,
        'remote', 'get-url', 'origin'
      ]);
      return result.stdout.trim();
    } catch {
      return '';
    }
  }

  /**
   * Get the current commit hash
   */
  private async getCurrentCommit(skillPath: string): Promise<string> {
    try {
      const result = await this.execGit([
        '-C', skillPath,
        'rev-parse', 'HEAD'
      ]);
      return result.stdout.trim();
    } catch {
      return '';
    }
  }

  /**
   * Execute a git command
   */
  private execGit(args: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const proc = spawn('git', args, {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Git command failed: ${stderr || stdout}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to execute git: ${err.message}`));
      });
    });
  }
}
