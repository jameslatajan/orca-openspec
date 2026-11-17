## MODIFIED Requirements

### Requirement: Show active changes with task progress
The panel SHALL list every active change under `openspec/changes/` of the focused workspace (excluding `archive/`) on a "Changes" tab whose label carries the change count. Each change SHALL be shown as a compact row with its name, a status, a progress bar, and task progress as checked/total, counted from `- [x]` / `- [ ]` lines in its `tasks.md`. The status SHALL be "Planning" when there is no `tasks.md`, "Not started" when no task is checked, "In progress" when some are checked, and "Ready to archive" when all are checked. The tab SHALL offer a name filter and the chips All, In progress and Done (Done = Ready to archive), and SHALL remember the filter text, chip and active tab in plugin storage.

#### Scenario: Change with tasks
- **WHEN** the focused workspace has `openspec/changes/add-auth/tasks.md` with 3 of 5 boxes checked
- **THEN** the panel shows `add-auth` with status "In progress" and progress `3/5`

#### Scenario: Change without tasks.md
- **WHEN** a change folder has no `tasks.md`
- **THEN** the panel shows the change with status "Planning" and progress "no tasks"

#### Scenario: Filter by chip
- **WHEN** the user picks the "Done" chip
- **THEN** only changes with all tasks checked are listed

#### Scenario: Filter by name
- **WHEN** the user types `auth` in the filter
- **THEN** only changes whose name contains `auth` (case-insensitive) are listed, and a "No matching changes" line shows when none match

### Requirement: Show specs
The panel SHALL list the capability names found as `openspec/specs/<capability>/spec.md`, including nested capability paths, on a "Specs" tab whose label carries the spec count, with a name filter. Nested capabilities SHALL show their full path.

#### Scenario: Specs listed
- **WHEN** the workspace has `openspec/specs/auth/spec.md` and `openspec/specs/billing/invoices/spec.md`
- **THEN** the Specs tab lists `auth` and `billing/invoices`

#### Scenario: Filter specs
- **WHEN** the user types `inv` in the Specs filter
- **THEN** only `billing/invoices` is listed

### Requirement: Launch workflow actions
The plugin SHALL offer New change, Apply, Verify and Archive as palette commands, and New change as a header button. Selecting a change in the panel SHALL show an action bar with Apply and Verify; when the selected change is Ready to archive, Archive SHALL replace Verify in the action bar. Each action SHALL launch an agent in the focused workspace via `agent.launch` with the prompt `/opsx:propose`, `/opsx:apply <change>`, `/opsx:verify <change>` or `/opsx:archive <change>`. The agent kind SHALL come from a plugin setting (default `claude`).

#### Scenario: Apply a change
- **WHEN** the user selects `add-auth` and presses Apply
- **THEN** an agent starts in the focused workspace with prompt `/opsx:apply add-auth`

#### Scenario: Archive only when ready
- **WHEN** the selected change has 3 of 5 tasks checked
- **THEN** the action bar shows Apply and Verify and no Archive button

#### Scenario: Ready change
- **WHEN** the selected change has all tasks checked
- **THEN** the action bar shows Apply and Archive, and pressing Archive starts an agent with `/opsx:archive <change>`

#### Scenario: Palette command with several changes
- **WHEN** the user runs the palette command "OpenSpec: Apply change" and more than one change is active
- **THEN** the change selected in the panel is used, or a notification asks the user to select one in the panel
