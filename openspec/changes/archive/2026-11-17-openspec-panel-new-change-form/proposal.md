## Why

Clicking New change appeared to do nothing. Investigation in the live app found two problems:
- `agent.launch` started each agent as an orphaned background terminal that no tab shows.
- Its prompt never arrived: 7 idle agents, none of which received the command.

Apply, Verify and Archive use the same path, so they have the same bug. Separately, the user wants to describe the change in the panel, choose which agent runs it, and start with OpenSpec explore.

## What Changes

- **The + button opens an inline form:**
  - a "Describe the change" text area;
  - an "Agent" picker (claude, codex, gemini, opencode, cursor, copilot; default = the `agent` setting);
  - **Explore** (`/openspec-explore <description>`), **Propose** (`/openspec-propose <description>`) and **Cancel**.

  Explore and Propose stay disabled until a description is typed, and the form closes after a successful launch.
- **New launch flow for every action:**
  1. start the agent without a prompt;
  2. bring its terminal into view;
  3. wait until it is ready to accept input;
  4. type the command and press Enter.
- **New permissions:** `workspace:write` (show the terminal) and `terminal:read` (detect readiness). The user re-approves the plugin once. **BREAKING** for the installed copy: it won't load until re-approved.
- **The "OpenSpec: New change" palette command** asks open panels to show the form, and its notification points the user to the panel.
- **`opsx` command style** maps explore to `/opsx:explore`.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `openspec-panel`: "Launch workflow actions" (form, agent picker, explore, visible launch with reliable prompt delivery).

## Impact

- `plugin/orca-plugin.json` (2 capabilities), `src/protocol.ts`, `src/worker.ts`, `src/panel.tsx`, and tests.
- `README.md` and `CLAUDE.md`.
