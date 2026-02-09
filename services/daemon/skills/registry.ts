import { ISkillProvider, SkillMetadata } from './types.js';
import { PosixSkillProvider } from './providers/posix.js';
import { WebDavSkillProvider } from './providers/webdav.js';

export interface RegistryConfig {
  type: 'posix' | 'webdav';
  webdav?: {
    url: string;
    username?: string;
    password?: string;
  };
  rootPath?: string;
}

export class SkillRegistry {
  private skills: Map<string, SkillMetadata> = new Map();
  private provider: ISkillProvider;

  constructor(config?: RegistryConfig) {
    if (config?.type === 'webdav' && config.webdav) {
      console.log(`[SkillRegistry] Initializing WebDAV provider (${config.webdav.url})`);
      this.provider = new WebDavSkillProvider(
        config.webdav.url,
        config.webdav.username,
        config.webdav.password
      );
    } else {
      console.log('[SkillRegistry] Initializing Posix provider');
      this.provider = new PosixSkillProvider(config?.rootPath);
    }
  }

  async discover(): Promise<SkillMetadata[]> {
    try {
      const skills = await this.provider.discover();
      this.skills.clear();

      for (const skill of skills) {
        this.skills.set(skill.name, skill);
      }

      return skills;
    } catch (err) {
      console.error('[SkillRegistry] Discovery failed:', err);
      return [];
    }
  }

  getSkill(name: string): SkillMetadata | undefined {
    return this.skills.get(name);
  }

  async getInstructionForSkill(skillName: string): Promise<string> {
    const skill = this.getSkill(skillName);
    if (!skill) return '';

    try {
      const content = await this.provider.getFileContent(skillName, 'SKILL.md');
      if (content) {
        return `\n\n[pm-sync] 🤖 Skill available: ${skillName}\n\n${content.toString('utf-8')}`;
      }
    } catch (e) {
      console.warn(`[SkillRegistry] Failed to load full instructions for ${skillName}, using fallback.`);
    }

    return `\n\n[pm-sync] 🤖 Skill available: ${skill.name}. ${skill.description}. Commands: ${skill.commands.join(', ')}.`;
  }

  /**
   * Upload/Save a skill using the active provider
   */
  async saveSkill(skillName: string, files: Map<string, Buffer>): Promise<boolean> {
    const success = await this.provider.saveSkill(skillName, files);
    if (success) {
      await this.discover(); // Refresh cache
    }
    return success;
  }
}
