# openspec-panel Specification

## Purpose
An Orca sidebar panel that shows the focused workspace's OpenSpec changes, task progress and specs, and launches agents for the /opsx propose, apply, verify and archive steps.

## Requirements

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

### Requirement: Launch workflow actions
The plugin SHALL offer New change, Apply, Verify and Archive as palette commands, and New change as a header button.

- **New change form:** the New change button SHALL open a form in the panel with:
  - a description text area;
  - an agent picker (claude, codex, gemini, opencode, cursor, copilot), defaulting to the `agent` setting;
  - Explore, Propose and Cancel buttons.

  Explore and Propose SHALL be disabled while the description is empty, and the form SHALL close after a successful launch.
- **Action bar:** selecting a change SHALL show an action bar with Apply and Verify. When the selected change is Ready to archive, Archive SHALL replace Verify.
- **Launching:** each action SHALL start an agent in the focused workspace and bring its terminal into view. It SHALL then wait until the terminal is ready for input, polling every 500 ms for up to 30 s, and type the prompt followed by Enter. If readiness is not detected in time, it SHALL send the prompt anyway and log that it timed out.
- **Agent:** the form's agent is used for Explore and Propose. Other actions SHALL use the `agent` setting (default `claude`).
- **Model:** when the form's agent is `claude`, the form SHALL show a Model picker (Default, Opus, Sonnet, Haiku) that remembers the last choice. For Explore and Propose with a model other than Default, the plugin SHALL type `/model <model>` once the agent is ready, wait until it is ready again, then type the OpenSpec command. Default, other agents, and Apply/Verify/Archive SHALL send no `/model` command.
- **Prompt format** follows the `commandStyle` setting:
  - `skill` (default): `/openspec-explore <description>`, `/openspec-propose <description>`, `/openspec-apply-change <change>`, `/openspec-verify-change <change>` or `/openspec-archive-change <change>`;
  - `opsx`: `/opsx:explore`, `/opsx:propose`, `/opsx:apply`, `/opsx:verify` or `/opsx:archive`, followed by the description or change.

#### Scenario: Explore from the form
- **WHEN** the user presses New change, types "add dark mode", picks `codex` and presses Explore
- **THEN** a `codex` agent starts in the focused workspace, its terminal is shown, and it receives `/openspec-explore add dark mode` followed by Enter

#### Scenario: New change
- **WHEN** the user presses New change
- **THEN** the description form opens and no agent starts until Explore or Propose is pressed

#### Scenario: Empty description
- **WHEN** the form is open and the description is empty
- **THEN** Explore and Propose are disabled

#### Scenario: Cancel
- **WHEN** the user presses Cancel
- **THEN** the form closes and no agent starts

#### Scenario: Apply a change
- **WHEN** the user selects `add-auth` and presses Apply with the default command style
- **THEN** an agent starts, its terminal is shown, and it receives `/openspec-apply-change add-auth`

#### Scenario: opsx command style
- **WHEN** `commandStyle` is `opsx` and the user presses Apply on `add-auth`
- **THEN** the agent receives `/opsx:apply add-auth`

#### Scenario: Agent never looks ready
- **WHEN** the terminal shows no ready prompt within 30 s
- **THEN** the prompt is sent anyway and the timeout is logged

#### Scenario: Archive only when ready
- **WHEN** the selected change has 3 of 5 tasks checked
- **THEN** the action bar shows Apply and Verify and no Archive button

#### Scenario: Ready change
- **WHEN** the selected change has all tasks checked
- **THEN** the action bar shows Apply and Archive, and pressing Archive starts an agent with the archive command for that change

#### Scenario: Palette command with several changes
- **WHEN** the user runs the palette command "OpenSpec: Apply change" and more than one change is active
- **THEN** the change selected in the panel is used, or a notification asks the user to select one in the panel

#### Scenario: Pick a Claude model
- **WHEN** the user picks agent `claude`, model Sonnet, types "add dark mode" and presses Explore
- **THEN** the agent receives `/model sonnet`, and after it is ready again, `/openspec-explore add dark mode`

#### Scenario: No model for other agents
- **WHEN** the selected agent is `codex`
- **THEN** the form shows no Model picker and no `/model` command is sent

### Requirement: Empty and error states
The panel SHALL show an empty state with an Init OpenSpec action when the workspace has no `openspec/` folder, a "no workspace" state when none is focused, and an inline error when reading fails.

#### Scenario: No openspec folder
- **WHEN** the focused workspace has no `openspec/` folder
- **THEN** the panel shows "OpenSpec is not set up" and an Init OpenSpec button that opens a terminal running `openspec init`

### Requirement: Follow OpenSpec stores
When the focused workspace's `openspec/config.yaml` (or `config.yml`) declares a top-level `store: <id>`, the panel SHALL read changes and specs from that store's `openspec/` folder instead of the workspace's, resolving `<id>` to a folder through `openspec store list --json`. The panel header SHALL show "via store <id>". Auto-refresh SHALL watch the store's `openspec/` folder. The store list SHALL be looked up once per plugin run and again when the user presses Refresh. Agent actions are unchanged: they still start in the focused workspace. Workspaces without a `store:` line SHALL behave as before.

#### Scenario: Workspace linked to a store
- **WHEN** `colin_eclaims/openspec/config.yaml` contains `store: isotech` and `isotech` is registered at `C:\wamp64\www\projects\openspec-store`
- **THEN** the panel lists the changes and specs under `C:\wamp64\www\projects\openspec-store\openspec` and shows "via store isotech"

#### Scenario: Unknown store
- **WHEN** the config declares `store: missing` and no store with that id is registered
- **THEN** the panel shows an error naming the store and the fix (`openspec store register <path>`)

#### Scenario: OpenSpec CLI unavailable
- **WHEN** the config declares a store and `openspec store list --json` cannot run
- **THEN** the panel shows an error saying the `openspec` CLI is needed to resolve stores

#### Scenario: Store edits refresh the panel
- **WHEN** a `tasks.md` in the store's `openspec/changes/` is saved with one more box checked
- **THEN** the panel shows the updated progress without pressing Refresh
