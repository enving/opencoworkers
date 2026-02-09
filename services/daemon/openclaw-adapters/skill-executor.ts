/**
 * Skill Executor for OpenClaw skills
 * 
 * Securely executes OpenClaw skills in the runtime container,
 * managing the full execution lifecycle with timeout and cancellation support.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  SkillExecutionContext,
  SkillExecutionResult,
  ExecutionStatus,
  ExecutionOptions,
  ExecutionProgress,
  Actor
} from '../types/skill-execution.js';
import { OpenClawSkill } from './skill-registry.js';
import { AuditLogger } from '../orchestration/audit-trail.js';
import { OpenCodeServerBridge } from '../server/bridge.js';

/**
 * Active execution session
 */
interface ExecutionSession {
  sessionId: string;
  skill: OpenClawSkill;
  status: ExecutionStatus;
  startTime: Date;
  timeout?: NodeJS.Timeout;
  logs: string[];
  result?: SkillExecutionResult;
}

/**
 * Executes OpenClaw skills securely in the runtime container
 */
export class SkillExecutor extends EventEmitter {
  private activeSessions: Map<string, ExecutionSession> = new Map();
  private auditLogger: AuditLogger;
  private bridge: OpenCodeServerBridge;
  private defaultTimeout: number = 5 * 60 * 1000; // 5 minutes

  constructor(bridge: OpenCodeServerBridge, auditLogger?: AuditLogger) {
    super();
    this.bridge = bridge;
    this.auditLogger = auditLogger || new AuditLogger();
  }

  /**
   * Execute a skill with the given context
   */
  async execute(
    context: SkillExecutionContext,
    options: ExecutionOptions = {}
  ): Promise<SkillExecutionResult> {
    const sessionId = context.sessionId || uuidv4();
    const timeout = options.timeout || this.defaultTimeout;

    console.log(`[SkillExecutor] Starting execution of skill '${context.skill.name}' (session: ${sessionId})`);

    // Create execution session
    const session: ExecutionSession = {
      sessionId,
      skill: context.skill,
      status: 'running',
      startTime: new Date(),
      logs: []
    };

    this.activeSessions.set(sessionId, session);

    // Log start to audit trail
    await this.auditLogger.logAction({
      agentId: context.actor.id,
      taskId: context.taskId,
      action: 'skill_execution_start',
      details: {
        skillName: context.skill.name,
        sessionId,
        actor: context.actor
      },
      result: 'pending'
    });

    try {
      // Set up timeout
      session.timeout = setTimeout(() => {
        this.handleTimeout(sessionId);
      }, timeout);

      // Emit progress update
      this.emitProgress(sessionId, {
        status: 'running',
        percent: 10,
        step: 'Preparing execution environment',
        timestamp: new Date()
      });

      // Prepare execution environment
      const executionEnv = await this.prepareEnvironment(context);

      // Emit progress
      this.emitProgress(sessionId, {
        status: 'running',
        percent: 30,
        step: 'Invoking skill in runtime container',
        timestamp: new Date()
      });

      // Execute via bridge
      const result = await this.executeViaBridge(context, executionEnv, session);

      // Clear timeout
      if (session.timeout) {
        clearTimeout(session.timeout);
        session.timeout = undefined;
      }

      // Update session status
      session.status = result.success ? 'completed' : 'failed';
      session.result = result;

      // Log completion
      await this.auditLogger.logAction({
        agentId: context.actor.id,
        taskId: context.taskId,
        action: 'skill_execution_complete',
        details: {
          skillName: context.skill.name,
          sessionId,
          success: result.success,
          executionTime: result.executionTime
        },
        result: result.success ? 'success' : 'failure'
      });

      // Emit completion event
      this.emit(result.success ? 'skill:executed' : 'skill:failed', {
        sessionId,
        skill: context.skill.name,
        result
      });

      this.activeSessions.delete(sessionId);

      return result;

    } catch (err: any) {
      // Clear timeout
      if (session.timeout) {
        clearTimeout(session.timeout);
        session.timeout = undefined;
      }

      // Update session status
      session.status = 'failed';

      const errorResult: SkillExecutionResult = {
        success: false,
        outputs: {},
        artifacts: [],
        logs: session.logs,
        executionTime: Date.now() - session.startTime.getTime(),
        error: {
          message: err.message || 'Unknown error during execution',
          stack: err.stack,
          code: err.code || 'EXECUTION_ERROR'
        }
      };

      session.result = errorResult;

      // Log failure
      await this.auditLogger.logAction({
        agentId: context.actor.id,
        taskId: context.taskId,
        action: 'skill_execution_failed',
        details: {
          skillName: context.skill.name,
          sessionId,
          error: err.message
        },
        result: 'failure'
      });

      // Emit failure event
      this.emit('skill:failed', {
        sessionId,
        skill: context.skill.name,
        error: err
      });

      this.activeSessions.delete(sessionId);

      return errorResult;
    }
  }

