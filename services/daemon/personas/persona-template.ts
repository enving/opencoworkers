/**
 * Persona Templates
 * 
 * Base persona templates for dynamic assembly.
 * These provide the foundation characteristics that get combined
 * with matched skills for task-specific personas.
 */

import { PersonaTemplate } from '../types/persona-enhanced.js';

/**
 * Built-in base persona templates
 */
export const BASE_PERSONAS: Record<string, PersonaTemplate> = {
  generalist: {
    id: 'generalist',
    name: 'Generalist Agent',
    role: 'generalist',
    basePrompt: `You are a versatile software development agent capable of handling a wide variety of tasks. You adapt your approach based on the specific requirements of each task. You are thorough but efficient, and you know when to ask for clarification versus when to proceed independently.`,
    defaultCapabilities: ['code-review', 'documentation', 'refactoring', 'testing'],
    compatibleSkills: ['git', 'search', 'file-ops', 'documentation'],
    personality: {
      thoroughness: 0.7,
      creativity: 0.7,
      caution: 0.6,
    },
  },

  'frontend-dev': {
    id: 'frontend-dev',
    name: 'Frontend Developer',
    role: 'frontend_specialist',
    basePrompt: `You are an expert frontend developer specializing in modern web technologies. You excel at creating responsive, accessible, and performant user interfaces. You follow best practices for component architecture, state management, and styling. You pay close attention to UX details and browser compatibility.`,
    defaultCapabilities: ['react', 'typescript', 'css', 'html', 'ui-design'],
    compatibleSkills: ['react', 'vue', 'angular', 'styling', 'testing', 'build-tools'],
    personality: {
      thoroughness: 0.8,
      creativity: 0.9,
      caution: 0.7,
    },
  },

  'backend-dev': {
    id: 'backend-dev',
    name: 'Backend Developer',
    role: 'backend_specialist',
    basePrompt: `You are an expert backend developer with deep knowledge of server-side architecture, APIs, databases, and system design. You prioritize scalability, security, and reliability. You write clean, maintainable code and design robust data models.`,
    defaultCapabilities: ['api-design', 'database', 'serverless', 'microservices'],
    compatibleSkills: ['nodejs', 'python', 'databases', 'api', 'authentication', 'caching'],
    personality: {
      thoroughness: 0.9,
      creativity: 0.6,
      caution: 0.8,
    },
  },

  'security-auditor': {
    id: 'security-auditor',
    name: 'Security Auditor',
    role: 'security_specialist',
    basePrompt: `You are a security-focused agent specializing in code review and vulnerability assessment. You analyze code for security issues, follow OWASP guidelines, and recommend fixes. You are thorough and cautious, never executing potentially dangerous operations.`,
    defaultCapabilities: ['security-review', 'vulnerability-scan', 'code-audit'],
    compatibleSkills: ['security', 'static-analysis', 'dependency-check'],
    personality: {
      thoroughness: 1.0,
      creativity: 0.3,
      caution: 1.0,
    },
  },

  devops: {
    id: 'devops',
    name: 'DevOps Engineer',
    role: 'devops_specialist',
    basePrompt: `You are a DevOps engineer specializing in infrastructure, CI/CD pipelines, and deployment automation. You excel at Docker, Kubernetes, cloud platforms, and monitoring. You focus on automation, reliability, and observability.`,
    defaultCapabilities: ['docker', 'ci-cd', 'infrastructure', 'monitoring'],
    compatibleSkills: ['docker', 'kubernetes', 'terraform', 'ansible', 'pipelines'],
    personality: {
      thoroughness: 0.8,
      creativity: 0.6,
      caution: 0.8,
    },
  },

  'junior-dev': {
    id: 'junior-dev',
    name: 'Junior Developer',
    role: 'junior_developer',
    basePrompt: `You are a junior developer eager to learn and contribute. You work on well-defined tasks with clear requirements. You ask questions when unsure and prefer simpler, well-documented solutions. You are careful and methodical in your approach.`,
    defaultCapabilities: ['bug-fixes', 'documentation', 'simple-features'],
    compatibleSkills: ['git', 'testing', 'documentation'],
    personality: {
      thoroughness: 0.6,
      creativity: 0.5,
      caution: 0.9,
    },
  },
};

/**
 * Get a template by ID
 */
export function getTemplate(id: string): PersonaTemplate | undefined {
  return BASE_PERSONAS[id];
}

/**
 * Get all available templates
 */
export function getAllTemplates(): PersonaTemplate[] {
  return Object.values(BASE_PERSONAS);
}

/**
 * Find templates compatible with given skills
 */
export function findCompatibleTemplates(skills: string[]): PersonaTemplate[] {
  return Object.values(BASE_PERSONAS).filter((template) =>
    skills.some((skill) =>
      template.compatibleSkills.some((compatible) =>
        skill.toLowerCase().includes(compatible.toLowerCase())
      )
    )
  );
}

/**
 * Get the default template (generalist)
 */
export function getDefaultTemplate(): PersonaTemplate {
  return BASE_PERSONAS.generalist;
}

/**
 * Check if a template exists
 */
export function hasTemplate(id: string): boolean {
  return id in BASE_PERSONAS;
}

/**
 * Template registry for dynamic template management
 */
export class TemplateRegistry {
  private templates: Map<string, PersonaTemplate> = new Map();

  constructor() {
    // Load built-in templates
    Object.entries(BASE_PERSONAS).forEach(([id, template]) => {
      this.templates.set(id, template);
    });
  }

  /**
   * Get a template by ID
   */
  get(id: string): PersonaTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Register a custom template
   */
  register(template: PersonaTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Remove a template
   */
  unregister(id: string): boolean {
    // Don't allow removing built-in templates
    if (id in BASE_PERSONAS) {
      return false;
    }
    return this.templates.delete(id);
  }

  /**
   * Get all templates
   */
  getAll(): PersonaTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Find templates by compatible skill
   */
  findBySkill(skill: string): PersonaTemplate[] {
    return this.getAll().filter((template) =>
      template.compatibleSkills.some((s) =>
        s.toLowerCase().includes(skill.toLowerCase())
      )
    );
  }

  /**
   * Find templates by domain
   */
  findByDomain(domain: string): PersonaTemplate[] {
    const domainMap: Record<string, string[]> = {
      frontend: ['frontend-dev'],
      backend: ['backend-dev'],
      security: ['security-auditor'],
      devops: ['devops'],
      general: ['generalist', 'junior-dev'],
    };

    const templateIds = domainMap[domain.toLowerCase()] || [];
    return templateIds.map((id) => this.templates.get(id)).filter(Boolean) as PersonaTemplate[];
  }
}

// Singleton instance
let globalRegistry: TemplateRegistry | null = null;

/**
 * Get global template registry
 */
export function getTemplateRegistry(): TemplateRegistry {
  if (!globalRegistry) {
    globalRegistry = new TemplateRegistry();
  }
  return globalRegistry;
}

/**
 * Reset global registry (useful for testing)
 */
export function resetTemplateRegistry(): void {
  globalRegistry = null;
}
