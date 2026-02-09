/**
 * Persona Assembler
 * 
 * Dynamic persona assembly engine that creates specialized personas
 * based on task requirements and available skills.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  RuntimePersona,
  PersonaTemplate,
  MatchResult,
  AssemblyResult,
  TicketAnalysis,
} from '../types/persona-enhanced.js';
import { Task } from '../types/tasks.js';
import { TemplateRegistry, getTemplateRegistry } from './persona-template.js';
import { SkillMatcher } from './skill-matcher.js';
import { SkillRegistry } from '../openclaw-adapters/skill-registry.js';
import { PersonaRuntime } from './persona-runtime.js';

/**
 * Options for persona assembly
 */
export interface AssemblerOptions {
  /** Default TTL in hours */
  defaultTtlHours?: number;
  /** Minimum confidence threshold */
  minConfidence?: number;
  /** Template registry to use */
  templateRegistry?: TemplateRegistry;
}

/**
 * Dynamic persona assembly engine
 */
export class PersonaAssembler {
  private templateRegistry: TemplateRegistry;
  private skillMatcher: SkillMatcher;
  private runtime: PersonaRuntime;
  private defaultTtlHours: number;
  private minConfidence: number;

  constructor(
    skillRegistry: SkillRegistry,
    runtime: PersonaRuntime,
    options: AssemblerOptions = {}
  ) {
    this.templateRegistry = options.templateRegistry || getTemplateRegistry();
    this.skillMatcher = new SkillMatcher(skillRegistry);
    this.runtime = runtime;
    this.defaultTtlHours = options.defaultTtlHours || 24;
    this.minConfidence = options.minConfidence || 0.3;
  }

  /**
   * Assemble a persona for a specific task
   */
  async assembleForTask(task: Task): Promise<RuntimePersona> {
    // Check if persona already exists for this task
    const existing = this.runtime.getForTask(task.id);
    if (existing) {
      console.log(`[PersonaAssembler] Returning cached persona for task ${task.id}`);
      return existing;
    }

    console.log(`[PersonaAssembler] Assembling persona for task ${task.id}`);

    // Analyze the task
    const analysis = this.skillMatcher.analyzeTicket(task);

    // Find matching skills
    const skillMatches = await this.skillMatcher.findSkillsFor(task);

    // Select best template based on domain and skills
    const template = this.selectBestTemplate(analysis, skillMatches);

    // Filter skills by confidence threshold
    const matchedSkills = skillMatches
      .filter((match) => match.score >= this.minConfidence)
      .map((match) => match.skill);

    // Build the system prompt
    const systemPrompt = this.buildSystemPrompt(template, matchedSkills, analysis);

    // Create the runtime persona
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.defaultTtlHours * 60 * 60 * 1000);

    const persona: RuntimePersona = {
      id: `persona-${uuidv4()}`,
      name: `${template.name} (${task.id})`,
      role: template.role,
      system_prompt: systemPrompt,
      capabilities: [...template.defaultCapabilities, ...matchedSkills],
      basePersona: template.id,
      matchedSkills,
      requirements: analysis.requirements,
      confidence: this.calculateConfidence(skillMatches),
      createdAt: now,
      expiresAt,
    };

    // Store in runtime
    this.runtime.store(persona, task.id);

    console.log(`[PersonaAssembler] Created persona ${persona.id} for task ${task.id}`);