  /**
   * Cancel a running skill execution
   */
  async cancel(sessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      console.warn(`[SkillExecutor] Cannot cancel: session ${sessionId} not found`);
      return false;
    }

    if (session.status !== 'running') {
      console.warn(`[SkillExecutor] Cannot cancel: session ${sessionId} is ${session.status}`);
      return false;
    }

    console.log(`[SkillExecutor] Cancelling session ${sessionId}`);

    // Clear timeout
    if (session.timeout) {
      clearTimeout(session.timeout);
      session.timeout = undefined;
    }

    // Update status
    session.status = 'cancelled';

    // Log cancellation
    await this.auditLogger.logAction({
      agentId: 'system',
      taskId: undefined,
      action: 'skill_execution_cancelled',
      details: {
        skillName: session.skill.name,
        sessionId
      },
      result: 'failure'
    });

    this.activeSessions.delete(sessionId);

    this.emit('skill:cancelled', {
      sessionId,
      skill: session.skill.name
    });

    return true;
  }

  /**
   * Get the current status of an execution
   */
  getStatus(sessionId: string): ExecutionStatus {
    const session = this.activeSessions.get(sessionId);
    return session?.status || 'completed';
  }

  /**
   * Get session logs
   */
  getLogs(sessionId: string): string[] {
    const session = this.activeSessions.get(sessionId);
    return session?.logs || [];
  }

  /**
   * Get execution result
   */
  getResult(sessionId: string): SkillExecutionResult | undefined {
    const session = this.activeSessions.get(sessionId);
    return session?.result;
  }

  /**
   * List all active sessions
   */
  getActiveSessions(): Array<{ sessionId: string; skill: string; status: ExecutionStatus }> {
    return Array.from(this.activeSessions.entries()).map(([id, session]) => ({
      sessionId: id,
      skill: session.skill.name,
      status: session.status
    }));
  }

  /**
   * Prepare the execution environment
   */
  private async prepareEnvironment(
    context: SkillExecutionContext
  ): Promise<Record<string, string>> {
    const env: Record<string, string> = {
      ...context.environment,
      SKILL_NAME: context.skill.name,
      SKILL_PATH: context.skill.path,
      SESSION_ID: context.sessionId,
      WORKING_DIR: context.workingDirectory
    };

    if (context.taskId) {
      env.TASK_ID = context.taskId;
    }

    return env;
  }

  /**
   * Execute the skill via the OpenCode server bridge
   */
  private async executeViaBridge(
    context: SkillExecutionContext,
    env: Record<string, string>,
    session: ExecutionSession
  ): Promise<SkillExecutionResult> {
    const startTime = Date.now();

    try {
      // Use the bridge to execute the skill
      // This integrates with the existing ServerBridge infrastructure
      
      // For now, we'll simulate the execution flow
      // In the real implementation, this would call bridge.executeSkill()
      
      // Simulate execution steps
      await this.simulateExecutionStep(session, 'Loading skill context', 40);
      await this.simulateExecutionStep(session, 'Executing skill logic', 60);
      await this.simulateExecutionStep(session, 'Collecting artifacts', 80);
      await this.simulateExecutionStep(session, 'Finalizing', 100);

      const executionTime = Date.now() - startTime;

      // Build result
      const result: SkillExecutionResult = {
        success: true,
        outputs: {}, // Would be populated from skill execution
        artifacts: [], // Would be collected from working directory
        logs: session.logs,
        executionTime
      };

      return result;

    } catch (err: any) {
      throw err;
    }
  }

  /**
   * Simulate an execution step (for development/testing)
   */
  private async simulateExecutionStep(
    session: ExecutionSession,
    step: string,
    percent: number
  ): Promise<void> {
    session.logs.push(`[${new Date().toISOString()}] ${step}`);
    
    this.emitProgress(session.sessionId, {
      status: 'running',
      percent,
      step,
      timestamp: new Date()
    });

    // Small delay to simulate work
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Handle execution timeout
   */
  private async handleTimeout(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== 'running') return;

    console.error(`[SkillExecutor] Session ${sessionId} timed out`);

    session.status = 'failed';
    session.logs.push(`[${new Date().toISOString()}] Execution timed out`);

    const result: SkillExecutionResult = {
      success: false,
      outputs: {},
      artifacts: [],
      logs: session.logs,
      executionTime: Date.now() - session.startTime.getTime(),
      error: {
        message: 'Skill execution timed out',
        code: 'TIMEOUT'
      }
    };

    session.result = result;

    // Log timeout
    await this.auditLogger.logAction({
      agentId: 'system',
      taskId: undefined,
      action: 'skill_execution_timeout',
      details: {
        skillName: session.skill.name,
        sessionId
      },
      result: 'failure'
    });

    this.emit('skill:failed', {
      sessionId,
      skill: session.skill.name,
      error: new Error('Execution timed out')
    });

    this.activeSessions.delete(sessionId);
  }

  /**
   * Emit progress update
   */
  private emitProgress(sessionId: string, progress: ExecutionProgress): void {
    this.emit('progress', { sessionId, ...progress });
  }
}
