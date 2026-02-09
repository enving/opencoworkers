# Linear Development Policy

## 🎯 Purpose
To maintain a simple, clean, and linear history for the project, avoiding complex branching and merge conflicts during this phase.

## 📏 Core Rules

### 1. No Branching
- **Rule**: Do **NOT** create feature branches (e.g., `feature/login`, `fix/bug-123`).
- **Action**: Always work directly on the `main` (or current) branch.
- **Reason**: We want to ship commits sequentially.

### 2. No Worktrees
- **Rule**: Do **NOT** use `git worktree`.
- **Action**: Use a single working directory.

### 3. Sequential Commits
- **Rule**: Commits must be stacked one after another.
- **Workflow**:
    1. Pull latest changes (if any).
    2. Make changes for **one** ticket.
    3. Commit changes (via `/checkpoint` usually).
    4. Move to next ticket.

### 4. Concurrent Ticket Processing
- **Clarification**: "Linear Git History" != "One Task at a Time".
- **Rule**: You **CAN** work on multiple tickets in the same session/commit IF they do not conflict.
    - *Example*: Agent A creates a PPT (Ticket 1) and Agent B updates documentation (Ticket 2).
    - **Result**: One commit containing deliverables for both tickets.
- **Constraint**: If tasks modify the SAME files, process them sequentially to avoid local conflicts.

## 🚫 Forbidden Commands
- `git checkout -b ...`
- `git worktree add ...`
- `git merge ...` (unless pulling upstream)
- `git rebase ...` (unless pulling upstream)

## ✅ Allowed Commands
- `git add .`
- `git commit -m "..."`
- `git pull`
- `git push`
- `/checkpoint` (Preferred wrapper)

## 🌍 Multi-Repository Context
- **Important**: Each Jira Project may map to a DIFFERENT Git repository (see FR-107)
- **Example**: Jira Project "KAN" → `/repos/kanban-app`, "INFRA" → `/repos/infrastructure`
- **Rule**: Always ensure you're in the CORRECT repository for the ticket you're working on
- **Check**: `git remote -v` to verify repository context before committing

## 🔗 Related Documentation
- **Multi-Repo Support**: `docs/handoffs/IMPLEMENTATION-002-MULTI-REPO.md` (coming soon)
- **PRD**: `docs/PRD-v3-VirtualWorkforce.md` Phase 1.5 (FR-106, FR-107)
