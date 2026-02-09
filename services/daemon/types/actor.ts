/**
 * Actor Types
 * 
 * Unified actor type for both users and agents.
 * Enables consistent permission checking across the system.
 */

export const ActorType = {
  USER: 'user',
  AGENT: 'agent',
} as const;

export type ActorType = typeof ActorType[keyof typeof ActorType];

/**
 * Actor represents any entity that can perform actions.
 * Used by the permission system to determine what an entity can/cannot do.
 */
export interface Actor {
  /** Unique identifier for the actor */
  id: string;
  
  /** Type of actor - user or agent */
  type: ActorType;
  
  /** Role for RBAC (e.g., 'admin', 'user', 'junior-agent', 'senior-agent') */
  role: string;
  
  /** Optional explicit permissions that override or extend role-based permissions */
  permissions?: string[];
  
  /** Optional metadata for additional context */
  metadata?: {
    name?: string;
    email?: string;
    sessionId?: string;
    [key: string]: any;
  };
}

/**
 * Check if an object is a valid Actor
 */
export function isActor(obj: any): obj is Actor {
  return (
    obj &&
    typeof obj.id === 'string' &&
    (obj.type === ActorType.USER || obj.type === ActorType.AGENT) &&
    typeof obj.role === 'string'
  );
}

/**
 * Create an actor from a JWT payload or user data
 */
export function createActor(
  id: string,
  type: ActorType,
  role: string,
  options?: {
    permissions?: string[];
    metadata?: Actor['metadata'];
  }
): Actor {
  return {
    id,
    type,
    role,
    permissions: options?.permissions,
    metadata: options?.metadata,
  };
}

/**
 * Predefined actor roles
 */
export const ActorRoles = {
  // User roles
  ADMIN: 'admin',
  USER: 'user',
  GUEST: 'guest',
  
  // Agent roles
  JUNIOR_AGENT: 'junior-agent',
  SENIOR_AGENT: 'senior-agent',
  AUDITOR_AGENT: 'auditor-agent',
  ADMIN_AGENT: 'admin-agent',
} as const;
