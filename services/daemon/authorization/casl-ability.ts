/**
 * CASL Ability Builder
 * 
 * Core CASL ability definitions and the defineAbilityFor function.
 * Creates abilities based on actor roles with specific rules for:
 * - admin: full access (manage all)
 * - user: read most, write own
 * - junior-agent: read all, limited execute
 * - senior-agent: read/write/execute all
 * - auditor-agent: read-only all
 */

import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';
import type { MongoQuery } from '@casl/ability';
import { ActionType } from './actions.js';
import { SubjectType, SubjectDefinitions } from './subjects.js';
import { Actor, ActorRoles } from '../types/actor.js';

/**
 * Conditions that can be applied to abilities using MongoDB-style queries
 */
export type AbilityConditions = MongoQuery<{
  isSensitive?: boolean;
  riskLevel?: 'low' | 'medium' | 'high';
  owner?: string;
  path?: string;
  type?: string;
  isGlobal?: boolean;
  requiresApproval?: boolean;
}>;

/**
 * Define the abilities tuple type for CASL
 * Format: [Action, SubjectType]
 */
type AppAbilities = [
  ActionType,
  SubjectType | { __caslSubjectType__?: SubjectType }
];

/**
 * The main AppAbility type using MongoAbility with conditions support
 */
export type AppAbility = MongoAbility<AppAbilities, AbilityConditions>;

/**
 * Detect subject type from an object
 * Used by CASL to determine what type of subject an object is
 */
export function detectSubjectType(object: any): any {
  if (!object || typeof object !== 'object') {
    return 'all';
  }

  // Check for explicit CASL subject type
  if (object.__caslSubjectType__ && typeof object.__caslSubjectType__ === 'string') {
    return object.__caslSubjectType__;
  }

  // Check for our custom subject type marker
  if (object.__subjectType && typeof object.__subjectType === 'string') {
    return object.__subjectType__;
  }

  // Infer from object structure
  if ('riskLevel' in object && 'requiresApproval' in object) {
    return SubjectType.SKILL;
  }
  if ('status' in object && 'assignee' in object && 'priority' in object) {
    return SubjectType.TASK;
  }
  if ('path' in object && 'isSensitive' in object) {
    return SubjectType.FILE;
  }
  if ('role' in object && 'permissions' in object && 'status' in object) {
    return SubjectType.AGENT;
  }
  if ('username' in object && 'isActive' in object) {
    return SubjectType.USER;
  }
  if ('type' in object && 'isGlobal' in object && 'owner' in object) {
    return SubjectType.CONFIG;
  }
  if ('sessionId' in object && 'startedAt' in object) {
    return SubjectType.SESSION;
  }

  return 'all';
}

/**
 * Create a subject wrapper for CASL
 * Wraps raw objects with their subject type for CASL to recognize
 */
export function subject<T extends SubjectType>(
  type: T,
  object: Omit<SubjectDefinitions[T], '__caslSubjectType__' | '__subjectType__'>
): SubjectDefinitions[T] & { __caslSubjectType__: T; __subjectType__: T } {
  return {
    ...object,
    __caslSubjectType__: type,
    __subjectType__: type,
  } as any;
}

/**
 * Define abilities for a given actor based on their role
 * This is the main function for creating role-based permissions
 */
export function defineAbilityFor(actor: Actor): AppAbility {
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility);
  const { can, cannot } = builder;

  // Apply role-based rules
  switch (actor.role) {
    case ActorRoles.ADMIN:
    case ActorRoles.ADMIN_AGENT:
      defineAdminRules(can, cannot);
      break;
    
    case ActorRoles.USER:
      defineUserRules(can, cannot, actor);
      break;
    
    case ActorRoles.JUNIOR_AGENT:
      defineJuniorAgentRules(can, cannot, actor);
      break;
    
    case ActorRoles.SENIOR_AGENT:
      defineSeniorAgentRules(can, cannot);
      break;
    
    case ActorRoles.AUDITOR_AGENT:
      defineAuditorAgentRules(can, cannot);
      break;
    
    default:
      // Default to minimal permissions
      defineGuestRules(can, cannot);
  }

  // Build and return the ability
  return builder.build({
    detectSubjectType,
  });
}