    return persona;
  }

  /**
   * Assemble a persona from a specific template with given skills
   */
  assembleFromTemplate(
    templateId: string,
    skills: string[],
    overrides?: Partial<RuntimePersona>
  ): RuntimePersona {
    const template = this.templateRegistry.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.defaultTtlHours * 60 * 60 * 1000);

    const systemPrompt = this.buildSystemPrompt(template, skills, {
      requirements: [],
      complexity: 'medium',
      domain: [],
      suggestedSkills: skills,
    });

    return {
      id: overrides?.id || `persona-${uuidv4()}`,
      name: overrides?.name || template.name,
      role: template.role,
      system_prompt: systemPrompt,
      capabilities: [...template.defaultCapabilities, ...skills],
      basePersona: template.id,
      matchedSkills: skills,
      requirements: [],
      confidence: 0.8,
      createdAt: now,
      expiresAt,
    };
  }

  /**
   * Select the best template for a task
   */
  private selectBestTemplate(
    analysis: TicketAnalysis,
    skillMatches: MatchResult[]
  ): PersonaTemplate {
    // Try to find template by domain
    for (const domain of analysis.domain) {
      const templates = this.templateRegistry.findByDomain(domain);
      if (templates.length > 0) {
        return templates[0];
      }
    }

    // Try to find by compatible skills
    const topSkills = skillMatches
      .slice(0, 3)
      .map((match) => match.skill.toLowerCase());

    const compatibleTemplates = this.templateRegistry
      .getAll()
      .filter((template) =>
        template.compatibleSkills.some((cs) =>
          topSkills.some((skill) => skill.includes(cs.toLowerCase()))
        )
      );

    if (compatibleTemplates.length > 0) {
      return compatibleTemplates[0];
    }

    // Fall back to default (generalist)
    return this.templateRegistry.get('generalist')!;
  }

  /**
   * Build the complete system prompt
   */
  private buildSystemPrompt(
    template: PersonaTemplate,
    matchedSkills: string[],
    analysis: TicketAnalysis
  ): string {
    const parts: string[] = [];

    // Base persona prompt
    parts.push(template.basePrompt);

    // Personality modifiers
    const personality = template.personality;
    parts.push(`\nYour approach:`);
    parts.push(`- Thoroughness: ${Math.round(personality.thoroughness * 100)}%`);
    parts.push(`- Creativity: ${Math.round(personality.creativity * 100)}%`);
    parts.push(`- Caution: ${Math.round(personality.caution * 100)}%`);

    // Task complexity context
    parts.push(`\nTask complexity: ${analysis.complexity}`);

    // Matched skills
    if (matchedSkills.length > 0) {
      parts.push(`\nYour capabilities for this task:`);
      matchedSkills.forEach((skill) => {
        parts.push(`- ${skill}`);
      });
    }

    // Requirements context
    if (analysis.requirements.length > 0) {
      parts.push(`\nKey requirements:`);
      analysis.requirements.slice(0, 5).forEach((req) => {
        parts.push(`- ${req}`);
      });
    }

    // Mental Sandbox reminder
    parts.push(`\nBefore taking action, use the Mental Sandbox protocol:`);
    parts.push(`1. Plan your approach`);
    parts.push(`2. Simulate the execution`);
    parts.push(`3. Critique for risks`);
    parts.push(`4. Only then proceed`);

    return parts.join('\n');
  }

  /**
   * Calculate overall confidence score
   */
  private calculateConfidence(skillMatches: MatchResult[]): number {
    if (skillMatches.length === 0) return 0;
    
    const topScores = skillMatches.slice(0, 3).map((m) => m.score);
    const average = topScores.reduce((a, b) => a + b, 0) / topScores.length;
    
    return Math.min(average, 1.0);
  }

  /**
   * Analyze a task without creating a persona
   */
  async analyzeTask(task: Task): Promise<{
    analysis: TicketAnalysis;
    suggestedSkills: MatchResult[];
    suggestedTemplates: string[];
  }> {
    const analysis = this.skillMatcher.analyzeTicket(task);
    const suggestedSkills = await this.skillMatcher.findSkillsFor(task);

    // Find suggested templates
    const templateIds = new Set<string>();
    
    // By domain
    for (const domain of analysis.domain) {
      const templates = this.templateRegistry.findByDomain(domain);
      templates.forEach((t) => templateIds.add(t.id));
    }

    // By skills
    const topSkills = suggestedSkills.slice(0, 3).map((s) => s.skill);
    this.templateRegistry.getAll().forEach((template) => {
      if (
        template.compatibleSkills.some((cs) =>
          topSkills.some((skill) => skill.toLowerCase().includes(cs.toLowerCase()))
        )
      ) {
        templateIds.add(template.id);
      }
    });

    return {
      analysis,
      suggestedSkills,
      suggestedTemplates: Array.from(templateIds),
    };
  }
}

// Singleton instance
let globalAssembler: PersonaAssembler | null = null;

/**
 * Get global persona assembler
 */
export function getPersonaAssembler(
  skillRegistry: SkillRegistry,
  runtime: PersonaRuntime,
  options?: AssemblerOptions
): PersonaAssembler {
  if (!globalAssembler) {
    globalAssembler = new PersonaAssembler(skillRegistry, runtime, options);
  }
  return globalAssembler;
}

/**
 * Reset global assembler (useful for testing)
 */
export function resetPersonaAssembler(): void {
  globalAssembler = null;
}
