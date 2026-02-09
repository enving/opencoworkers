/**
 * Skill Matcher
 * 
 * Analyzes ticket content and matches requirements to available skills.
 * Uses keyword matching, domain detection, and scoring algorithms.
 */

import { MatchResult, TicketAnalysis } from '../types/persona-enhanced.js';
import { Task } from '../types/tasks.js';
import { SkillRegistry, OpenClawSkill } from '../openclaw-adapters/skill-registry.js';

/**
 * Keywords database for skill matching
 */
const SKILL_KEYWORDS: Record<string, string[]> = {
  // Frontend skills
  react: ['react', 'jsx', 'tsx', 'component', 'hook', 'usestate', 'useeffect'],
  vue: ['vue', 'composition api', 'vuex', 'pinia', 'nuxt'],
  angular: ['angular', 'rxjs', 'ngrx', 'component'],
  styling: ['css', 'scss', 'sass', 'tailwind', 'styled-components', 'emotion', 'css-in-js'],
  'ui-components': ['button', 'modal', 'form', 'input', 'dropdown', 'component library'],
  
  // Backend skills
  nodejs: ['node', 'nodejs', 'express', 'fastify', 'nestjs', 'server'],
  python: ['python', 'django', 'flask', 'fastapi'],
  databases: ['database', 'sql', 'postgresql', 'mysql', 'mongodb', 'prisma', 'orm'],
  api: ['api', 'rest', 'graphql', 'endpoint', 'controller'],
  authentication: ['auth', 'authentication', 'jwt', 'oauth', 'login', 'password'],
  
  // DevOps skills
  docker: ['docker', 'container', 'dockerfile', 'docker-compose'],
  kubernetes: ['kubernetes', 'k8s', 'helm', 'pod', 'deployment'],
  ci: ['ci/cd', 'pipeline', 'github actions', 'gitlab ci', 'jenkins'],
  terraform: ['terraform', 'infrastructure', 'iac', 'aws', 'azure', 'gcp'],
  
  // General skills
  git: ['git', 'commit', 'branch', 'merge', 'pull request', 'repository'],
  testing: ['test', 'testing', 'jest', 'cypress', 'playwright', 'unit test'],
  documentation: ['docs', 'documentation', 'readme', 'swagger', 'openapi'],
  security: ['security', 'vulnerability', 'xss', 'csrf', 'sql injection', 'auth'],
  performance: ['performance', 'optimization', 'cache', 'lazy loading', 'bundle size'],
};

/**
 * Domain detection patterns
 */
const DOMAIN_PATTERNS: Record<string, string[]> = {
  frontend: ['frontend', 'ui', 'ux', 'interface', 'component', 'react', 'vue', 'angular', 'css', 'html'],
  backend: ['backend', 'api', 'server', 'database', 'endpoint', 'microservice'],
  security: ['security', 'vulnerability', 'audit', 'auth', 'permission', 'encrypt'],
  devops: ['devops', 'deploy', 'docker', 'kubernetes', 'ci/cd', 'pipeline', 'infrastructure'],
};

/**
 * Complexity indicators
 */
const COMPLEXITY_INDICATORS = {
  simple: ['simple', 'easy', 'quick', 'minor', 'fix', 'update', 'typo'],
  complex: ['complex', 'architecture', 'refactor', 'redesign', 'migration', 'rewrite', 'implement'],
};

/**
 * Analyzes tickets and matches skills
 */
export class SkillMatcher {
  private skillRegistry: SkillRegistry;

  constructor(skillRegistry: SkillRegistry) {
    this.skillRegistry = skillRegistry;
  }

  /**
   * Analyze a ticket and extract requirements
   */
  analyzeTicket(ticket: Task): TicketAnalysis {
    const content = this.getTicketContent(ticket);
    const lowerContent = content.toLowerCase();

    // Extract requirements
    const requirements = this.extractRequirements(content);

    // Detect complexity
    const complexity = this.detectComplexity(lowerContent);

    // Detect domains
    const domain = this.detectDomains(lowerContent);

    // Suggest skills based on content
    const suggestedSkills = this.suggestSkills(lowerContent);

    return {
      requirements,
      complexity,
      domain,
      suggestedSkills,
    };
  }

  /**
   * Find matching skills for a ticket
   */
  async findSkillsFor(ticket: Task): Promise<MatchResult[]> {
    const analysis = this.analyzeTicket(ticket);
    const availableSkills = await this.skillRegistry.scan();

    const matches: MatchResult[] = [];

    for (const skill of availableSkills) {
      const score = this.calculateMatchScore(skill, analysis);
      if (score > 0) {
        matches.push({
          skill: skill.name,
          score,
          reason: this.generateMatchReason(skill, analysis),
        });
      }
    }

    // Sort by score descending
    return matches.sort((a, b) => b.score - a.score);
  }

  /**
   * Get required skills above threshold
   */
  async getRequiredSkills(
    ticket: Task,
    threshold: number = 0.5
  ): Promise<string[]> {
    const matches = await this.findSkillsFor(ticket);
    return matches
      .filter((match) => match.score >= threshold)
      .map((match) => match.skill);
  }

