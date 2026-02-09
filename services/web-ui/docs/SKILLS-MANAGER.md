# UI Skills Manager: Extraction & Adaptation

This document details the process of extracting the **Skills Manager** component from OpenWork and adapting it for the **OpenCoworkers** team orchestration platform.

## Overview

The Skills Manager is a core component that allows users to discover, install, and manage OpenCode skills. In OpenWork (single-user), it manages local skills in the `.agent-config/skill` directory. For OpenCoworkers, we are extending this to support a team-wide skill catalog and multi-agent skill assignment.

---

## 1. Backend Extraction: `opkg.rs`

The backend logic for skill installation is written in Rust and resides in `src-tauri/src/opkg.rs`. This module interacts with various CLI tools to ensure skills can be installed even if the primary package manager is missing.

### Core Functionality: `opkg_install`

The `opkg_install` function takes a `project_dir` and a `package` name/source and attempts to install it using a series of fallback mechanisms.

#### Fallback Logic (The "Resilient Installer" Pattern)

To ensure maximum compatibility across different environments (Windows, macOS, Linux) and user setups, the installer follows this sequence:

1.  **Native `opkg`**: Attempts to run the globally installed `opkg` command.
2.  **Native `openpackage`**: Fallback to `openpackage` (the alias for `opkg`).
3.  **`pnpm dlx`**: If no global CLI is found, it attempts to run `opkg` via `pnpm dlx opkg install`. This is preferred as it doesn't pollute the global scope.
4.  **`npx`**: Final attempt using `npx opkg install`.
5.  **Error Reporting**: If all attempts fail, it returns a descriptive error message guiding the user to install the CLI manually.

### Adaptation for OpenCoworkers
- **Multi-Workspace Support**: The `project_dir` parameter must be dynamically resolved based on the active repository mapping (as defined in `sync.json`).
- **Team Registry**: Extend the logic to support private team registries beyond the default OpenPackage registry.

---

## 2. Frontend Porting: `SkillsView.tsx`

The original OpenWork UI is built with **SolidJS**. For OpenCoworkers, we are porting this to **React** to align with our team-focused web and desktop strategy.

### Porting Strategy: SolidJS to React

| Feature | SolidJS Implementation (`SkillsView.tsx`) | React Porting Strategy |
| :--- | :--- | :--- |
| **Control Flow** | `<For>`, `<Show>` | Standard JavaScript `.map()` and logical `&&` or ternary operators. |
| **State Management** | Signals (passed via props) | React `useState` and `useEffect` hooks. |
| **Icons** | `lucide-solid` | `lucide-react`. |
| **Events** | `onInput`, `onClick` | `onChange`, `onClick`. |

### Key UI Sections to Port
- **Skill Installer**: An input field for GitHub/Registry sources and an "Install" button.
- **Curated Catalog**: A searchable list of recommended skills (PowerPoint, Excel, etc.).
- **Installed Skills**: A grid view of skills currently present in `.agent-config/skill`.

---

## 3. Team Adaptation: Multi-User & Shared Catalog

OpenWork assumes a single user with a local set of skills. OpenCoworkers adapts this for a virtual workforce.

### Multi-Agent Skill Mapping
The UI will be enhanced to show **Agent Assignments**.
- Instead of just "Installed Skills", we show "Agent Capabilities".
- **Example**: 
    - Agent **Sisyphus** -> `git`, `filesystem`
    - Agent **/pptx** -> `powerpoint-gen`
    - Agent **/xlsx** -> `excel-analysis`
- Users can see which agent is equipped with which skill and trigger re-assignments.

### Team Skill Catalog (Shared vs. Personal)
We introduce the concept of **Scopes**:
1.  **Shared (Team) Skills**: Installed at the repository root or a shared team location. These are available to all coworkers working on the project.
2.  **Personal (Local) Skills**: Installed in the user's local OpenCode environment. Useful for testing new skills before sharing with the team.

### Permissions Integration
The Skills Manager will link directly to the **Permission System**. 
- Installing a new skill will trigger a request for initial permissions (e.g., "This skill requires Network Access").
- Permissions can be managed per-skill, allowing for granular control over what each automated coworker can do.

---

## 4. Technical Reference: Fallback Implementation

The following snippet from `opkg.rs` illustrates the resilient installation logic that must be preserved during extraction:

```rust
pub fn opkg_install(project_dir: &str, package: &str) -> Result<ExecResult, String> {
  // 1. Try 'opkg'
  let mut opkg = Command::new("opkg");
  // ... configuration ...
  if let Some(result) = run_capture_optional(&mut opkg)? { return Ok(result); }

  // 2. Try 'openpackage'
  let mut openpackage = Command::new("openpackage");
  // ...
  if let Some(result) = run_capture_optional(&mut openpackage)? { return Ok(result); }

  // 3. Try 'pnpm dlx opkg'
  let mut pnpm = Command::new("pnpm");
  // ... arg("dlx").arg("opkg").arg("install") ...
  if let Some(result) = run_capture_optional(&mut pnpm)? { return Ok(result); }

  // 4. Try 'npx opkg'
  let mut npx = Command::new("npx");
  // ...
  if let Some(result) = run_capture_optional(&mut npx)? { return Ok(result); }

  // 5. Failure
  Ok(ExecResult {
    ok: false,
    status: -1,
    stderr: "OpenPackage CLI not found...".to_string(),
    // ...
  })
}
```

---

## 5. Next Steps

1.  **Extraction**: Move `opkg.rs` to `src-tauri/src/core/` in the OpenCoworkers project.
2.  **React Conversion**: Create `src/ui/skills-manager/SkillsManager.tsx` using the React patterns defined above.
3.  **Team State**: Integrate with the new Team State Provider to handle multi-agent skill visibility.
