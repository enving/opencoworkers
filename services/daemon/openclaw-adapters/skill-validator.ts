/**
 * Skill Validator for OpenClaw skills
 * 
 * Validates skill structure, security, and dependencies before registration.
 * Ensures skills are safe to execute and meet all requirements.
 */

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { OpenClawSkill } from './skill-registry.js';
import { 
  SkillValidationResult, 
  ValidationReport,
  OpenClawSkillExtended 
} from '../types/skill-execution.js';

/**
 * Cache entry for validation results
 */
interface ValidationCache {
  [commitHash: string]: ValidationReport;
}

/**
 * List of dangerous binaries that should not be allowed in skills
 */
const FORBIDDEN_BINARIES = [
  'rm', 'dd', 'mkfs', 'fdisk', 'format',
  'del', 'rd', 'format.com',
  'shutdown', 'reboot', 'halt',
  'poweroff', 'init',
  'kill', 'killall', 'pkill',
  'chmod', 'chown', 'chgrp',
  'mount', 'umount',
  'useradd', 'userdel', 'usermod',
  'groupadd', 'groupdel',
  'passwd', 'shadow',
  'sudo', 'su',
  'wget', 'curl', // Can be used for malicious downloads
];

/**
 * Suspicious patterns that may indicate malicious content
 */
