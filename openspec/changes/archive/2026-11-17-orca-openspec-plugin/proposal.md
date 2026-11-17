## Why

Orca users who plan work with OpenSpec have to leave the app (or type slash commands by hand) to see which changes are active, how far along their tasks are, and to start the next workflow step. An Orca plugin can surface that state in a sidebar panel and launch the right agent command in one click.

## What Changes

- New Orca plugin `openspec` in this repo, scaffolded from the `worker-panel` template (TSX components panel + TypeScript Node worker, `trusted-worker` execution).
- Sidebar panel showing, for the focused workspace: active changes with task progress (checked/total from `tasks.md`) and the list of specs.
- Panel refreshes on workspace focus changes, after an agent the plugin launched finishes, and on a manual Refresh button.
- Actions as panel buttons and palette commands: **New change** (`/opsx:propose`), and for a selected change **Apply**, **Verify**, **Archive** (`/opsx:apply|verify|archive <name>`), each started via `agent.launch` in that workspace.
- Empty state when the workspace has no `openspec/` folder, with an **Init OpenSpec** action that runs `openspec init` in a new terminal.

## Capabilities

### New Capabilities
- `openspec-panel`: The Orca sidebar panel, its data loading from `openspec/`, and the agent-launching actions.

### Modified Capabilities
<!-- none -->

## Impact

- New code only (repo is empty): `orca-plugin.json`, `src/` worker, panel, protocol and tests.
- Requires Orca >= 1.4.246 and capabilities `workspace:read`, `agent:launch`, `agent:read`, `terminal:send`; the user approves these on enable.
- Optional runtime dependency on the `openspec` CLI (used for init; reading works from files alone).
