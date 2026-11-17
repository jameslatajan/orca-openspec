## Context

`plugin/src/worker.ts` already posts `openspec.changed` from `refresh()`, and it resolves the focused workspace with `focused()`. Orca has no file-watch event (see the host API), so watching has to happen in the trusted worker with Node. The worker starts on the panel's first request and restarts on every save, so watcher state lives only in memory.

## Goals / Non-Goals

**Goals:** a live panel for local workspaces, one reload per burst of edits, clean teardown.
**Non-Goals:** watching remote/SSH workspaces, watching outside `openspec/`, a setting to turn it off.

## Decisions

- **Helper `watch.ts`**: `watchFolder(path, onChange, delayMs = 300) → { close() }` wraps `fs.watch(path, { recursive: true })` with a trailing debounce. This keeps the worker small and lets the debounce be tested with a short delay.
- **Retarget on `workspace.changed`**: close the current watcher, then call `focused()`. Start a new watcher only for a local workspace with `openspec/`. A retarget is skipped when the path is unchanged, so terminal open/close events (which also fire `workspace.changed`) don't churn the watcher.
- **Workspaces initialised later**: when `openspec/` doesn't exist, the existing triggers still cover it. After Init OpenSpec, the next workspace event or Refresh starts the watcher, because `refresh()` also calls retarget.
- **Failure**: an `fs.watch` throw or an `error` event is logged with `orca.log`, the watcher is closed, and the panel keeps the manual triggers.
- **Teardown**: export `deactivate()` from the worker to close the watcher.

## Risks / Trade-offs

- On Windows, a single save can emit several events. The debounce absorbs them.
- Recursive `fs.watch` on Linux needs Node ≥ 20. Orca ships its own Node; on failure the plugin falls back to manual refresh.
