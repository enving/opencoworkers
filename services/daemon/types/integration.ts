import { z } from 'zod';

/**
 * API Integration Schema for Generic REST API Connectors
 * Allows agents to use custom HTTP endpoints as tools
 */

export const AuthTypeSchema = z.enum(['none', 'bearer', 'apiKey', 'basic']);
export type AuthType = z.infer<typeof AuthTypeSchema>;

export const HttpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
export type HttpMethod = z.infer<typeof HttpMethodSchema>;

export const ApiIntegrationSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    baseUrl: z.string().url(),
    headers: z.record(z.string(), z.string()).default({}),
    authType: AuthTypeSchema.default('none'),
    authConfig: z.object({
        token: z.string().optional(),      // For bearer tokens
        apiKeyName: z.string().optional(), // Header name for API key
        apiKeyValue: z.string().optional(), // The API key value
        username: z.string().optional(),   // For basic auth
        password: z.string().optional()    // For basic auth
    }).optional(),
    // TASK-180: Semantic Skill Mapping
    semanticInstructions: z.string().optional().describe("Natural language instructions for the agent on how/when to use this API"),
    suggestedUseCases: z.array(z.string()).default([]),
    isDefault: z.boolean().default(false),
    enabled: z.boolean().default(true),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
});

export type ApiIntegration = z.infer<typeof ApiIntegrationSchema>;

export const ApiIntegrationCreateSchema = ApiIntegrationSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true
});

export type ApiIntegrationCreate = z.infer<typeof ApiIntegrationCreateSchema>;

export const IntegrationsFileSchema = z.object({
    version: z.string().default('1.0.0'),
    integrations: z.array(ApiIntegrationSchema).default([])
});

export type IntegrationsFile = z.infer<typeof IntegrationsFileSchema>;