const SUSPICIOUS_PATTERNS = [
  /eval\s*\(/i,
  /exec\s*\(/i,
  /system\s*\(/i,
  /child_process/i,
  /require\s*\(\s*['"]child_process['"]\s*\)/i,
  />\s*\/dev\/null/i,
  />\s*\/dev\/zero/i,
  />\s*\/dev\/random/i,
  /\/etc\/passwd/i,
  /\/etc\/shadow/i,
  /\.ssh\//i,
  /\.bashrc/i,
  /\.zshrc/i,
  /crontab/i,
  /System32/i,
  /\.dll/i,
  /\.exe/i,
];

/**
 * Validates OpenClaw skills for security and correctness
 */
export class SkillValidator {
  private validationCache: ValidationCache = {};
  private cacheDir: string;

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir || path.join(process.cwd(), '.cache', 'skill-validation');
  }

  /**
   * Validate skill structure
   */
  async validateStructure(skillPath: string): Promise<SkillValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if SKILL.md exists
      const skillMdPath = path.join(skillPath, 'SKILL.md');
      try {
        await fs.access(skillMdPath);
      } catch {
        errors.push(`SKILL.md not found at ${skillPath}`);
        return { valid: false, errors, warnings };
      }

      // Read and parse SKILL.md
      const content = await fs.readFile(skillMdPath, 'utf-8');

      // Check required fields
      const nameMatch = content.match(/^name:\s*(.+)$/m);
      if (!nameMatch || !nameMatch[1]?.trim()) {
        errors.push('Missing required field: name');
      }

      const descMatch = content.match(/^description:\s*(.+)$/m);
      if (!descMatch || !descMatch[1]?.trim()) {
        errors.push('Missing required field: description');
      }

      // Check emoji format (if present)
      const emojiMatch = content.match(/emoji:\s*"?(.)"?/);
      if (emojiMatch && emojiMatch[1]) {
        // Validate it's actually an emoji (simple check)
        const emoji = emojiMatch[1];
        if (emoji.length > 2) {
          warnings.push(`Emoji may be too long: ${emoji}`);
        }
      }

      // Check requires.bins format
      const binsMatch = content.match(/"requires":\s*\{\s*"bins":\s*\[(.*?)\]/);
      if (binsMatch && binsMatch[1]) {
        const bins = binsMatch[1].split(',').map(s => s.trim().replace(/['"]/g, ''));
        for (const bin of bins) {
          if (!bin.match(/^[a-zA-Z0-9_-]+$/)) {
            warnings.push(`Binary name contains invalid characters: ${bin}`);
          }
        }
      }

      // Check for additional required files
      const requiredFiles = ['README.md'];
      for (const file of requiredFiles) {
        try {
          await fs.access(path.join(skillPath, file));
        } catch {
          warnings.push(`Recommended file missing: ${file}`);
        }
      }

    } catch (err: any) {
      errors.push(`Failed to validate structure: ${err.message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate skill security
   */
  validateSecurity(skill: OpenClawSkill): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for dangerous binaries in requires.bins
    for (const bin of skill.requiresBins) {
      if (FORBIDDEN_BINARIES.includes(bin.toLowerCase())) {
        errors.push(`Forbidden binary detected: ${bin}`);
      }
      if (bin.includes('/') || bin.includes('\\')) {
        errors.push(`Binary name contains path traversal: ${bin}`);
      }
    }

    // Check for suspicious patterns in content
    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.test(skill.content)) {
        const match = skill.content.match(pattern);
        const snippet = match ? match[0].substring(0, 30) : 'unknown';
        errors.push(`Suspicious pattern detected: ${snippet}...`);
      }
    }

    // Check for shell injection in paths
    if (skill.path.includes(';') || skill.path.includes('&&') || skill.path.includes('||')) {
      errors.push('Path contains shell metacharacters');
    }

    if (skill.path.includes('..')) {
      warnings.push('Path contains parent directory references');
    }

    // Check for overly broad permissions in content
    if (skill.content.includes('chmod 777') || skill.content.includes('chmod -R')) {
      warnings.push('Content may set overly broad permissions');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate skill dependencies
   */
  async validateDependencies(skill: OpenClawSkill): Promise<SkillValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const bin of skill.requiresBins) {
      try {
        const available = await this.checkBinaryAvailable(bin);
        if (!available) {
          errors.push(`Required binary not available: ${bin}`);
        }
      } catch (err: any) {
        warnings.push(`Could not check binary availability: ${bin}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Run all validations and return comprehensive report
   */
  async validateAll(skillPath: string, skill: OpenClawSkill): Promise<ValidationReport> {
    // Get commit hash for caching
    const commitHash = await this.getCommitHash(skillPath);

    // Check cache
    if (commitHash && this.validationCache[commitHash]) {
      console.log(`[SkillValidator] Using cached validation for ${skill.name}`);
      return this.validationCache[commitHash];
    }

    console.log(`[SkillValidator] Validating skill: ${skill.name}`);

    // Run all validations
    const [structure, security, dependencies] = await Promise.all([
      this.validateStructure(skillPath),
      Promise.resolve(this.validateSecurity(skill)),
      this.validateDependencies(skill)
    ]);

    const isValid = structure.valid && security.valid && dependencies.valid;

    const report: ValidationReport = {
      skillName: skill.name,
      structure,
      security,
      dependencies,
      isValid,
      validatedAt: new Date(),
      commitHash
    };

    // Cache the result
    if (commitHash) {
      this.validationCache[commitHash] = report;
    }

    // Log validation results
    if (isValid) {
      console.log(`[SkillValidator] ✓ Skill '${skill.name}' passed all validations`);
    } else {
      console.log(`[SkillValidator] ✗ Skill '${skill.name}' failed validation:`);
      report.structure.errors.forEach(e => console.log(`  - Structure: ${e}`));
      report.security.errors.forEach(e => console.log(`  - Security: ${e}`));
      report.dependencies.errors.forEach(e => console.log(`  - Dependencies: ${e}`));
    }

    return report;
  }

  /**
   * Check if a binary is available in the runtime
   */
  private async checkBinaryAvailable(binary: string): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('which', [binary], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      proc.on('close', (code) => {
        resolve(code === 0);
      });

      proc.on('error', () => {
        resolve(false);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        proc.kill();
        resolve(false);
      }, 5000);
    });
  }

  /**
   * Get the current commit hash for a skill path
   */
  private async getCommitHash(skillPath: string): Promise<string | undefined> {
    return new Promise((resolve) => {
      const proc = spawn('git', ['rev-parse', 'HEAD'], {
        cwd: skillPath,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          resolve(undefined);
        }
      });

      proc.on('error', () => {
        resolve(undefined);
      });

      setTimeout(() => {
        proc.kill();
        resolve(undefined);
      }, 5000);
    });
  }

  /**
   * Clear the validation cache
   */
  clearCache(): void {
    this.validationCache = {};
    console.log('[SkillValidator] Validation cache cleared');
  }

  /**
   * Get cached validation for a commit hash
   */
  getCachedValidation(commitHash: string): ValidationReport | undefined {
    return this.validationCache[commitHash];
  }

  /**
   * Create extended skill info with validation status
   */
  createExtendedSkill(
    skill: OpenClawSkill,
    repository: string,
    commit: string,
    report: ValidationReport
  ): OpenClawSkillExtended {
    return {
      ...skill,
      version: '1.0.0', // Default version, could be parsed from SKILL.md
      repository,
      commit,
      validated: report.isValid,
      lastValidated: report.validatedAt
    };
  }
}
