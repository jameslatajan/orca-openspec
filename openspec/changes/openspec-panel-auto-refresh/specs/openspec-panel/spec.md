## MODIFIED Requirements

### Requirement: Refresh
The panel SHALL reload its data when the focused workspace changes, when an agent the plugin launched reaches `done`, when the user presses Refresh, and when files under the focused local workspace's `openspec/` folder change. File-change refreshes SHALL be debounced so a burst of edits causes a single reload about 300 ms after the last edit. If the folder cannot be watched, the plugin SHALL log the failure and the other refresh triggers SHALL keep working.

#### Scenario: Workspace switch
- **WHEN** the user focuses another workspace
- **THEN** the panel shows that workspace's changes and specs

#### Scenario: Task ticked outside the plugin
- **WHEN** a `tasks.md` under the focused workspace's `openspec/changes/` is saved with one more box checked
- **THEN** the panel shows the updated progress without the user pressing Refresh

#### Scenario: Burst of edits
- **WHEN** several files under `openspec/` change within 300 ms
- **THEN** the panel reloads once

#### Scenario: Unwatchable workspace
- **WHEN** the focused workspace is remote, has no `openspec/` folder, or the watch fails to start
- **THEN** no watcher runs and the Refresh button still reloads the panel
