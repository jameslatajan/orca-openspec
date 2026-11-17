## Why

The current panel shows only a few changes, cuts off its header buttons in a narrow sidebar, and gives changes no state beyond a count. The user picked "Layout B" from the redesign mockup (https://claude.ai/artifact/WyCFozq366rZPgDJvimdr7): tabs, compact rows and a bottom action bar. It fits more changes and keeps the actions in one place.

## What Changes

- **Header:** the workspace name, plus icon buttons for New change and Refresh, so nothing is clipped at sidebar width.
- **Tabs:** "Changes (n)" and "Specs (n)".
- **Changes tab:**
  - a name filter and All / In progress / Done chips;
  - compact rows showing the name, a status line (Planning, Not started, In progress, Ready to archive), a thin progress bar and done/total.
- **Selected change:** a bottom action bar with the change name, Apply and Verify. When the change is Ready to archive, Archive replaces Verify.
- **Specs tab:** a name filter and spec rows, with nested specs indented.
- **Persistence:** the active tab, filter text and chip persist in plugin storage.
- **Unchanged:**
  - the empty, no-workspace, remote and error states keep their behaviour and get the new header;
  - palette commands, including Archive at any time;
  - the worker, the manifest and capabilities.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `openspec-panel`: these requirements change:
  - Show active changes with task progress (status, filter);
  - Show specs (tab, filter);
  - Launch workflow actions (action bar, Archive only when ready in the panel).

## Impact

- `plugin/src/panel.tsx` (rewrite) and `plugin/src/panel.test.tsx`; possibly a small pure helper, `plugin/src/view.ts`, for the status and filtering logic.
- Only Orca components are used, so the circular progress ring and the "···" menu from the mockup become a progress bar and a conditional Archive button.
