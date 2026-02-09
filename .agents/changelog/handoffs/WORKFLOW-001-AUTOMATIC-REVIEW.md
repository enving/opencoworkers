# Automatic Review Workflow Handoff

## 🎯 Purpose
This workflow enables fully autonomous task completion, review, and finalization for tickets marked for `automatic-review`.

**Inspired by**: Auto-Claude (GitHub Issues automation), Claude Code GitHub App (@claude mentions)

## 🔄 Trigger Conditions
1. **Ticket Label/Keyword**: `automatic-review` (AND `opencode-sync`)
2. **Ticket Status**: "In Progress" (Jira/Plane swimlane)

## 🤖 Agent Instructions

When you detect a task meeting the trigger conditions:

### 1. Implementation Phase
- **Action**: Implement the requested feature or fix.
- **Constraint**: Follow the Linear Development Policy (see `POLICY-001-LINEAR-DEV.md`).
- **Status**: Keep status as `in_progress`.

### 2. Automatic Review Phase
- **Action**: Perform a rigorous self-review or consult the Oracle agent for a peer review.
- **Checklist**:
    - [ ] Code follows project patterns?
    - [ ] No type errors (`lsp_diagnostics` clean)?
    - [ ] Tests passed (if applicable)?
    - [ ] Requirements fully met?
- **Fix**: If issues are found, fix them IMMEDIATELY. Do not move to review status in the PM tool; handle it internally.

### 3. Completion Phase
- **Action**: Once implementation and review are passed:
    1. Update `tasks.json`: Set status to `completed`.
    2. Sync will push status to "Done" in Jira/Plane.
- **MANDATORY FINAL STEP**: Execute `/checkpoint`.
    - This ensures a git commit is created, the workspace is cleaned, and the session is properly closed.

## ⚠️ Critical Rules
- **NEVER** leave a ticket in `in_progress` if you have finished the work.
- **NEVER** skip the `/checkpoint` at the end. It is the definition of "Done".
- **IF** you cannot complete the task in one session, leave it in `in_progress` and use `/handoff` instead of `/checkpoint`, but explicitly note why.

## 🔗 Related Documentation
- **Implementation Guide**: `docs/handoffs/IMPLEMENTATION-001-AUTO-REVIEW.md` (code paths, architecture)
- **PRD**: `docs/PRD-v3-VirtualWorkforce.md` Phase 1.5 (FR-105)
- **Reference**: Auto-Claude open-source project (GitHub Issues automation)

---
**Example Scenario**:
> Ticket: "Add 'About Us' page" (Labels: `opencode-sync`, `automatic-review`)
> Status: "In Progress"
>
> **Agent**:
> 1. Creates `about.html`.
> 2. Checks code: "Oops, missing footer".
> 3. Fixes footer.
> 4. Marks task completed.
> 5. Runs `/checkpoint`.
