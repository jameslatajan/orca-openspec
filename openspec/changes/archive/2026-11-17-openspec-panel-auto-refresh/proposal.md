## Why

The OpenSpec panel only updates on a workspace switch, when a plugin-launched agent finishes, or when the user presses Refresh. Edits made by hand or by agents the plugin didn't start (for example, ticking tasks) leave the panel stale.

## What Changes

- The worker watches the focused local workspace's `openspec/` folder (recursive `node:fs` watch).
- File events are debounced (~300 ms after the last event), then fresh state is posted once to open panels (`openspec.changed`).
- The watcher moves on `workspace.changed`: it closes the old watcher and opens a new one. It doesn't watch remote/SSH workspaces or folders without `openspec/`.
- The watcher closes when the worker deactivates. If watching fails, the worker logs it and the manual Refresh button remains the fallback.
- No new capabilities, so users are not asked to re-approve the plugin.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `openspec-panel`: the Refresh requirement gains file-change refresh.

## Impact

- `plugin/src/worker.ts` (watcher lifecycle), a new `plugin/src/watch.ts` helper, `plugin/src/worker.test.ts`.
- No manifest change.
