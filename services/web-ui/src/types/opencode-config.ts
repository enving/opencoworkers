/**
 * OpenCode Config Types (FR-509: Visual Admin Config)
 * Based on OpenCode Config Manager (OCCM) schema
 */

// Provider SDK types
export type ProviderSDK =
    | '@ai-sdk/anthropic'
    | '@ai-sdk/openai'
    | '@ai-sdk/google'
    | '@ai-sdk/azure'
    | '@ai-sdk/mistral'
    | 'custom';

export interface Provider {
    id: string;
    name: string;
    sdk: ProviderSDK;
    apiKey: string;
    baseUrl?: string;
    enabled: boolean;
}

// Model thinking configuration varies by provider
export interface AnthropicThinking {
    type: 'enabled' | 'disabled';
    budgetTokens?: number;
}

export interface OpenAIThinking {
    reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh';
}

export interface GeminiThinking {
    thinkingBudget?: number;
}

export type ModelThinking = AnthropicThinking | OpenAIThinking | GeminiThinking;

export interface ModelOptions {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    thinking?: ModelThinking;
}

export interface Model {
    id: string;
    name: string;
    provider: string; // Provider ID
    model: string;    // Model name (e.g., 'claude-3-5-sonnet-20241022')
    options?: ModelOptions;
    variants?: Record<string, any>;
    enabled: boolean;
}

// MCP Server types
export type McpServerType = 'local' | 'remote';

export interface McpServerLocal {
    type: 'local';
    command: string;
    args?: string[];
    env?: Record<string, string>;
}

export interface McpServerRemote {
    type: 'remote';
    url: string;
    headers?: Record<string, string>;
}

export interface McpServer {
    name: string;
    config: McpServerLocal | McpServerRemote;
    enabled: boolean;
    timeout?: number;
}

// Agent configuration
export type AgentMode = 'primary' | 'subagent' | 'all';
export type PermissionValue = 'allow' | 'ask' | 'deny';

export interface AgentConfig {
    name: string;
    mode: AgentMode;
    temperature?: number;
    maxSteps?: number;
    hidden?: boolean;
    disabled?: boolean;
    model?: string;
    permission?: {
        edit?: PermissionValue;
        bash?: PermissionValue;
        webfetch?: PermissionValue;
    };
    tools?: string[];
}

// Complete OpenCode config structure
// IMPORTANT: Use 'provider' (singular) and 'mcp' - NOT 'providers' or 'mcpServers'
export interface OpenCodeConfig {
    provider?: Record<string, { options?: { apiKey?: string; baseURL?: string } }>;
    models?: Record<string, Omit<Model, 'id'>>;
    mcp?: Record<string, { type: string; command?: string[] | string; args?: string[]; enabled?: boolean }>;
    agent?: Record<string, Omit<AgentConfig, 'name'>>;
    model?: string;
    // Additional settings
    theme?: 'dark' | 'light' | 'auto';
    autoApprove?: boolean;
}

// Preset models for quick selection
export interface PresetModel {
    id: string;
    name: string;
    provider: ProviderSDK;
    model: string;
    description: string;
    options?: ModelOptions;
}

export const PRESET_MODELS: PresetModel[] = [
    // Anthropic Claude
    {
        id: 'claude-4-opus',
        name: 'Claude 4 Opus',
        provider: '@ai-sdk/anthropic',
        model: 'claude-sonnet-4-20250514',
        description: 'Most capable Claude model for complex tasks'
    },
    {
        id: 'claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        provider: '@ai-sdk/anthropic',
        model: 'claude-3-5-sonnet-20241022',
        description: 'Best balance of speed and intelligence'
    },
    {
        id: 'claude-3.5-haiku',
        name: 'Claude 3.5 Haiku',
        provider: '@ai-sdk/anthropic',
        model: 'claude-3-5-haiku-20241022',
        description: 'Fast and efficient for simple tasks'
    },
    // OpenAI
    {
        id: 'gpt-5',
        name: 'GPT-5',
        provider: '@ai-sdk/openai',
        model: 'gpt-5',
        description: 'Latest OpenAI flagship model'
    },
    {
        id: 'gpt-4.1',
        name: 'GPT-4.1',
        provider: '@ai-sdk/openai',
        model: 'gpt-4.1',
        description: 'OpenAI standard model'
    },
    {
        id: 'o3',
        name: 'o3 (Reasoning)',
        provider: '@ai-sdk/openai',
        model: 'o3',
        description: 'Advanced reasoning model',
        options: { thinking: { reasoningEffort: 'high' } as OpenAIThinking }
    },
    // Google
    {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        provider: '@ai-sdk/google',
        model: 'gemini-2.5-pro-preview-05-06',
        description: 'Google flagship model'
    },
    {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: '@ai-sdk/google',
        model: 'gemini-2.5-flash-preview-04-17',
        description: 'Fast Google model'
    },
    // Mistral
    {
        id: 'mistral-large',
        name: 'Mistral Large',
        provider: '@ai-sdk/mistral',
        model: 'mistral-large-latest',
        description: 'Mistral flagship model'
    },
    {
        id: 'mistral-small',
        name: 'Mistral Small',
        provider: '@ai-sdk/mistral',
        model: 'mistral-small-latest',
        description: 'Cost-effective Mistral model'
    }
];

// Preset MCP servers
export interface PresetMcpServer {
    name: string;
    description: string;
    config: McpServerLocal | McpServerRemote;
}

export const PRESET_MCP_SERVERS: PresetMcpServer[] = [
    {
        name: 'context7',
        description: 'Context7 documentation retrieval',
        config: {
            type: 'local',
            command: 'npx',
            args: ['-y', '@upstash/context7-mcp@latest']
        }
    },
    {
        name: 'filesystem',
        description: 'Read and write files',
        config: {
            type: 'local',
            command: 'npx',
            args: ['-y', '@anthropics/mcp-server-filesystem']
        }
    },
    {
        name: 'github',
        description: 'GitHub repository access',
        config: {
            type: 'local',
            command: 'npx',
            args: ['-y', '@anthropics/mcp-server-github'],
            env: { GITHUB_PERSONAL_ACCESS_TOKEN: '' }
        }
    },
    {
        name: 'sentry',
        description: 'Sentry error tracking',
        config: {
            type: 'local',
            command: 'npx',
            args: ['-y', '@sentry/mcp-server']
        }
    }
];