/**
 * Admin rules - full access to everything
 */
function defineAdminRules(
  can: AbilityBuilder<AppAbility>['can'],
  cannot: AbilityBuilder<AppAbility>['cannot']
): void {
  // Admin can manage all subjects
  can(ActionType.MANAGE, SubjectType.ALL);
  
  // Explicit grants for each subject type (redundant but explicit)
  can(ActionType.CREATE, SubjectType.FILE);
  can(ActionType.READ, SubjectType.FILE);
  can(ActionType.UPDATE, SubjectType.FILE);
  can(ActionType.DELETE, SubjectType.FILE);
  can(ActionType.WRITE, SubjectType.FILE);
  can(ActionType.EXECUTE, SubjectType.FILE);
  
  can(ActionType.CREATE, SubjectType.TASK);
  can(ActionType.READ, SubjectType.TASK);
  can(ActionType.UPDATE, SubjectType.TASK);
  can(ActionType.DELETE, SubjectType.TASK);
  can(ActionType.APPROVE, SubjectType.TASK);
  can(ActionType.REJECT, SubjectType.TASK);
  
  can(ActionType.CREATE, SubjectType.AGENT);
  can(ActionType.READ, SubjectType.AGENT);
  can(ActionType.UPDATE, SubjectType.AGENT);
  can(ActionType.DELETE, SubjectType.AGENT);
  
  can(ActionType.CREATE, SubjectType.USER);
  can(ActionType.READ, SubjectType.USER);
  can(ActionType.UPDATE, SubjectType.USER);
  can(ActionType.DELETE, SubjectType.USER);
  
  can(ActionType.CREATE, SubjectType.SKILL);
  can(ActionType.READ, SubjectType.SKILL);
  can(ActionType.UPDATE, SubjectType.SKILL);
  can(ActionType.DELETE, SubjectType.SKILL);
  can(ActionType.EXECUTE, SubjectType.SKILL);
  
  can(ActionType.CREATE, SubjectType.CONFIG);
  can(ActionType.READ, SubjectType.CONFIG);
  can(ActionType.UPDATE, SubjectType.CONFIG);
  can(ActionType.DELETE, SubjectType.CONFIG);
  
  can(ActionType.CREATE, SubjectType.SESSION);
  can(ActionType.READ, SubjectType.SESSION);
  can(ActionType.UPDATE, SubjectType.SESSION);
  can(ActionType.DELETE, SubjectType.SESSION);
}

/**
 * User rules - read most, write own
 */
function defineUserRules(
  can: AbilityBuilder<AppAbility>['can'],
  cannot: AbilityBuilder<AppAbility>['cannot'],
  actor: Actor
): void {
  // Can read most things
  can(ActionType.READ, SubjectType.TASK);
  can(ActionType.READ, SubjectType.AGENT);
  can(ActionType.READ, SubjectType.SKILL);
  can(ActionType.READ, SubjectType.SESSION);
  
  // Can read files
  can(ActionType.READ, SubjectType.FILE);
  
  // Can read configs (but not sensitive ones)
  can(ActionType.READ, SubjectType.CONFIG, { isGlobal: true });
  
  // Can create and update own tasks
  can(ActionType.CREATE, SubjectType.TASK);
  can(ActionType.UPDATE, SubjectType.TASK, { owner: actor.id });
  
  // Cannot execute skills (only agents do that)
  cannot(ActionType.EXECUTE, SubjectType.SKILL);
  
  // Cannot delete system files
  cannot(ActionType.DELETE, SubjectType.FILE, { isSensitive: true });
  
  // Cannot manage other users
  cannot(ActionType.MANAGE, SubjectType.USER);
}

/**
 * Junior agent rules - read all, limited execute
 * Critical safety rules: cannot execute dangerous commands
 */
