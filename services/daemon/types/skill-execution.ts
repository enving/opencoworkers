/**
 * Types for OpenClaw skill execution context and results
 * 
 * These types define the complete lifecycle of skill execution including
 * context preparation, execution monitoring, and result collection.
 */

import { OpenClawSkill } from '../openclaw-adapters/skill-registry.js';

/**
 * Represents an actor (user or system) triggering skill execution
 */
export interface Actor {
  id: string;
  type: 'user' | 'agent' | 'system';
  name?: string;
  permissions?: string[];
}

/**
 * Context provided to skill execution
 */
export interface SkillExecutionContext {
  /** The skill being executed */
  skill: OpenClawSkill;
  
  /** Input parameters for the skill */
  inputs: Record<string, any>;
  
  /** Optional link to parent task */
  taskId?: string;
  
  /** Unique execution session identifier */
  sessionId: string;
  
  /** Who triggered the execution */
  actor: Actor;
  
  /** Sandbox path for skill execution */
  workingDirectory: string;
  
  /** Environment variables for the skill */
  environment: Record<string, string>;
}

/**
 * Result of skill execution
 */
export interface SkillExecutionResult {
  /** Whether execution was successful */
  success: boolean;
  
  /** Output values produced by the skill */
  outputs: Record<string, any>;
  
  /** Paths to generated artifacts */
  artifacts: string[];
  
  /** stdout/stderr logs from execution */
  logs: string[];
  
  /** Execution time in milliseconds */
  executionTime: number;
  
  /** Error details if execution failed */
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

/**
 * Extended OpenClaw skill with version and validation info
 */
export interface OpenClawSkillExtended extends OpenClawSkill {
  /** Semantic version of the skill */
  version: string;
  
  /** Git repository URL */
  repository: string;
  
  /** Pinned commit hash */
  commit: string;
  
  /** Whether skill passed validation */
  validated: boolean;
  
  /** When skill was last validated */
  lastValidated: Date;
}

/**
 * Result of a single validation check
 */
export interface SkillValidationResult {
  /** Whether validation passed */
  valid: boolean;
  
  /** Error messages if validation failed */
  errors: string[];
  
  /** Warning messages (non-blocking) */
  warnings: string[];
}

/**
 * Error during skill loading
 */
export interface SkillLoadError {
  /** Error code for categorization */
  code: string;
  
  /** Human-readable error message */
  message: string;
  
  /** Skill that failed to load */
  skillName: string;
  
  /** Path to skill directory */
  skillPath: string;
  
  /** Original error for debugging */
  cause?: Error;
}

/**
 * Execution status states
 */
export type ExecutionStatus = 
  | 'pending' 
  | 'running' 
  | 'completed' 
  | 'failed' 
  | 'cancelled';

/**
 * Comprehensive validation report for a skill
 */
export interface ValidationReport {
  /** Skill identifier */
  skillName: string;
  
  /** Structure validation result */
  structure: SkillValidationResult;
  
  /** Security validation result */
  security: SkillValidationResult;
  
  /** Dependencies validation result */
  dependencies: SkillValidationResult;
  
  /** Overall valid status */
  isValid: boolean;
  
  /** Timestamp of validation */
  validatedAt: Date;
  
  /** Commit hash that was validated */
  commitHash?: string;
}

/**
 * Options for skill execution
 */
export interface ExecutionOptions {
  /** Timeout in milliseconds (default: 5 minutes) */
  timeout?: number;
  
  /** Maximum memory in MB */
  maxMemoryMB?: number;
  
  /** CPU limit (percentage) */
  cpuLimit?: number;
  
  /** Whether to stream logs via SSE */
  streamLogs?: boolean;
  
  /** Callback for progress updates */
  onProgress?: (progress: ExecutionProgress) => void;
}

/**
 * Execution progress update
 */
export interface ExecutionProgress {
  /** Current status */
  status: ExecutionStatus;
  
  /** Progress percentage (0-100) */
  percent: number;
  
  /** Current step description */
  step: string;
  
  /** Timestamp of update */
  timestamp: Date;
}

/**
 * Information about a managed git submodule
 */
export interface SubmoduleInfo {
  /** Skill name/identifier */
  name: string;
  
  /** Git repository URL */
  repository: string;
  
  /** Current commit hash */
  commit: string;
  
  /** Whether submodule is initialized */
  initialized: boolean;
  
  /** Last sync timestamp */
  lastSynced?: Date;
  
  /** Any error during last operation */
  error?: string;
}
