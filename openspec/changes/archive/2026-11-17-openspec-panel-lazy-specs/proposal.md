## Why

Store workspaces can hold hundreds of specs (333 in the teamstore store, 125 for claims plus Shared). The Specs tab draws every row at once, which is slow and long to scroll.

## What Changes

- **Table:** the Specs tab becomes a compact table that draws 40 rows and loads 40 more as you scroll near the end.
- **Search:** filtering and the This system / All toggle search all specs, and restart from the first 40.
- **Group column:** in This system mode, a column marks each spec "This system" or "Shared", replacing the separate Shared heading.
- **Unchanged:** the Changes tab, the worker, and permissions.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `openspec-panel`: adds the requirement "Load specs in batches".

## Impact

- `plugin/src/panel.tsx` (SpecsTab), `plugin/src/view.ts` (a batch helper), tests, `README.md` and `CLAUDE.md`.
