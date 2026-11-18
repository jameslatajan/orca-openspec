## Why

Projects such as `acme-claims` keep their OpenSpec work in a shared store. Their `openspec/config.yaml` holds only `store: teamstore`, and the changes live in `C:\projects\openspec-store`. The panel reads only the workspace's own `openspec/` folder, so it shows 0 changes and 0 specs there, which is misleading.

## What Changes

- **Store lookup:** when a workspace's config declares `store: <id>`, the worker finds the store's folder via `openspec store list --json` (cached, re-read on Refresh) and reads changes and specs from `<storeRoot>/openspec/`.
- **Header:** shows a "via store <id>" badge.
- **Auto-refresh:** watches the store's folder.
- **Errors:** clear messages for an unknown store id or a missing `openspec` CLI.
- **Unchanged:** workspaces without `store:` and agent launches (the OpenSpec skills resolve the store themselves).
- No new capabilities.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `openspec-panel`: adds the requirement "Follow OpenSpec stores".

## Impact

- New `plugin/src/store.ts` (config parsing and store resolution), plus `worker.ts` (state and watch target), `protocol.ts` (`store` on the state), `panel.tsx` (badge), tests, `README.md` and `CLAUDE.md`.
