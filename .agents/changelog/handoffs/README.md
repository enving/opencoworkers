# 📚 Handoff Documentation Index

This directory contains numbered handoff documents for agent sessions. Each handoff provides specific instructions, implementation guides, or policies.

> **🚀 New Agent?** Start with [START-HERE.md](../../START-HERE.md) in the repository root for a complete onboarding guide. Then come back here for specific handoff details.

---

## 📋 Quick Reference

| Handoff | Purpose | When to Use | Related Tasks |
|---------|---------|-------------|---------------|
| **WORKFLOW-001** | Automatic Review Workflow | When implementing or executing `automatic-review` tickets | TASK-034 |
| **POLICY-001** | Linear Development Policy | Always - defines git workflow rules for all agents | TASK-035 ✅ |
| **IMPLEMENTATION-001** | Auto-Review Implementation | When implementing TASK-034 (technical code guide) | TASK-034 |
| **IMPLEMENTATION-002** | Multi-Repository Support | When implementing TASK-037 (multi-repo mapping) | TASK-037 |

**Note**: USAGE-001-SKILLS.md has been moved to the test repository (`jira_opencode_plugin_test/docs/`) as it's for end-users, not plugin developers.

---

## 🔄 Workflow Documents

### WORKFLOW-001: Automatic Review Workflow
**File**: `WORKFLOW-001-AUTOMATIC-REVIEW.md`

**Purpose**: Agent instructions for autonomous task execution with automatic review.

**Key Concepts**:
- Trigger: `automatic-review` label + "In Progress" status
- Workflow: Implement → Self-Review → Fix → Complete → /checkpoint
- Mandatory: Must execute `/checkpoint` at end

**Use When**:
- Working on a ticket with `automatic-review` label
- Executing fully autonomous workflows
- Need to understand review requirements

**Inspired by**: Auto-Claude (GitHub Issues automation), Claude Code GitHub App (@claude mentions)

---

## 📏 Policy Documents

### POLICY-001: Linear Development Policy
**File**: `POLICY-001-LINEAR-DEV.md`

**Purpose**: Define git workflow rules - no branches, no worktrees, sequential commits.

**Key Rules**:
- ❌ NO branching (`git checkout -b`)
- ❌ NO worktrees (`git worktree add`)
- ✅ Sequential commits on `main`
- ✅ Concurrent tasks allowed if non-conflicting

**Use When**:
- Starting any development work
- Before making commits
- Checking if concurrent work is safe

**Inspired by**: Simplified git workflows, trunk-based development

---

## 🛠️ Implementation Guides

### IMPLEMENTATION-001: Auto-Review Implementation
**File**: `IMPLEMENTATION-001-AUTO-REVIEW.md`

**Purpose**: Technical implementation guide for TASK-034 (Automatic Review Trigger).

**Contains**:
- Architecture diagrams (Auto-Claude pattern)
- Code paths (JiraAdapter → SyncEngine → Agent)
- TypeScript code snippets
- Type definitions (`workflow_type` field)
- Testing guide

**Use When**:
- Implementing TASK-034
- Need to understand code architecture
- Writing tests for auto-review

**Reference**: Auto-Claude architecture, Claude Code GitHub App

---

### IMPLEMENTATION-002: Multi-Repository Support
**File**: `IMPLEMENTATION-002-MULTI-REPO.md`

**Purpose**: Technical implementation guide for TASK-037 (Multi-Repository Support).

**Contains**:
- GitHub Issues analogy (Issue → Repository mapping)
- Config schema (Jira Project → Git Repo)
- Code implementation (`resolveRepository()` method)
- Agent workflow with multiple repos
- Conflict resolution strategies

**Use When**:
- Implementing TASK-037
- Setting up multi-repo config
- Understanding how agents work across repos

**Reference**: GitHub Issues → Repository architecture

---

## 🎯 How to Use These Handoffs

### For New Agents:
1. **Start with POLICY-001** - Understand git workflow rules
2. **Read WORKFLOW-001** - If your task has `automatic-review` label
3. **Use IMPLEMENTATION docs** - When implementing specific tasks

### For Developers:
1. **IMPLEMENTATION-001** - Complete code guide for auto-review feature
2. **IMPLEMENTATION-002** - Complete code guide for multi-repo feature
3. Reference PRD and tasks.json for context

### For Project Managers:
1. **WORKFLOW-001** - Understand how agents execute tickets autonomously
2. Use `automatic-review` label in Jira to trigger autonomous execution

---

## 🔗 Related Documentation

- **PRD v3**: `docs/PRD-v3-VirtualWorkforce.md` - Product vision and requirements
- **Architecture**: `ARCHITECTURE.md` - System design
- **Tasks**: `.agent-config/tasks.json` - Single source of truth for all tasks
- **README**: `README.md` - Project overview and quick start

---

## 📊 Handoff Relationships

```
WORKFLOW-001 (What agents should do)
    ↓ References
IMPLEMENTATION-001 (How to implement it)
    ↓ Uses
POLICY-001 (Git rules to follow)
    ↓ Related to
IMPLEMENTATION-002 (Multi-repo architecture)
```

---

## 🚀 Quick Start for Agents

**New agent starting a session?**

1. Read `.agent-config/tasks.json` to see your assigned tasks
2. Check task description for "HANDOFF: XXX" references
3. Read the referenced handoff(s)
4. Execute task following handoff instructions
5. Update tasks.json when complete

**Example**:
```json
{
  "id": "TASK-034",
  "title": "Implement Automatic Review Trigger",
  "description": "... HANDOFFS: WORKFLOW-001, IMPLEMENTATION-001. See docs/handoffs/..."
}
```
→ Read WORKFLOW-001 + IMPLEMENTATION-001 before starting TASK-034

---

## 📝 Naming Convention

Format: `{TYPE}-{NUMBER}-{DESCRIPTION}.md`

**Types**:
- `WORKFLOW` - Agent execution workflows
- `POLICY` - Project-wide rules and constraints
- `IMPLEMENTATION` - Technical implementation guides

**Numbering**: 001, 002, 003... (sequential within each type)

---

**Maintained by**: Tristan Häfele
**Last Updated**: 2026-01-18
**Version**: 1.0
**Inspired by**: Auto-Claude, Claude Code GitHub App, GitHub Issues architecture
