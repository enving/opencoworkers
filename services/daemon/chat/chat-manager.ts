/**
 * ChatManager - FEAT-CHAT
 * 
 * Manages chat conversations and message handling.
 * Supports streaming responses and conversation persistence.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { ConfigLoader } from '../config/config-loader.js';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    model?: string;
    tokens?: {
        prompt: number;
        completion: number;
    };
    thinking?: string;
}

export interface ChatConversation {
    id: string;
    title: string;
    messages: ChatMessage[];
    model: string;
    createdAt: string;
    updatedAt: string;
}

export interface ChatConfig {
    systemPrompt: string;
    model: string;
    temperature: number;
    maxTokens: number;
}

const DEFAULT_CONFIG: ChatConfig = {
    systemPrompt: `You are a helpful AI assistant integrated into OpenCoworkers, a virtual workforce automation platform. You help users with:
- Code-related questions and debugging
- Project management tasks
- General technical questions
- Workflow automation ideas

Be concise, helpful, and proactive. When discussing code, use markdown code blocks with syntax highlighting.`,
    model: 'claude-sonnet-4-20250514',
    temperature: 0.7,
    maxTokens: 4096,
};

export class ChatManager {
    private basePath: string;
    private conversations: Map<string, ChatConversation> = new Map();
    private config: ChatConfig = { ...DEFAULT_CONFIG };

    constructor(basePath: string = '.agent-config') {
        this.basePath = basePath;
    }

    private get conversationsPath(): string {
        return path.join(this.basePath, 'chat', 'conversations');
    }

    private get configPath(): string {
        return path.join(this.basePath, 'chat', 'config.json');
    }

    /**
     * Initialize the chat manager
     */
    async init(): Promise<void> {
        // Ensure directories exist
        await fs.mkdir(this.conversationsPath, { recursive: true });

        // Load config
        try {
            const content = await fs.readFile(this.configPath, 'utf-8');
            this.config = { ...DEFAULT_CONFIG, ...JSON.parse(content) };
        } catch {
            // Use defaults
            await this.saveConfig();
        }

        // Load existing conversations
        await this.loadConversations();
    }

    /**
     * Load all conversations from disk
     */
    private async loadConversations(): Promise<void> {
        try {
            const files = await fs.readdir(this.conversationsPath);

            for (const file of files) {
                if (!file.endsWith('.json')) continue;

                try {
                    const content = await fs.readFile(
                        path.join(this.conversationsPath, file),
                        'utf-8'
                    );
                    const conv = JSON.parse(content) as ChatConversation;
                    this.conversations.set(conv.id, conv);
                } catch (e) {
                    console.warn(`[ChatManager] Failed to load conversation ${file}:`, e);
                }
            }

            console.log(`[ChatManager] Loaded ${this.conversations.size} conversations`);
        } catch {
            // Directory doesn't exist yet, that's ok
        }
    }

    /**
     * Save a conversation to disk
     */
    private async saveConversation(conv: ChatConversation): Promise<void> {
        const filePath = path.join(this.conversationsPath, `${conv.id}.json`);
        await fs.writeFile(filePath, JSON.stringify(conv, null, 2), 'utf-8');
    }

    /**
     * Save config to disk
     */
    private async saveConfig(): Promise<void> {
        await fs.mkdir(path.dirname(this.configPath), { recursive: true });
        await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    }

    /**
     * List all conversations (metadata only)
     */
    listConversations(): ChatConversation[] {
        const convs = Array.from(this.conversations.values());
        // Sort by updatedAt descending (most recent first)
        return convs.sort((a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
    }

    /**
     * Get a specific conversation
     */
    getConversation(id: string): ChatConversation | null {
        return this.conversations.get(id) || null;
    }

    /**
     * Create a new conversation
     */
    async createConversation(title?: string, model?: string): Promise<ChatConversation> {
        const conv: ChatConversation = {
            id: randomUUID(),
            title: title || 'New Chat',
            messages: [],
            model: model || this.config.model,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        this.conversations.set(conv.id, conv);
        await this.saveConversation(conv);

        return conv;
    }

    /**
     * Delete a conversation
     */
    async deleteConversation(id: string): Promise<boolean> {
        if (!this.conversations.has(id)) {
            return false;
        }

        this.conversations.delete(id);

        try {
            const filePath = path.join(this.conversationsPath, `${id}.json`);
            await fs.unlink(filePath);
        } catch {
            // File might not exist
        }

        return true;
    }

    /**
     * Rename a conversation
     */
    async renameConversation(id: string, title: string): Promise<boolean> {
        const conv = this.conversations.get(id);
        if (!conv) return false;

        conv.title = title;
        conv.updatedAt = new Date().toISOString();

        await this.saveConversation(conv);
        return true;
    }

    /**
     * Add a message to a conversation
     */
    async addMessage(conversationId: string, message: ChatMessage): Promise<void> {
        const conv = this.conversations.get(conversationId);
        if (!conv) {
            throw new Error('Conversation not found');
        }

        conv.messages.push(message);
        conv.updatedAt = new Date().toISOString();

        // Auto-title from first user message if title is default
        if (conv.title === 'New Chat' && message.role === 'user') {
            conv.title = message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '');
        }

        await this.saveConversation(conv);
    }

    /**
     * Get or create a conversation for ephemeral chats
     */
    async getOrCreateEphemeralConversation(title?: string, model?: string): Promise<ChatConversation> {
        // For now, always create a new one
        // In future, could return the most recent if it's empty
        return this.createConversation(title, model);
    }

    /**
     * Get chat config
     */
    getConfig(): ChatConfig & { availableModels: string[] } {
        // Read from OpenCode config
        const opencodeConfig = ConfigLoader.loadOpenCodeConfig();
        const providers = opencodeConfig.provider || {};
        const configuredModels = opencodeConfig.models || {};

        const availableModels: string[] = [];

        // 1. Add explicitly configured models
        for (const modelId in configuredModels) {
            const model = configuredModels[modelId];
            if (model.enabled !== false) {
                availableModels.push(modelId);
            }
        }

        // 2. Infer models from providers/SDKs
        for (const providerId in providers) {
            const provider = providers[providerId];

            // Check if models are explicitly listed in provider (legacy)
            if (provider.models && Array.isArray(provider.models)) {
                availableModels.push(...provider.models);
            }

            // Infer based on provider ID or structure
            const pid = providerId.toLowerCase();
            // Note: In real app we might check provider.sdk if available, but it's not in opencode.json schema usually

            if (pid.includes('mistral')) {
                availableModels.push('mistral-large-latest', 'mistral-small-latest');
            } else if (pid.includes('openai')) {
                availableModels.push('gpt-4o', 'gpt-4o-mini');
            } else if (pid.includes('anthropic') || pid.includes('claude')) {
                availableModels.push('claude-3-5-sonnet-20241022');
            } else if (pid.includes('google') || pid.includes('gemini')) {
                availableModels.push('gemini-2.5-pro');
            }
        }

        const uniqueModels = Array.from(new Set(availableModels));
        console.log('[ChatManager] Discovered models:', uniqueModels);

        // Fallback to default models ONLY if no providers are configured at all
        if (uniqueModels.length === 0) {
            console.log('[ChatManager] No models configured/detected, using defaults');
            uniqueModels.push(
                'claude-sonnet-4-20250514',
                'claude-3-5-sonnet-20241022',
                'gpt-4o',
                'gpt-4o-mini',
                'gemini-2.5-pro',
                'gemini-2.5-flash',
                'mistral-large-latest',
                'mistral-small-latest',
            );
        }

        return {
            ...this.config,
            availableModels: uniqueModels,
        };
    }

    /**
     * Update chat config
     */
    async updateConfig(updates: Partial<ChatConfig>): Promise<void> {
        this.config = { ...this.config, ...updates };
        await this.saveConfig();
    }

    /**
     * Clear all conversation history
     */
    async clearHistory(): Promise<void> {
        // Delete all conversation files
        for (const id of this.conversations.keys()) {
            try {
                const filePath = path.join(this.conversationsPath, `${id}.json`);
                await fs.unlink(filePath);
            } catch {
                // Ignore
            }
        }

        this.conversations.clear();
    }

    /**
     * Build messages array for API call
     */
    buildMessagesForApi(conversationId: string | null): Array<{ role: string; content: string }> {
        const messages: Array<{ role: string; content: string }> = [];

        // Add system prompt
        if (this.config.systemPrompt) {
            messages.push({
                role: 'system',
                content: this.config.systemPrompt,
            });
        }

        // Add conversation history
        if (conversationId) {
            const conv = this.conversations.get(conversationId);
            if (conv) {
                for (const msg of conv.messages) {
                    messages.push({
                        role: msg.role,
                        content: msg.content,
                    });
                }
            }
        }

        return messages;
    }
}

export default ChatManager;
