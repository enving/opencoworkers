/**
 * Permission Guard
 * 
 * Middleware/guard for Fastify routes to enforce authorization checks.
 * Integrates with CASL abilities to protect API endpoints.
 * 
 * Features:
 * - Fastify preHandler hook integration
 * - JWT token extraction for actor identification
 * - Permission checking with clear error messages
 * - Audit logging for denied attempts
 * - Support for dynamic subject extraction from requests
 */

import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { AppAbility, subject } from './casl-ability.js';
import { AbilityFactory } from './ability-factory.js';
import { Actor, ActorType, createActor } from '../types/actor.js';
import { ActionType } from './actions.js';
import { SubjectType, SubjectDefinitions } from './subjects.js';

/**
 * Error thrown when permission check fails
 */
export class ForbiddenError extends Error {
  public action: ActionType;
  public subject: string;
  public actorId: string;

  constructor(
    message: string,
    action: ActionType,
    subject: string,
    actorId: string
  ) {
    super(message);
    this.name = 'ForbiddenError';
    this.action = action;
    this.subject = subject;
    this.actorId = actorId;
  }
}

/**
 * Extract actor information from Fastify request
 * Uses JWT token if available
 */
export interface ActorExtractor {
  (request: FastifyRequest): Promise<Actor | null> | Actor | null;
}

/**
 * Extract subject from Fastify request for dynamic permission checks
 */
export interface SubjectExtractor<T extends SubjectType = SubjectType> {
  (request: FastifyRequest): SubjectDefinitions[T] | null;
}

/**
 * Options for PermissionGuard
 */
export interface PermissionGuardOptions {
  /** AbilityFactory instance (creates default if not provided) */
  abilityFactory?: AbilityFactory;
  /** Custom actor extractor */
  actorExtractor?: ActorExtractor;
  /** Enable audit logging (default: true) */
  enableAuditLog?: boolean;
  /** Callback for audit logging */
  onDenied?: (info: {
    actorId: string;
    action: ActionType;
    subject: string;
    request: FastifyRequest;
  }) => void | Promise<void>;
}

/**
 * Permission Guard for Fastify routes
 */
export class PermissionGuard {
  private abilityFactory: AbilityFactory;
  private actorExtractor: ActorExtractor;
  private enableAuditLog: boolean;
  private onDenied?: PermissionGuardOptions['onDenied'];

  constructor(options: PermissionGuardOptions = {}) {
    this.abilityFactory = options.abilityFactory || new AbilityFactory();
    this.actorExtractor = options.actorExtractor || this.defaultActorExtractor;
    this.enableAuditLog = options.enableAuditLog !== false;
    this.onDenied = options.onDenied;
  }

  /**
   * Default actor extractor - extracts from JWT token
   */
  private defaultActorExtractor(request: FastifyRequest): Actor | null {
    try {
      // Check if JWT verification has been done
      const jwtPayload = (request as any).user;
      if (jwtPayload) {
        // Determine actor type from JWT payload
        const type = jwtPayload.type === 'agent' ? ActorType.AGENT : ActorType.USER;
        return createActor(
          jwtPayload.id || jwtPayload.sub || 'anonymous',
          type,
          jwtPayload.role || (type === ActorType.AGENT ? 'junior-agent' : 'user'),
          {
            permissions: jwtPayload.permissions,
            metadata: {
              name: jwtPayload.name || jwtPayload.username,
              email: jwtPayload.email,
            },
          }
        );
      }

      // Fallback: check for API key or session token in headers
      const authHeader = request.headers.authorization;
      if (authHeader) {
        // If there's an auth header but no JWT payload, 
        // we might be in a permissive/testing mode
        return null;
      }

      return null;
    } catch (err) {
      console.error('[PermissionGuard] Failed to extract actor:', err);
      return null;
    }
  }

  /**
   * Check if actor has permission for action on subject
   * Returns true if allowed, false if denied
   */
  async check(
    request: FastifyRequest,
    action: ActionType,
    subject: SubjectType | any
  ): Promise<boolean> {
    const actor = await this.actorExtractor(request);
    
    if (!actor) {
      // No actor found - in permissive mode, this might be allowed
      // In strict mode, this would be denied
      console.warn('[PermissionGuard] No actor found for request, denying access');
      return false;
    }

    const ability = await this.abilityFactory.createFor(actor);
    
    // Check permission
    const hasPermission = ability.can(action, subject);
    
    if (!hasPermission && this.enableAuditLog) {
      await this.logDeniedAttempt(actor.id, action, subject, request);
    }

    return hasPermission;
  }

  /**
   * Check permission and throw ForbiddenError if denied
   */
  async checkOrThrow(
    request: FastifyRequest,
    action: ActionType,
    subject: SubjectType | any
  ): Promise<void> {
    const allowed = await this.check(request, action, subject);
    
    if (!allowed) {
      const actor = await this.actorExtractor(request);
      const actorId = actor?.id || 'anonymous';
      
      throw new ForbiddenError(
        `Access denied: ${action} on ${typeof subject === 'string' ? subject : subject.__caslSubjectType__ || 'subject'}`,
        action,
        typeof subject === 'string' ? subject : JSON.stringify(subject),
        actorId
      );
    }
  }

