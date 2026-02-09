import { ApiIntegration } from '../types/integration.js';

/**
 * Service to map generic API integrations to semantic agent instructions.
 * This forms the "Semantic Layer" (TASK-180) enabling agents to understand how to use tools.
 */
export class SkillMapper {
    /**
     * Generates a semantic system prompt section describing available API tools.
     * @param integrations List of available integrations
     * @returns Formatted markdown string for the system prompt
     */
    static generateToolContext(integrations: ApiIntegration[]): string {
        const activeIntegrations = integrations.filter(i => i.enabled);

        if (activeIntegrations.length === 0) return '';

        let context = '\n\n## 🛠️ Connected External APIs\nYou have access to the following external tools. Use them intelligently based on the instructions below:\n\n';

        activeIntegrations.forEach(integration => {
            const instructions = integration.semanticInstructions?.trim()
                ? integration.semanticInstructions
                : `Generic REST API. Call this endpoint to interact with ${integration.name}.`;

            const tags = integration.suggestedUseCases?.length
                ? `Keywords: ${integration.suggestedUseCases.join(', ')}`
                : '';

            context += `### 🔌 ${integration.name}\n`;
            if (integration.description) {
                context += `> ${integration.description}\n`;
            }
            context += `\n`;
            context += `- **Goal**: ${instructions}\n`;
            if (tags) {
                context += `- **${tags}**\n`;
            }
            context += `- **Base URL**: \`${integration.baseUrl}\`\n`;

            // Add a hint about authentication without revealing secrets
            if (integration.authType !== 'none') {
                context += `- **Auth**: Automatically handled (${integration.authType})\n`;
            }

            context += `\n---\n\n`;
        });

        return context;
    }
}
