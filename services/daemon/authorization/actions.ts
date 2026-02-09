/**
 * Authorization Actions
 * 
 * Defines all possible actions that can be performed on subjects.
 * Used with CASL to define permissions like "can('read', 'Task')".
 */

export const ActionType = {
  // CRUD operations
  READ: 'read',
  WRITE: 'write',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  
  // Execution actions
  EXECUTE: 'execute',
  
  // Administrative actions
  MANAGE: 'manage',
  
  // HITL workflow actions
  APPROVE: 'approve',
  REJECT: 'reject',
} as const;

export type ActionType = typeof ActionType[keyof typeof ActionType];

/**
 * All available actions as an array for iteration/validation
 */
export const actions: ActionType[] = [
  ActionType.READ,
  ActionType.WRITE,
  ActionType.CREATE,
  ActionType.UPDATE,
  ActionType.DELETE,
  ActionType.EXECUTE,
  ActionType.MANAGE,
  ActionType.APPROVE,
  ActionType.REJECT,
];

/**
 * Check if a string is a valid action type
 */
export function isValidAction(action: string): action is ActionType {
  return actions.includes(action as ActionType);
}