  /**
   * Create a Fastify preHandler hook for permission checking
   * 
   * Usage:
   *   fastify.post('/api/tasks', {
   *     preHandler: permissionGuard.hook('create', 'Task')
   *   }, handler)
   * 
   * Or with dynamic subject:
   *   fastify.put('/api/tasks/:id', {
   *     preHandler: permissionGuard.hook('update', (req) => ({
   *       __caslSubjectType__: 'Task',
   *       id: req.params.id
   *     }))
   *   }, handler)
   */
  hook(
    action: ActionType,
    subjectOrExtractor: SubjectType | SubjectExtractor
  ): (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => void {
    return async (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => {
      try {
        let subject: any;

        // Determine subject from parameter
        if (typeof subjectOrExtractor === 'string') {
          // Static subject type
          subject = subjectOrExtractor;
        } else {
          // Dynamic subject extractor
          const extracted = subjectOrExtractor(request);
          if (!extracted) {
            return reply.code(400).send({
              error: 'Bad Request',
              message: 'Could not extract subject for permission check',
            });
          }
          subject = extracted;
        }

        // Perform permission check
        await this.checkOrThrow(request, action, subject);
        
        // Permission granted, continue
        done();
      } catch (err) {
        if (err instanceof ForbiddenError) {
          return reply.code(403).send({
            error: 'Forbidden',
            message: err.message,
            action: err.action,
            subject: err.subject,
          });
        }
        
        // Re-throw other errors
        done(err as Error);
      }
    };
  }

  /**
   * Create a Fastify preHandler hook with async subject extraction
   * For when you need to fetch data to build the subject
   */
  hookAsync(
    action: ActionType,
    subjectExtractor: (request: FastifyRequest) => Promise<any> | any
  ): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const subject = await subjectExtractor(request);
        
        if (!subject) {
          return reply.code(400).send({
            error: 'Bad Request',
            message: 'Could not extract subject for permission check',
          });
        }

        await this.checkOrThrow(request, action, subject);
      } catch (err) {
        if (err instanceof ForbiddenError) {
          return reply.code(403).send({
            error: 'Forbidden',
            message: err.message,
            action: err.action,
            subject: err.subject,
          });
        }
        throw err;
      }
    };
  }

  /**
   * Middleware that allows permissive access (for development/testing)
   * Logs warnings but doesn't block requests
   */
  permissiveHook(
    action: ActionType,
    subjectOrExtractor: SubjectType | SubjectExtractor
  ): (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => void {
    return async (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => {
      try {
        let subject: any;

        if (typeof subjectOrExtractor === 'string') {
          subject = subjectOrExtractor;
        } else {
          const extracted = subjectOrExtractor(request);
          if (!extracted) {
            console.warn('[PermissionGuard] Could not extract subject for permissive check');
            return done();
          }
          subject = extracted;
        }

        const allowed = await this.check(request, action, subject);
        
        if (!allowed) {
          const actor = await this.actorExtractor(request);
          console.warn(
            `[PermissionGuard] PERMISSIVE MODE: Would deny ${action} on ${typeof subject === 'string' ? subject : 'subject'} for actor ${actor?.id || 'anonymous'}`
          );
        }

        done();
      } catch (err) {
        // In permissive mode, log errors but don't block
        console.error('[PermissionGuard] Error in permissive check:', err);
        done();
      }
    };
  }

  /**
   * Create a decorator function for route handlers
   * Usage inside route handler:
   *   const ability = await permissionGuard.getAbility(request);
   *   if (ability.can('update', subject('Task', task))) { ... }
   */
  async getAbility(request: FastifyRequest): Promise<AppAbility | null> {
    const actor = await this.actorExtractor(request);
    if (!actor) {
      return null;
    }
    return this.abilityFactory.createFor(actor);
  }

  /**
   * Log denied attempts for audit trail
   */
  private async logDeniedAttempt(
    actorId: string,
    action: ActionType,
    subject: any,
    request: FastifyRequest
  ): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      actorId,
      action,
      subject: typeof subject === 'string' ? subject : JSON.stringify(subject),
      path: request.url,
      method: request.method,
      ip: request.ip,
    };

    console.warn('[PermissionGuard] Access denied:', logEntry);

    // Call custom callback if provided
    if (this.onDenied) {
      try {
        await this.onDenied({
          actorId,
          action,
          subject: logEntry.subject,
          request,
        });
      } catch (err) {
        console.error('[PermissionGuard] Error in denied callback:', err);
      }
    }
  }
}

/**
 * Factory function to create a PermissionGuard with defaults
 */
export function createPermissionGuard(options?: PermissionGuardOptions): PermissionGuard {
  return new PermissionGuard(options);
}

/**
 * Re-export types and utilities for convenience
 */
export { subject };
