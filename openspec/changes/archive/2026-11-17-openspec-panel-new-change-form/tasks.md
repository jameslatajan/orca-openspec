## 1. Worker

- [x] 1.1 Manifest: add the `workspace:write` and `terminal:read` capabilities
- [x] 1.2 Protocol: `OpsxStep` adds `explore`; `openspec.launch` input adds optional `description` and `agent`; add the panel event `openspec.showForm`
- [x] 1.3 `promptFor` handles explore and a description argument; add a pure, tested `isReady(lines)`
- [x] 1.4 `launchVisible`: launch without a prompt, focus, wait until ready (500 ms / 30 s, from `options`), then sendText with Enter; log a timeout
- [x] 1.5 Palette "New change" posts `openspec.showForm` and shows a notification
- [x] 1.6 Worker tests: launch call order, prompt text, the timeout path, focus failure tolerated, `isReady` cases

## 2. Panel

- [x] 2.1 The + button toggles an inline form: Textarea, agent Select (default from settings), Explore / Propose / Cancel
- [x] 2.2 Explore and Propose are disabled while the description is empty; close the form and clear it after a successful launch; show errors in the form
- [x] 2.3 Listen for `openspec.showForm`
- [x] 2.4 Panel tests: open the form, disabled state, Explore sends description and agent, Cancel, the showForm event

## 3. Docs and verify

- [x] 3.1 README (form, agents, permissions) and CLAUDE.md (launch flow, orphaned-terminal finding)
- [x] 3.2 `orca plugin test` and `check`; the user re-approves in Orca; live: Explore from the form shows the agent and the command arrives
