## Why

The sidebar panel is narrow. The user wants a full-size view in the main area. Orca places plugin panels only in the right sidebar, but a plugin's custom editor opens as a main-area tab. The user approved a Kanban board mockup (third row of https://claude.ai/artifact/WyCFozq366rZPgDJvimdr7).

## What Changes

- **Board tab:** a custom editor for `board.openspec` that renders a Kanban board of changes plus a specs side list. It uses the worker's existing data, live updates and launch actions.
- **Opening it:** "OpenSpec: Open board" in the palette and a board button in the panel header create `openspec/board.openspec` (gitignored) and open it.
- **Next task:** the worker includes each change's next unchecked task in state.
- The sidebar panel stays.
- **Approval:** the new command and custom editor require one re-approval. No new capabilities: `workspace:write`, already granted, covers `editor.open`.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `openspec-panel`: adds "Open a board tab" and "Kanban board".

## Impact

- `plugin/orca-plugin.json` (customEditors, command).
- New `plugin/board/main.ts` and `plugin/board/board.css`.
- `src/openspec.ts` (next task), `src/protocol.ts`, `src/worker.ts`, `src/panel.tsx` (header button).
- Tests, `README.md` and `CLAUDE.md`.