  /**
   * Extract requirements from ticket
   */
  private extractRequirements(content: string): string[] {
    const requirements: string[] = [];

    // Look for requirement patterns
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // Match bullet points, numbered lists, requirement keywords
      if (
        trimmed.match(/^[-*•]\s+/) ||
        trimmed.match(/^\d+\.\s+/) ||
        trimmed.match(/^(should|must|need to|required)/i)
      ) {
        requirements.push(trimmed.replace(/^[-*•\d.]+\s*/, ''));
      }
    }

    return requirements;
  }

  /**
   * Detect task complexity
   */
  private detectComplexity(content: string): 'simple' | 'medium' | 'complex' {
    const simpleCount = COMPLEXITY_INDICATORS.simple.filter((word) =>
      content.includes(word)
    ).length;
    const complexCount = COMPLEXITY_INDICATORS.complex.filter((word) =>
      content.includes(word)
    ).length;

    if (complexCount > 0) return 'complex';
    if (simpleCount > 0) return 'simple';
    return 'medium';
  }

  /**
   * Detect relevant domains
   */
  private detectDomains(content: string): string[] {
    const domains: string[] = [];

    for (const [domain, patterns] of Object.entries(DOMAIN_PATTERNS)) {
      if (patterns.some((pattern) => content.includes(pattern))) {
        domains.push(domain);
      }
    }

    return domains.length > 0 ? domains : ['general'];
  }

  /**
   * Suggest skills based on content
   */
  private suggestSkills(content: string): string[] {
    const skills: string[] = [];

    for (const [skill, keywords] of Object.entries(SKILL_KEYWORDS)) {
      if (keywords.some((keyword) => content.includes(keyword))) {
        skills.push(skill);
      }
    }

    return skills;
  }

  /**
   * Calculate match score between skill and analysis
   */
  private calculateMatchScore(skill: OpenClawSkill, analysis: TicketAnalysis): number {
    let score = 0;
    const skillName = skill.name.toLowerCase();
    const skillDesc = skill.description.toLowerCase();

    // Exact match with suggested skills (highest weight)
    if (analysis.suggestedSkills.some((s) => skillName.includes(s.toLowerCase()))) {
      score += 0.5;
    }

    // Keyword overlap with description
    const keywords = SKILL_KEYWORDS[skillName] || [];
    const keywordMatches = keywords.filter((kw) =>
      analysis.requirements.some((req) => req.toLowerCase().includes(kw))
    ).length;
    score += keywordMatches * 0.15;

    // Domain match
    const domainKeywords: Record<string, string[]> = {
      frontend: ['react', 'vue', 'angular', 'css', 'ui'],
      backend: ['api', 'database', 'server', 'auth'],
      security: ['security', 'audit'],
      devops: ['docker', 'kubernetes', 'pipeline'],
    };

    for (const domain of analysis.domain) {
      const domainSkills = domainKeywords[domain] || [];
      if (domainSkills.some((ds) => skillName.includes(ds))) {
        score += 0.2;
      }
    }

    // Cap at 1.0
    return Math.min(score, 1.0);
  }

  /**
   * Generate human-readable match reason
   */
  private generateMatchReason(skill: OpenClawSkill, analysis: TicketAnalysis): string {
    const reasons: string[] = [];

    // Check for keyword matches
    const skillKeywords = SKILL_KEYWORDS[skill.name.toLowerCase()] || [];
    const matches = skillKeywords.filter((kw) =>
      analysis.requirements.some((req) => req.toLowerCase().includes(kw))
    );

    if (matches.length > 0) {
      reasons.push(`matched keywords: ${matches.slice(0, 3).join(', ')}`);
    }

    // Check domain
    const domainKeywords: Record<string, string[]> = {
      frontend: ['react', 'vue', 'angular', 'css', 'ui', 'component'],
      backend: ['api', 'database', 'server', 'auth', 'endpoint'],
      security: ['security', 'audit', 'vulnerability'],
      devops: ['docker', 'kubernetes', 'pipeline', 'deploy'],
    };

    for (const domain of analysis.domain) {
      const skills = domainKeywords[domain] || [];
      if (skills.some((s) => skill.name.toLowerCase().includes(s))) {
        reasons.push(`domain: ${domain}`);
        break;
      }
    }

    return reasons.length > 0 ? reasons.join('; ') : 'general match';
  }

  /**
   * Get combined ticket content
   */
  private getTicketContent(ticket: Task): string {
    const parts: string[] = [];
    
    if (ticket.title) parts.push(ticket.title);
    if (ticket.description) parts.push(ticket.description);
    
    return parts.join('\n\n');
  }
}

// Singleton instance
let globalMatcher: SkillMatcher | null = null;

/**
 * Get global skill matcher
 */
export function getSkillMatcher(skillRegistry: SkillRegistry): SkillMatcher {
  if (!globalMatcher) {
    globalMatcher = new SkillMatcher(skillRegistry);
  }
  return globalMatcher;
}

/**
 * Reset global matcher (useful for testing)
 */
export function resetSkillMatcher(): void {
  globalMatcher = null;
}
