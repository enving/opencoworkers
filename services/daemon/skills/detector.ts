import { SkillRegistry, RegistryConfig } from './registry.js';

export class SkillDetector {
  private skillRegistry: SkillRegistry;
  private labelMappings: Map<string, string>;
  private categoryMappings: Map<string, string>;

  constructor(config?: RegistryConfig | string) {
    if (typeof config === 'string') {
      this.skillRegistry = new SkillRegistry({ type: 'posix', rootPath: config });
    } else {
      this.skillRegistry = new SkillRegistry(config || { type: 'posix' });
    }

    this.labelMappings = new Map([
      ['pptx', 'pptx'],
      ['powerpoint', 'pptx'],
      ['presentation', 'pptx'],
      ['slide', 'pptx'],
      ['slides', 'pptx'],
      ['xlsx', 'xlsx'],
      ['excel', 'xlsx'],
      ['spreadsheet', 'xlsx'],
      ['csv', 'xlsx'],
      ['data', 'xlsx'],
      ['calendar', 'calendar'],
      ['schedule', 'calendar'],
      ['meeting', 'calendar'],
      ['event', 'calendar'],
      ['email', 'email'],
      ['mail', 'email'],
      ['document', 'docx'],
      ['doc', 'docx'],
      ['word', 'docx'],
      ['pdf', 'pdf'],
      ['report', 'docx']
    ]);

    this.categoryMappings = new Map([
      ['presentation', 'pptx'],
      ['data-analysis', 'xlsx'],
      ['scheduling', 'calendar'],
      ['communication', 'email'],
      ['documentation', 'docx'],
      ['development', 'general'],
      ['code', 'general'],
      ['automation', 'general']
    ]);
  }

  async initialize(): Promise<void> {
    try {
      await this.skillRegistry.discover();
    } catch (error) {
      console.log('[SkillDetector] Skill registry discovery failed, continuing with default mappings:', error);
    }
  }

  detectSkillFromLabels(labels: string[] = []): string | null {
    if (!labels || labels.length === 0) {
      return null;
    }

    const lowerLabels = labels.map(label => label.toLowerCase());

    for (const label of lowerLabels) {
      if (this.labelMappings.has(label)) {
        return this.labelMappings.get(label)!;
      }
    }

    for (const label of lowerLabels) {
      for (const [labelKey, skill] of this.labelMappings.entries()) {
        if (label.includes(labelKey)) {
          return skill;
        }
      }
    }

    return null;
  }

  detectSkillFromCategory(category: string = ''): string | null {
    if (!category) {
      return null;
    }

    const lowerCategory = category.toLowerCase();

    if (this.categoryMappings.has(lowerCategory)) {
      return this.categoryMappings.get(lowerCategory)!;
    }

    for (const [categoryKey, skill] of this.categoryMappings.entries()) {
      if (lowerCategory.includes(categoryKey)) {
        return skill;
      }
    }

    return null;
  }

  detectSkillFromDescription(description: string = ''): string | null {
    if (!description) {
      return null;
    }

    const lowerDesc = description.toLowerCase();

    const patterns = [
      { pattern: /(pptx|powerpoint|presentation|slide)/, skill: 'pptx' },
      { pattern: /(xlsx|excel|spreadsheet|csv|data\s+analysis)/, skill: 'xlsx' },
      { pattern: /(calendar|schedule|meeting|event)/, skill: 'calendar' },
      { pattern: /(email|mail|message)/, skill: 'email' },
      { pattern: /(document|docx|word|report)/, skill: 'docx' },
      { pattern: /(pdf|portable\s+document)/, skill: 'pdf' }
    ];

    for (const { pattern, skill } of patterns) {
      if (pattern.test(lowerDesc)) {
        return skill;
      }
    }

    return null;
  }

  async detectSkill(params: {
    title?: string;
    labels?: string[];
    category?: string;
    description?: string;
    existingSkill?: string;
  }): Promise<string> {
    const { title, labels, category, description, existingSkill } = params;

    if (existingSkill) {
      return existingSkill;
    }

    const labelSkill = this.detectSkillFromLabels(labels);
    if (labelSkill) {
      return labelSkill;
    }

    const categorySkill = this.detectSkillFromCategory(category);
    if (categorySkill) {
      return categorySkill;
    }

    const descSkill = this.detectSkillFromDescription(`${title || ''} ${description || ''}`);
    if (descSkill) {
      return descSkill;
    }

    return 'general';
  }

  async getSkillInstruction(skillName: string): Promise<string> {
    return await this.skillRegistry.getInstructionForSkill(skillName);
  }

  addLabelMapping(label: string, skill: string): void {
    this.labelMappings.set(label.toLowerCase(), skill);
  }

  addCategoryMapping(category: string, skill: string): void {
    this.categoryMappings.set(category.toLowerCase(), skill);
  }

  async getAvailableSkills(): Promise<string[]> {
    const skills = await this.skillRegistry.discover();
    return skills.map(skill => skill.name);
  }
}