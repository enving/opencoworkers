/**
 * Chat API - FEAT-CHAT
 * 
 * API client for the simple chat interface.
 * Supports streaming responses and conversation history.
 */

const API_BASE = '/api';

// Types
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
    systemPrompt?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
}

export interface SendMessageOptions {
    conversationId?: string;
    model?: string;
    systemPrompt?: string;
    stream?: boolean;
}

export interface StreamCallbacks {
    onToken?: (token: string) => void;
    onThinking?: (thinking: string) => void;
    onComplete?: (message: ChatMessage) => void;
    onError?: (error: Error) => void;
}

// API functions
export const chatApi = {
    /**
     * Get all conversations
     */
    async listConversations(): Promise<ChatConversation[]> {
        const res = await fetch(`${API_BASE}/chat/conversations`);
        if (!res.ok) throw new Error('Failed to list conversations');
        return res.json();
    },

    /**
     * Get a specific conversation with messages
     */
    async getConversation(id: string): Promise<ChatConversation> {
        const res = await fetch(`${API_BASE}/chat/conversations/${id}`);
        if (!res.ok) throw new Error('Conversation not found');
        return res.json();
    },

    /**
     * Create a new conversation
     */
    async createConversation(title?: string, model?: string): Promise<ChatConversation> {
        const res = await fetch(`${API_BASE}/chat/conversations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, model }),
        });
        if (!res.ok) throw new Error('Failed to create conversation');
        return res.json();
    },

    /**
     * Delete a conversation
     */
    async deleteConversation(id: string): Promise<void> {
        const res = await fetch(`${API_BASE}/chat/conversations/${id}`, {
            method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete conversation');
    },

    /**
     * Rename a conversation
     */
    async renameConversation(id: string, title: string): Promise<void> {
        const res = await fetch(`${API_BASE}/chat/conversations/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }),
        });
        if (!res.ok) throw new Error('Failed to rename conversation');
    },

    /**
     * Send a message and get a streaming response
     */
    async sendMessage(
        content: string,
        options: SendMessageOptions = {},
        callbacks: StreamCallbacks = {}
    ): Promise<ChatMessage> {
        const { conversationId, model, systemPrompt, stream = true } = options;
        const { onToken, onThinking, onComplete, onError } = callbacks;

        const res = await fetch(`${API_BASE}/chat/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content,
                conversationId,
                model,
                systemPrompt,
                stream,
            }),
        });

        if (!res.ok) {
            const error = new Error('Failed to send message');
            onError?.(error);
            throw error;
        }

        // Handle streaming response
        if (stream && res.body) {
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';
            let thinkingContent = '';
            let messageData: ChatMessage | null = null;

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (!line.trim() || !line.startsWith('data: ')) continue;

                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);

                            if (parsed.type === 'token') {
                                fullContent += parsed.content;
                                onToken?.(parsed.content);
                            } else if (parsed.type === 'thinking') {
                                thinkingContent += parsed.content;
                                onThinking?.(parsed.content);
                            } else if (parsed.type === 'complete') {
                                messageData = parsed.message;
                            } else if (parsed.type === 'error') {
                                throw new Error(parsed.message);
                            }
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }

                const finalMessage: ChatMessage = messageData || {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: fullContent,
                    timestamp: new Date().toISOString(),
                    thinking: thinkingContent || undefined,
                };

                onComplete?.(finalMessage);
                return finalMessage;
            } catch (e) {
                const error = e instanceof Error ? e : new Error('Stream error');
                onError?.(error);
                throw error;
            }
        } else {
            // Non-streaming response
            const message = await res.json() as ChatMessage;
            onComplete?.(message);
            return message;
        }
    },

    /**
     * Get chat configuration
     */
    async getConfig(): Promise<ChatConfig & { availableModels: string[] }> {
        const res = await fetch(`${API_BASE}/chat/config`);
        if (!res.ok) throw new Error('Failed to get chat config');
        return res.json();
    },

    /**
     * Update chat configuration
     */
    async updateConfig(config: ChatConfig): Promise<void> {
        const res = await fetch(`${API_BASE}/chat/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
        });
        if (!res.ok) throw new Error('Failed to update chat config');
    },

    /**
     * Clear conversation history
     */
    async clearHistory(): Promise<void> {
        const res = await fetch(`${API_BASE}/chat/history`, {
            method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to clear history');
    },
};

export default chatApi;
