## Why

In store workspaces the sidebar panel stacks six rows of controls before the first change: the header, an "Updated" line, the This system / All toggle with the system text and a pencil, tabs, the filter, and status chips. The user finds it cluttered.

## What Changes

- **Status:** the three chips become a Status dropdown on the same row as the filter box.
- **Scope:** This system / All, the system text and the pencil become one scope dropdown ("eclaims" / "All systems"). Editing the system moves into the store settings box under the badge pencil.
- **Updated:** the "Updated …" line is removed. The time shows as the refresh button's tooltip, and the refresh spinner stays.
- **Result:** four rows of controls instead of six.
- No behaviour, worker or permission changes. The board tab is unchanged.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `openspec-panel`: these requirements change:
  - Show active changes with task progress (Status dropdown);
  - Filter store items by system (scope dropdown, edit in store settings);
  - Refresh feedback (tooltip instead of a row).

## Impact

- `plugin/src/panel.tsx`, `plugin/src/panel.test.tsx`, `README.md` and `CLAUDE.md`.
