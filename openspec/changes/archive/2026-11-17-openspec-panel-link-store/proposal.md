## Why

Workspaces without OpenSpec (ACME HR) offer only Init OpenSpec, which creates a separate local root. Teams that keep OpenSpec work in a shared store need to link the project to the store instead. Today that means hand-writing `openspec/config.yaml` with `store: <id>`, and the OpenSpec CLI has no command for it.

## What Changes

- **"Not set up" screen:** adds a dropdown of registered stores and a **Link store** button.
- **Linking:**
  - creates `openspec/config.yaml` with `store: <id>`, never overwriting an existing file;
  - then reloads the panel, so the store's items show, filtered to the workspace's system.
- **No stores registered:** the screen explains how to register one instead.
- No new capabilities.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `openspec-panel`: adds the requirement "Link a workspace to a store".

## Impact

- `plugin/src/store.ts` (list stores, write the link), `src/worker.ts` (two requests), `src/protocol.ts`, `src/panel.tsx`, tests, `README.md` and `CLAUDE.md`.
