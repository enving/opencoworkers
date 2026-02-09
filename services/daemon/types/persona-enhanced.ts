/**
 * Enhanced Persona types for dynamic assembly
 * 
 * These types support runtime generation of specialized personas
 * based on task requirements and available skills.
 */

import { Persona } from './persona.js';

/**
 * Extended Persona type with runtime-specific fields
 */
export interface RuntimePersona extends Persona {
  /** Unique runtime identifier */
  id: string;
  
  /** Reference to base template */
  basePersona: string;
  
  /** Skills matched to this persona */
  matchedSkills: string[];
  
  /** Requirements extracted from task */
  requirements: string[];
  
  /** Match quality score (0-1) */
  confidence: number;
  
  /** When persona was created */
  createdAt: Date;
  
  /** When persona expires (TTL) */
  expiresAt: Date;
}

/**
 * Individual capability with proficiency level
 */
export interface PersonaCapability {
  /** Skill name */
  skill: string;
  
  /** Proficiency level */
  proficiency: 'novice' | 'intermediate' | 'expert';
  
  /** When to use this skill */
  context: string;
}

/**
 * Personality traits for persona behavior
 */
export interface PersonaPersonality {
  /** Thoroughness level (0-1) */
  thoroughness: number;
  
  /** Creativity level (0-1) */
  creativity: number;
  
  /** Caution level (0-1) */
  caution: number;
}

/**
 * Base persona template
 */
export interface PersonaTemplate {
  /** Unique template identifier */
  id: string;
  
  /** Display name */
  name: string;
  
  /** Role identifier */
  role: string;
  
  /** Base system prompt */
  basePrompt: string;
  
  /** Default capabilities */
  defaultCapabilities: string[];
  
  /** Compatible skill categories */
  compatibleSkills: string[];
  
  /** Personality traits */
  personality: PersonaPersonality;
}

/**
 * Ticket analysis results
 */
export interface TicketAnalysis {
  /** Extracted requirements */
  requirements: string[];
  
  /** Task complexity */
  complexity: 'simple' | 'medium' | 'complex';
  
  /** Detected domains */
  domain: string[];
  
  /** Suggested skills */
  suggestedSkills: string[];
}

/**
 * Skill match result with score
 */
export interface MatchResult {
  /** Skill name */
  skill: string;
  
  /** Match score (0-1) */
  score: number;
  
  /** Why this skill was matched */
  reason: string;
}

/**
 * Configuration for persona assembly
 */
export interface AssemblyConfig {
  /** Default TTL in hours */
  defaultTtlHours: number;
  
  /** Minimum confidence threshold */
  minConfidence: number;
  
  /** Max personas to cache */
  maxCacheSize: number;
}

/**
 * Result of persona assembly
 */
export interface AssemblyResult {
  /** Success status */
  success: boolean;
  
  /** Created persona (if successful) */
  persona?: RuntimePersona;
  
  /** Errors (if failed) */
  errors?: string[];
  
  /** Match details */
  matches: MatchResult[];
  
  /** Selected template */
  template: string;
}
