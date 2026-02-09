/**
 * Authorization Subjects
 * 
 * Defines all subject types that can be acted upon.
 * Each subject type has associated fields for conditional permissions.
 */

// Subject type definitions with their field types
export interface FileSubject {
  id: string;
  path: string;
  owner: string;
  isSensitive: boolean;
  size?: number;
  modifiedAt?: string;
}

export interface TaskSubject {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'review' | 'done';
  assignee?: string;
  owner: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  category?: string;
}

export interface AgentSubject {
  id: string;
  name: string;
  role: string;
  permissions: string[];
  status: 'active' | 'idle' | 'busy' | 'offline';
  riskLevel?: 'low' | 'medium' | 'high';
}

export interface UserSubject {
  id: string;
  username: string;
  role: string;
  email?: string;
  isActive: boolean;
}

export interface SkillSubject {
  name: string;
  description?: string;
  riskLevel: 'low' | 'medium' | 'high';
  category?: string;
  requiresApproval?: boolean;
}

export interface ConfigSubject {
  id: string;
  type: 'opencode' | 'omo' | 'integration' | 'skill';
  name: string;
  owner: string;
  isGlobal: boolean;
}

export interface SessionSubject {
  id: string;
  owner: string;
  agentId?: string;
  taskId?: string;
  status: 'active' | 'paused' | 'completed' | 'error';
  startedAt: string;
}

/**
 * Subject type names for CASL
 */
export const SubjectType = {
  FILE: 'File',
  TASK: 'Task',
  AGENT: 'Agent',
  USER: 'User',
  SKILL: 'Skill',
  CONFIG: 'Config',
  SESSION: 'Session',
  ALL: 'all',
} as const;

export type SubjectType = typeof SubjectType[keyof typeof SubjectType];

/**
 * All available subject types as an array
 */
export const subjects: SubjectType[] = [
  SubjectType.FILE,
  SubjectType.TASK,
  SubjectType.AGENT,
  SubjectType.USER,
  SubjectType.SKILL,
  SubjectType.CONFIG,
  SubjectType.SESSION,
];

/**
 * Type mapping for subject definitions
 */
export type SubjectDefinitions = {
  [SubjectType.FILE]: FileSubject;
  [SubjectType.TASK]: TaskSubject;
  [SubjectType.AGENT]: AgentSubject;
  [SubjectType.USER]: UserSubject;
  [SubjectType.SKILL]: SkillSubject;
  [SubjectType.CONFIG]: ConfigSubject;
  [SubjectType.SESSION]: SessionSubject;
  [SubjectType.ALL]: any;
};
