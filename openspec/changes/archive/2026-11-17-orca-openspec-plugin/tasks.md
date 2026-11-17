## 1. Scaffold

- [x] 1.1 `orca plugin create ./plugin --template worker-panel --id openspec --name "OpenSpec"`; set capabilities `workspace:read`, `agent:read`, `agent:launch`, `terminal:send`, and setting `agent` (default `claude`)
- [x] 1.2 Spike: confirm the worker can import `node:fs`; if not, switch reading to the `openspec list --json` fallback (design.md)

## 2. Worker data

- [x] 2.1 Define `protocol.ts`: `getState` → `{ status: 'no-workspace'|'no-openspec'|'remote'|'ok'|'error', changes: {name, done, total|null}[], specs: string[], error? }`
- [x] 2.2 Resolve the focused workspace path via `readContext` + `workspace.list`
- [x] 2.3 Read changes (skip `archive/`) and count checkboxes in `tasks.md`; read nested spec capabilities
- [x] 2.4 Unit tests for the checkbox counting and the spec walk, using fixture folders

## 3. Actions

- [x] 3.1 Worker requests `launch(step, change?)` → `agent.launch` with `/opsx:<step> <change>`; remember launched terminal ids
- [x] 3.2 `initOpenSpec` → `terminal.create` with command `openspec init`
- [x] 3.3 Palette commands: New change, Apply, Verify, Archive, Refresh; use the selected change from storage, or notify when none is selected

## 4. Panel

- [x] 4.1 List changes (progress bar plus x/y), specs section, selection, and action buttons
- [x] 4.2 Empty, no-workspace, remote and error states
- [x] 4.3 Refresh on `workspace.changed`, on `agent.status.changed`→done for launched terminals, and on the button
- [x] 4.4 Panel test for each state

## 5. Verify

- [x] 5.1 `orca plugin check` and `orca plugin test` pass
- [x] 5.2 `orca plugin dev watch` against this repo: the panel shows `orca-openspec-plugin` with its progress, and Apply launches an agent
