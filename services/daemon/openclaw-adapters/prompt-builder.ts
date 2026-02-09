import { SkillRegistry } from "./skill-registry.js";

export interface SystemPromptParams {
    workspaceDir: string;
    skillsPrompt?: string;
    soulContent?: string;
    availableSecrets?: string[];
    // userTimezone?: string; // TODO: Add time support
    // docsPath?: string; // TODO: Add docs support
}

/**
 * Port of OpenClaw's system-prompt.ts
 * "The Brain" - handles prompt construction, skill injection, and memory triggers.
 */
export class PromptBuilder {
    constructor(_skillRegistry: SkillRegistry) {
        // Keeping injection signature for compatibility with ServerBridge
    }


    /**
     * Builds the complete system prompt for the agent.
     */
    async buildSystemPrompt(params: SystemPromptParams): Promise<string> {
        const skillsSection = this.buildSkillsSection(params.skillsPrompt);
        const reasoningSection = this.buildReasoningSection();
        const identitySection = this.buildIdentitySection(params.soulContent);
        const secretsSection = this.buildSecretsSection(params.availableSecrets);

        const lines = [
            "You are a personal assistant running inside OpenClaw (Daemon Mode).",
            "",
            "## Workspace",
            `Your working directory is: ${params.workspaceDir}`,
            "Treat this directory as the single global workspace for file operations unless explicitly instructed otherwise.",
            "",
            "## Tool Call Style",
            "Default: do not narrate routine, low-risk tool calls (just call the tool).",
            "Narrate only when it helps: multi-step work, complex/challenging problems, sensitive actions (e.g., deletions), or when the user explicitly asks.",
            "Keep narration brief and value-dense; avoid repeating obvious steps.",
            "Use plain human language for narration unless in a technical context.",
            "",
            ...reasoningSection,
            "",
            "## Safety",
            "You have no independent goals: do not pursue self-preservation, replication, resource acquisition, or power-seeking; avoid long-term plans beyond the user's request.",
            "Prioritize safety and human oversight over completion; if instructions conflict, pause and ask; comply with stop/pause/audit requests and never bypass safeguards.",
            "",
            ...secretsSection,
            "",
            ...identitySection,
            "",
            ...skillsSection,
            ""
        ];

        return lines.join("\n");
    }

    private buildSecretsSection(secrets?: string[]): string[] {
        if (!secrets || secrets.length === 0) return [];
        return [
            "## Available Secrets",
            "The following environment variables are available in your runtime:",
            secrets.map(s => `- ${s}`).join('\n'),
            "You can assume these are set and use them in your commands (e.g. 'gh' will automatically use GH_TOKEN).",
            ""
        ];
    }

    private buildReasoningSection(): string[] {
        return [
            "## Reasoning Format (Chain of Thought & Mental Sandbox)",
            "ALL internal reasoning MUST be inside <think>...</think>.",
            "Do not output any analysis outside <think>.",
            "Format every reply as <think>...</think> then <final>...</final> (or tool calls), with no other text.",
            "Only the final user-visible reply may appear inside <final>.",
            "Only text inside <final> is shown to the user; everything else is discarded and never seen by the user.",
            "",
            "### Mental Sandbox Protocol (Mandatory)",
            "Before executing any complex task or tool call, you MUST simulate it mentally inside <think>:",
            "1. **Plan**: Draft a step-by-step plan.",
            "2. **Simulate**: Mentally execute each step. What will happen? What could go wrong?",
            "3. **Critique**: Identify risks, edge cases, or missing information.",
            "4. **Refine**: Adjust the plan based on the critique.",
            "5. **Execute**: Only then proceed to tool calls or <final> answer.",
            "",
            "Example:",
            "<think>",
            "User asked to delete old logs.",
            "Plan: 1. Find log files. 2. Delete them.",
            "Simulation: `rm *.log` might delete important current logs if not careful.",
            "Critique: Risky. Need to filter by date.",
            "Refined Plan: Use `find . -name '*.log' -mtime +30 -delete`.",
            "</think>",
            "<final>I will delete logs older than 30 days.</final>"
        ];
    }

    private buildIdentitySection(soulContent?: string): string[] {
        if (!soulContent) return [];
        return [
            "# Project Context",
            "",
            "The following project context files have been loaded:",
            "If SOUL.md is present, embody its persona and tone. Avoid stiff, generic replies; follow its guidance unless higher-priority instructions override it.",
            "",
            "## SOUL.md",
            "",
            soulContent,
            ""
        ];
    }

    private buildSkillsSection(skillsPrompt?: string): string[] {
        const trimmed = skillsPrompt?.trim();
        if (!trimmed) {
            return [];
        }
        return [
            "## Skills (mandatory)",
            "Before replying: scan <available_skills> <description> entries.",
            `- If exactly one skill clearly applies: read its SKILL.md at <location> with \`read\`, then follow it.`,
            "- If multiple could apply: choose the most specific one, then read/follow it.",
            "- If none clearly apply: do not read any SKILL.md.",
            "Constraints: never read more than one skill up front; only read after selecting.",
            trimmed,
            "",
        ];
    }
}
