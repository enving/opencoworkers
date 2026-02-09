import { z } from 'zod';

export const ServerProfileSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().positive().default(4096),
  apiKey: z.string().optional(),
  type: z.enum(['local', 'remote-api', 'docker-managed']),
  isDefault: z.boolean().default(false),
  lastHealthCheck: z.string().optional(),
  status: z.enum(['online', 'offline', 'unknown']).default('unknown'),
});

export type ServerProfile = z.infer<typeof ServerProfileSchema>;

export const ServersConfigSchema = z.object({
  profiles: z.array(ServerProfileSchema),
});

export type ServersConfig = z.infer<typeof ServersConfigSchema>;
