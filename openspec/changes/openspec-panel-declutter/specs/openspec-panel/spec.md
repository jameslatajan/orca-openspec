## MODIFIED Requirements

### Requirement: Show active changes with task progress
The panel SHALL list every active change under `openspec/changes/` of the focused workspace (excluding `archive/`) on a "Changes" tab whose label carries the change count. Each change SHALL be shown as a compact row with its name, a status, a progress bar, and task progress as checked/total, counted from `- [x]` / `- [ ]` lines in its `tasks.md`. The status SHALL be "Planning" when there is no `tasks.md`, "Not started" when no task is checked, "In progress" when some are checked, and "Ready to archive" when all are checked. The tab SHALL offer, on one row, a name filter and a Status dropdown (All, In progress, Done; Done = Ready to archive), and SHALL remember the filter text, status and active tab in plugin storage.

#### Scenario: Change with tasks
- **WHEN** the focused workspace has `openspec/changes/add-auth/tasks.md` with 3 of 5 boxes checked
- **THEN** the panel shows `add-auth` with status "In progress" and progress `3/5`

#### Scenario: Change without tasks.md
- **WHEN** a change folder has no `tasks.md`
- **THEN** the panel shows the change with status "Planning" and progress "no tasks"

#### Scenario: Filter by chip
- **WHEN** the user picks "Done" in the Status dropdown
- **THEN** only changes with all tasks checked are listed

#### Scenario: Filter by name
- **WHEN** the user types `auth` in the filter
- **THEN** only changes whose name contains `auth` (case-insensitive) are listed, and a "No matching changes" line shows when none match

### Requirement: Filter store items by system
In a store-linked workspace, the panel SHALL offer a single scope dropdown with this system (labelled with its prefixes) and "All systems", defaulting to this system. A workspace's system is a list of name prefixes, remembered per workspace and editable in the store settings box. The default list is the workspace-name words that match a known store prefix. A known prefix is the text before the first `-` in a change or spec name, shared by at least 3 store items. In this-system mode, the Changes and Specs tabs SHALL list items whose prefix is in the list, then a "Shared" section with items whose prefix is not known; tab counts SHALL include only those. Workspaces without a store SHALL be unchanged.

#### Scenario: Default system from the workspace name
- **WHEN** the workspace "COLIN ECLAIMS" is linked to a store whose items include at least 3 named `eclaims-…`
- **THEN** its prefix list defaults to `eclaims`, and the Changes tab lists only the `eclaims-…` changes plus the Shared ones

#### Scenario: Shared items
- **WHEN** the store has a spec `access-control` and fewer than 3 items start with `access-`
- **THEN** in this-system mode `access-control` appears under "Shared"

#### Scenario: Other systems hidden
- **WHEN** this-system mode is on with prefixes `eclaims`
- **THEN** `ess-ldna-print` and `doh-…` items are not listed

#### Scenario: All mode
- **WHEN** the user picks "All systems" in the scope dropdown
- **THEN** every store change and spec is listed, as before

#### Scenario: Edit the system
- **WHEN** the user sets the prefixes to `eclaims, ess` in the store settings box
- **THEN** items of both systems are listed, and the list is remembered for this workspace

### Requirement: Refresh feedback
Pressing Refresh SHALL show a spinning indicator in place of the refresh button for at least 500 ms and until the reload finishes. After a reload, the refresh button's tooltip SHALL show when the panel was last updated; the panel SHALL NOT spend a separate row on it. If the reload fails, the panel SHALL show the error.

#### Scenario: Refresh shows activity
- **WHEN** the user presses Refresh
- **THEN** a spinner replaces the refresh button until the reload finishes (at least 500 ms), then the button returns

#### Scenario: Last updated time
- **WHEN** a refresh completes
- **THEN** the refresh button's tooltip reads "Updated <time>"

#### Scenario: Refresh fails
- **WHEN** the reload request fails
- **THEN** the panel shows the error message and the refresh button returns
