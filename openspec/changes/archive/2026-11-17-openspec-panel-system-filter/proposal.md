## Why

A shared OpenSpec store (teamstore: 333 specs, changes for doh, ess, claims, case, …) shows every system's items in every linked workspace, so a user can't tell which belong to their system. OpenSpec records no project membership; names carry a system prefix by convention (`claims-…`, `ess-…`).

## What Changes

- **Toggle:** store-linked workspaces get a This system / All toggle (default This system).
- **System prefixes:**
  - each workspace has a prefix list, guessed from its name and editable in the panel;
  - the list is stored per workspace by the worker.
- **This system mode:**
  - lists matching items first, then a "Shared" section for items without a known system prefix;
  - hides other systems' items;
  - tab counts follow the mode.
- **Unchanged:** non-store workspaces, the store itself, and permissions.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `openspec-panel`: adds the requirement "Filter store items by system".

## Impact

- `plugin/src/view.ts` (prefix logic), `src/worker.ts` (prefix get/set), `src/protocol.ts`, `src/panel.tsx`, tests, `README.md` and `CLAUDE.md`.
