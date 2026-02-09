import { z } from 'zod';

export const MetaSchema = z.object({
  version: z.string(),
  last_updated: z.string().optional(),
  last_agent: z.string().optional(),
  project_phase: z.string().optional(),
});

export type Meta = z.infer<typeof MetaSchema>;

export const TaskSchema = z.object({
  id: z.string().regex(/^TASK-[\w-]+$/),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['planned', 'pending', 'in_progress', 'in_review', 'completed', 'cancelled', 'blocked']),
  skill: z.string().optional(),
  workflow_type: z.enum(['automatic-review', 'manual', 'orchestration']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  category: z.string().optional(),
  repository: z.string().optional(),
  project_key: z.string().optional(),
  created: z.string(),
  updated: z.string().optional(),
  completed: z.string().optional(),
  implemented_by: z.string().optional(),
  requires_review: z.boolean().optional(),
  reviewed_by: z.string().nullable().optional(),
  verified: z.boolean().optional(),
  verified_by: z.string().nullable().optional(),
  verified_date: z.string().nullable().optional(),
  verification_policy: z.string().optional(),
  docs_updated: z.boolean().optional(),
  refinement_loop: z.number().optional(),
  refinement_feedback: z.string().optional(),
  parent_id: z.string().optional(),
  assigned_to: z.string().optional(),
  handoff_to: z.string().optional(),
  handoff_notes: z.string().optional(),
  handoff_state: z.enum(['pending', 'accepted', 'rejected']).optional(),
  orchestration_state: z.enum(['queued', 'decomposing', 'ready', 'in_progress', 'completed', 'failed']).optional(),
  refinement_context: z.string().optional(),
  subtasks: z.array(z.string()).optional(),
  blocked_by: z.array(z.string()).optional(),
  blocks: z.array(z.string()).optional(),
  template: z.string().optional(),
  external_refs: z.array(z.string()).optional(),
  last_synced_at: z.string().optional(),
  owner_id: z.string().optional(),
  requirements: z.array(z.string()).optional(),
  acceptance_criteria: z.array(z.string()).optional(),
  test_cases: z.array(z.string()).optional(),
  files_to_modify: z.array(z.string()).optional(),
  artifacts: z.array(z.object({
    name: z.string(),
    url: z.string()
  })).optional(),
  active_integrations: z.array(z.string()).optional(),
  active_mcps: z.array(z.string()).optional(),
  active_skills: z.array(z.string()).optional(),
});

export type Task = z.infer<typeof TaskSchema>;

export const FeatureSchema = z.object({
  id: z.string().regex(/^FEAT-\d{3}$/),
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(['planned', 'in_progress', 'in_development', 'implemented', 'reviewed', 'deployed']),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  tasks: z.array(z.string()).optional(),
  created: z.string().optional(),
  requires_review: z.boolean().optional(),
  reviewed_by: z.string().nullable().optional(),
  tests: z.record(z.string(), z.string()).optional(),
  docs: z.object({
    updated: z.boolean().optional(),
    files: z.array(z.string()).optional()
  }).optional()
});

export type Feature = z.infer<typeof FeatureSchema>;

export const RulesSchema = z.object({
  review_policy: z.string(),
  hallucination_prevention: z.array(z.string()),
  bootstrap_rules: z.array(z.string()).optional()
});

export type Rules = z.infer<typeof RulesSchema>;

export const TasksJsonSchema = z.object({
  $schema: z.string().optional(),
  meta: MetaSchema,
  tasks: z.array(TaskSchema),
  features: z.array(FeatureSchema).optional(),
  rules: z.object({
    review_policy: z.string(),
    hallucination_prevention: z.array(z.string()),
    bootstrap_rules: z.array(z.string()).optional()
  }).optional()
});

export const FullTasksJsonSchema = z.object({
  $schema: z.string().optional(),
  meta: MetaSchema,
  tasks: z.array(TaskSchema),
  features: z.array(FeatureSchema).optional(),
  rules: RulesSchema.optional()
});


export type TasksJson = z.infer<typeof FullTasksJsonSchema>;
