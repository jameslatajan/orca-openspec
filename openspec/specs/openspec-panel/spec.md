# openspec-panel Specification

## Purpose
An Orca sidebar panel that shows the focused workspace's OpenSpec changes, task progress and specs, and launches agents for the /opsx propose, apply, verify and archive steps.

## Requirements

### Requirement: Show active changes with task progress
The panel SHALL list every active change under `openspec/changes/` of the focused workspace (excluding `archive/`), each with its name and task progress as checked/total, counted from `- [x]` / `- [ ]` lines in its `tasks.md`.

#### Scenario: Change with tasks
- **WHEN** the focused workspace has `openspec/changes/add-auth/tasks.md` with 3 of 5 boxes checked
- **THEN** the panel shows `add-auth` with progress `3/5`

#### Scenario: Change without tasks.md
- **WHEN** a change folder has no `tasks.md`
- **THEN** the panel shows the change with progress "no tasks"

### Requirement: Show specs
The panel SHALL list the capability names found as `openspec/specs/<capability>/spec.md`, including nested capability paths.

#### Scenario: Specs listed
- **WHEN** the workspace has `openspec/specs/auth/spec.md` and `openspec/specs/billing/invoices/spec.md`
- **THEN** the panel lists `auth` and `billing/invoices`

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
The plugin SHALL offer New change, Apply, Verify and Archive as panel buttons and palette commands. Each SHALL launch an agent in the focused workspace via `agent.launch` with the prompt `/opsx:propose`, `/opsx:apply <change>`, `/opsx:verify <change>` or `/opsx:archive <change>`. The agent kind SHALL come from a plugin setting (default `claude`).

#### Scenario: Apply a change
- **WHEN** the user presses Apply on `add-auth`
- **THEN** an agent starts in the focused workspace with prompt `/opsx:apply add-auth`

#### Scenario: Palette command with several changes
- **WHEN** the user runs the palette command "OpenSpec: Apply change" and more than one change is active
- **THEN** the change selected in the panel is used, or a notification asks the user to select one in the panel

### Requirement: Empty and error states
The panel SHALL show an empty state with an Init OpenSpec action when the workspace has no `openspec/` folder, a "no workspace" state when none is focused, and an inline error when reading fails.

#### Scenario: No openspec folder
- **WHEN** the focused workspace has no `openspec/` folder
- **THEN** the panel shows "OpenSpec is not set up" and an Init OpenSpec button that opens a terminal running `openspec init`
