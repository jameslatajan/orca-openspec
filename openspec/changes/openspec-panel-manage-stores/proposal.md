## Why

Stores can only be created and changed outside Orca: with `openspec store setup` in a terminal, and by hand-editing `openspec/config.yaml`. The user wants to create a store and change a workspace's store from the panel.

## What Changes

- **New store:**
  - a form (id plus folder, defaulting to `openspec-<id>` next to the workspace's folder) runs `openspec store setup <id> --path <folder>`, with git init and a first commit;
  - then it links the workspace, or switches it to the new store.
- **Change store** in store-linked workspaces: switch to another registered store, or unlink. Only the `store:` line is touched.
- **"Not set up" detection:** an `openspec/` folder with no config, no `changes/` and no `specs/` counts as not set up, so unlinking returns to Init / Link store.
- No new capabilities.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `openspec-panel`: adds "Create a store" and "Change a workspace's store".

## Impact

- `plugin/src/store.ts` (setup, switch, unlink), `src/openspec.ts` (`hasOpenSpec`), `src/worker.ts` and `src/protocol.ts` (requests), and `src/panel.tsx` (forms).
- Tests, `README.md` and `CLAUDE.md`.
