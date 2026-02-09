import fs from 'fs/promises';
import path from 'path';

export interface OpenClawSkill {
    name: string;
    description: string;
    emoji?: string;
    requiresBins: string[];
    path: string;
    content: string;
}

export class SkillRegistry {
    private skillsDir: string;
    private cache: Map<string, OpenClawSkill> = new Map();

    constructor(vendorPath: string) {
        this.skillsDir = path.resolve(vendorPath, 'skills');
    }

    async scan(): Promise<OpenClawSkill[]> {
        try {
            const entries = await fs.readdir(this.skillsDir, { withFileTypes: true });
            const skills: OpenClawSkill[] = [];

            for (const entry of entries) {
                if (!entry.isDirectory()) continue;

                const skillPath = path.join(this.skillsDir, entry.name, 'SKILL.md');
                try {
                    // Check if SKILL.md exists
                    await fs.access(skillPath);
                    const content = await fs.readFile(skillPath, 'utf-8');

                    // Simple frontmatter parsing (yaml-like)
                    const nameMatch = content.match(/^name:\s*(.+)$/m);
                    const descMatch = content.match(/^description:\s*"(.*)"$/m) || content.match(/^description:\s*(.+)$/m);
                    const emojiMatch = content.match(/emoji:\s*"(.)"/);

                    // Naive requires parsing
                    const binsMatch = content.match(/"requires":\s*{\s*"bins":\s*\[(.*?)\]/);
                    const requiresBins = binsMatch && binsMatch[1]
                        ? binsMatch[1].split(',').map(s => s.trim().replace(/['"]/g, ''))
                        : [];

                    const name = nameMatch && nameMatch[1] ? nameMatch[1].trim() : entry.name;
                    const description = descMatch && descMatch[1] ? descMatch[1].trim() : "No description provided";
                    const emoji = emojiMatch && emojiMatch[1] ? emojiMatch[1] : "📦";

                    skills.push({
                        name,
                        description,
                        emoji,
                        requiresBins,
                        path: skillPath,
                        content
                    });
                } catch (e) {
                    // Skip directories without SKILL.md
                    continue;
                }
            }

            this.cache.clear();
            skills.forEach(s => this.cache.set(s.name, s));
            return skills;

        } catch (err) {
            console.error('[SkillRegistry] Failed to scan skills:', err);
            return [];
        }
    }

    getSkill(name: string): OpenClawSkill | undefined {
        return this.cache.get(name);
    }

    getSkillsPromptSnippet(): string {
        const list = Array.from(this.cache.values())
            .map(s => `- ${s.name}: ${s.description}`)
            .join('\n');
        return `\n<available_skills>\n${list}\n</available_skills>\n`;
    }
}
