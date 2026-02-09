
export interface SkillMetadata {
    name: string;
    description: string;
    commands: string[];
    scope: 'team' | 'personal';
    path: string; // Virtual path or URL
}

export interface ISkillProvider {
    /** Initialize connection (check folder existence / auth) */
    initialize(): Promise<void>;

    /** List all available skills */
    discover(): Promise<SkillMetadata[]>;

    /** Read a specific file from a skill (e.g. SKILL.md, script.js) */
    getFileContent(skillName: string, fileName: string): Promise<Buffer | null>;

    /** Save a new skill (Upload) - handles ZIP extraction or recursive write */
    saveSkill(skillName: string, files: Map<string, Buffer>): Promise<boolean>;
}
