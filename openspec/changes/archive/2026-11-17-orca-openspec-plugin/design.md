## Context

Greenfield repo. Orca plugins (`orca plugin create`) run without a build step. Findings from `orca skills get orca-plugin-authoring` (host API):
- The worker (`trusted-worker`) gets `workspace.readContext`, `workspace.list` (gives each workspace's `path`), `agent.launch`, `agents.list`, `terminal.create`, `notifications.show`, `settings.get`.
- The panel only gets `plugin.request` plus events (`workspace.changed`, `agent.status.changed`), so all file reading happens in the worker.
- There is no file-watch event.

## Goals / Non-Goals

**Goals:** a read-only overview of the focused workspace, and one-click launching of the four `/opsx` steps.
**Non-Goals:** editing artifacts in the panel, store (`--store`) support, multi-workspace views, publishing to the plugin catalog.

## Decisions

- **Template `worker-panel`**: a typed `src/protocol.ts` shared by the panel and the worker, with tests included. The alternative (HTML panel) gives no typing benefit.
- **Read files with Node `fs` in the worker, not via the `openspec` CLI**: this needs no installed CLI and is fast, and the tasks.md checkbox rule is simple. The CLI is used only for `init` (in a terminal). Assumption: trusted workers may import `node:fs`. Task 1.2 verifies this; the fallback is running `openspec list --json` in a hidden terminal.
- **Workspace path** comes from `workspace.list()` matched on the `readContext().workspaceId`.
- **Refresh without a file watcher**: reload on `workspace.changed`, on `agent.status.changed` → `done` for a terminal the plugin launched, and on the Refresh button. An `fs.watch` debounce is a possible later improvement.
- **Agent kind** comes from setting `agent` (default `claude`). Prompts use the `/opsx:*` form.

## Risks / Trade-offs

- `node:fs` is unavailable in the worker → fallback described above.
- Workspaces on SSH or remote hosts have paths the local worker can't read → show an "unsupported remote workspace" state (v1).
- Edits made outside the plugin's agents only show after a manual Refresh.