function defineJuniorAgentRules(
  can: AbilityBuilder<AppAbility>['can'],
  cannot: AbilityBuilder<AppAbility>['cannot'],
  actor: Actor
): void {
  // Can read all subjects
  can(ActionType.READ, SubjectType.TASK);
  can(ActionType.READ, SubjectType.FILE);
  can(ActionType.READ, SubjectType.AGENT);
  can(ActionType.READ, SubjectType.SKILL);
  can(ActionType.READ, SubjectType.CONFIG, { isGlobal: true });
  can(ActionType.READ, SubjectType.SESSION);
  can(ActionType.READ, SubjectType.USER);
  
  // Can execute low-risk skills only
  can(ActionType.EXECUTE, SubjectType.SKILL, { riskLevel: 'low' });
  
  // Cannot execute medium or high risk skills
  cannot(ActionType.EXECUTE, SubjectType.SKILL, { riskLevel: 'medium' });
  cannot(ActionType.EXECUTE, SubjectType.SKILL, { riskLevel: 'high' });
  
  // Cannot execute files (bash scripts, etc.)
  cannot(ActionType.EXECUTE, SubjectType.FILE);
  
  // Cannot execute on sensitive files
  cannot(ActionType.EXECUTE, SubjectType.FILE, { isSensitive: true });
  
  // Cannot delete anything
  cannot(ActionType.DELETE, SubjectType.FILE);
  cannot(ActionType.DELETE, SubjectType.TASK);
  cannot(ActionType.DELETE, SubjectType.SKILL);
  cannot(ActionType.DELETE, SubjectType.CONFIG);
  
  // Cannot write to system paths
  cannot(ActionType.WRITE, SubjectType.FILE, { isSensitive: true });
  
  // Cannot manage agents or users
  cannot(ActionType.MANAGE, SubjectType.AGENT);
  cannot(ActionType.MANAGE, SubjectType.USER);
}

/**
 * Senior agent rules - read/write/execute all
 */
function defineSeniorAgentRules(
  can: AbilityBuilder<AppAbility>['can'],
  cannot: AbilityBuilder<AppAbility>['cannot']
): void {
  // Can do almost everything
  can(ActionType.READ, SubjectType.ALL);
  can(ActionType.WRITE, SubjectType.ALL);
  can(ActionType.CREATE, SubjectType.ALL);
  can(ActionType.UPDATE, SubjectType.ALL);
  can(ActionType.EXECUTE, SubjectType.ALL);
  
  // Cannot delete critical system files
  cannot(ActionType.DELETE, SubjectType.CONFIG, { type: 'opencode' });
  cannot(ActionType.DELETE, SubjectType.FILE, { isSensitive: true });
}

/**
 * Auditor agent rules - read-only all
 */
function defineAuditorAgentRules(
  can: AbilityBuilder<AppAbility>['can'],
  cannot: AbilityBuilder<AppAbility>['cannot']
): void {
  // Can read everything
  can(ActionType.READ, SubjectType.ALL);
  
  // Cannot modify anything
  cannot(ActionType.WRITE, SubjectType.ALL);
  cannot(ActionType.CREATE, SubjectType.ALL);
  cannot(ActionType.UPDATE, SubjectType.ALL);
  cannot(ActionType.DELETE, SubjectType.ALL);
  cannot(ActionType.EXECUTE, SubjectType.ALL);
  cannot(ActionType.MANAGE, SubjectType.ALL);
}

/**
 * Guest rules - minimal access
 */
function defineGuestRules(
  can: AbilityBuilder<AppAbility>['can'],
  cannot: AbilityBuilder<AppAbility>['cannot']
): void {
  // Can only read public information
  can(ActionType.READ, SubjectType.SKILL, { requiresApproval: false });
  
  // Cannot do anything else
  cannot(ActionType.WRITE, SubjectType.ALL);
  cannot(ActionType.CREATE, SubjectType.ALL);
  cannot(ActionType.UPDATE, SubjectType.ALL);
  cannot(ActionType.DELETE, SubjectType.ALL);
  cannot(ActionType.EXECUTE, SubjectType.ALL);
  cannot(ActionType.MANAGE, SubjectType.ALL);
}
