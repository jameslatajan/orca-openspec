# openspec-panel Specification

## Purpose
An Orca sidebar panel that shows the focused workspace's OpenSpec changes, task progress and specs, and launches agents for the /opsx propose, apply, verify and archive steps.

## Requirements

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
- **WHEN** `acme-claims/openspec/config.yaml` contains `store: teamstore` and `teamstore` is registered at `C:\projects\openspec-store`
- **THEN** the panel lists the changes and specs under `C:\projects\openspec-store\openspec` and shows "via store teamstore"

#### Scenario: Unknown store
- **WHEN** the config declares `store: missing` and no store with that id is registered
- **THEN** the panel shows an error naming the store and the fix (`openspec store register <path>`)

#### Scenario: OpenSpec CLI unavailable
- **WHEN** the config declares a store and `openspec store list --json` cannot run
- **THEN** the panel shows an error saying the `openspec` CLI is needed to resolve stores

#### Scenario: Store edits refresh the panel
- **WHEN** a `tasks.md` in the store's `openspec/changes/` is saved with one more box checked
- **THEN** the panel shows the updated progress without pressing Refresh

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

### Requirement: Filter store items by system
In a store-linked workspace, the panel SHALL offer a single scope dropdown with this system (labelled with its prefixes) and "All systems", defaulting to this system. A workspace's system is a list of name prefixes, remembered per workspace and editable in the store settings box. The default list is the workspace-name words that match a known store prefix. A known prefix is the text before the first `-` in a change or spec name, shared by at least 3 store items. In this-system mode, the Changes and Specs tabs SHALL list items whose prefix is in the list, then a "Shared" section with items whose prefix is not known; tab counts SHALL include only those. Workspaces without a store SHALL be unchanged.

#### Scenario: Default system from the workspace name
- **WHEN** the workspace "ACME CLAIMS" is linked to a store whose items include at least 3 named `claims-…`
- **THEN** its prefix list defaults to `claims`, and the Changes tab lists only the `claims-…` changes plus the Shared ones

#### Scenario: Shared items
- **WHEN** the store has a spec `access-control` and fewer than 3 items start with `access-`
- **THEN** in this-system mode `access-control` appears under "Shared"

#### Scenario: Other systems hidden
- **WHEN** this-system mode is on with prefixes `claims`
- **THEN** `ess-ldna-print` and `doh-…` items are not listed

#### Scenario: All mode
- **WHEN** the user picks "All systems" in the scope dropdown
- **THEN** every store change and spec is listed, as before

#### Scenario: Edit the system
- **WHEN** the user sets the prefixes to `claims, ess` in the store settings box
- **THEN** items of both systems are listed, and the list is remembered for this workspace

### Requirement: Link a workspace to a store
When the focused workspace has no `openspec/` folder, the "not set up" screen SHALL offer, next to Init OpenSpec, a dropdown of the stores registered on this machine and a Link store button. Linking SHALL create `openspec/config.yaml` containing `store: <id>` and then reload the panel. The plugin SHALL never overwrite an existing config. With no stores registered, the screen SHALL say so and show the `openspec store register <path>` command instead of the dropdown.

#### Scenario: Link to a registered store
- **WHEN** ACME HR has no `openspec/` folder, the user picks `teamstore` and presses Link store
- **THEN** `openspec/config.yaml` is created with `store: teamstore`, and the panel shows the teamstore store's items with "via store teamstore"

#### Scenario: Existing config is kept
- **WHEN** `openspec/config.yaml` already exists at link time
- **THEN** nothing is written and the panel shows an error saying the config already exists

#### Scenario: No stores registered
- **WHEN** `openspec store list --json` lists no stores
- **THEN** the screen shows "No OpenSpec stores are registered on this machine" with the `openspec store register <path>` command, and only Init OpenSpec is offered

### Requirement: Load specs in batches
The Specs tab SHALL show specs in a table that first draws at most 40 rows and draws 40 more each time the user scrolls near the last drawn row, until every matching spec is shown. The name filter and the This system / All toggle SHALL search all specs, and changing either SHALL start again from the first 40. The tab label SHALL keep the full count. In a store workspace's This system mode, each row SHALL show whether it belongs to this system or is shared.

#### Scenario: First batch
- **WHEN** the Specs tab holds 125 specs
- **THEN** 40 rows are drawn and the label still reads "Specs (125)"

#### Scenario: Scroll for more
- **WHEN** the user scrolls near the last of 40 drawn rows
- **THEN** 40 more rows are drawn, and loading stops once all 125 are shown

#### Scenario: Filter resets the batch
- **WHEN** the user types in the Specs filter
- **THEN** matches are found among all specs, and drawing restarts from the first 40 matches

#### Scenario: Shared specs in a store workspace
- **WHEN** This system mode is on
- **THEN** each spec row shows "This system" or "Shared"

### Requirement: Open a board tab
The plugin SHALL offer "OpenSpec: Open board" as a palette command and as a board button in the panel header. It SHALL work only when the focused local workspace has an `openspec/` folder, local or store-linked; otherwise it SHALL say to set up OpenSpec first and create nothing. Opening SHALL create `openspec/board.openspec` if missing, add `board.openspec` to `openspec/.gitignore` once, and open that file in a main-area editor tab.

#### Scenario: Open the board
- **WHEN** the focused workspace has `openspec/` and the user runs "OpenSpec: Open board"
- **THEN** `openspec/board.openspec` exists, `openspec/.gitignore` lists it, and the board opens in a main editor tab

#### Scenario: Workspace without OpenSpec
- **WHEN** the focused workspace has no `openspec/` folder
- **THEN** a notification says to set up OpenSpec first, and no file is created

### Requirement: Kanban board
The board tab SHALL show the focused workspace's changes in five columns: Planning, Not started, In progress, Ready to archive (using the panel's status rules) and Archived.

- **Cards:** each card SHALL show:
  - the change name;
  - a progress bar with done/total;
  - the first sentence of the proposal's Why section, when there is one;
  - the change's date: `created` from `.openspec.yaml`, or the date prefix of an archived folder;
  - the next unchecked task, when one exists.
- **Quick actions:** hovering an active card SHALL show quick actions that launch agents as the panel does:
  - Apply on Planning and Not started cards;
  - Apply and Verify on In progress cards;
  - Archive on Ready to archive cards.

  Archived cards SHALL have no quick actions.
- **Archived column:** it SHALL list `changes/archive/` newest first, start collapsed, and load cards in batches of 40.
- **Header:** the header SHALL show:
  - the workspace name, and "via store <id>" when linked;
  - a change filter, matching names and summaries;
  - New change, Specs and Refresh.
- **System filter:** in store workspaces, the This system / All toggle SHALL filter cards and specs as in the panel.
- **Specs drawer:** the Specs button SHALL open a drawer listing specs with a filter, loading them in batches of 40 as it scrolls.
- **Updates and theme:** the board SHALL update when the worker posts new state, and follow Orca's light and dark themes.

#### Scenario: Cards in status columns
- **WHEN** the workspace has changes at 0/6, 6/8 and 9/9 tasks and one without tasks.md
- **THEN** they appear under Not started, In progress, Ready to archive and Planning respectively

#### Scenario: Card summary
- **WHEN** a change's proposal.md has a Why section starting "Employees cannot print their LDNA. PETRU has an API."
- **THEN** its card shows "Employees cannot print their LDNA."

#### Scenario: Ready card actions
- **WHEN** the user hovers a card in Ready to archive and presses Archive, then confirms the dialog
- **THEN** an agent starts with the archive command for that change

#### Scenario: Quick actions by column
- **WHEN** the user hovers a Ready to archive card
- **THEN** it shows Archive only, and an In progress card shows Apply and Verify

#### Scenario: Archived column
- **WHEN** the workspace has 100 archived changes
- **THEN** the Archived column shows 100 as its count, the newest 40 once expanded, and more as it scrolls

#### Scenario: Live update
- **WHEN** a task is ticked in a change's tasks.md
- **THEN** the card's progress updates and it moves column if its status changed

### Requirement: Change detail page
Clicking a card SHALL open that change's detail page in the board tab.

- **Header:** the page SHALL show:
  - the change name and status;
  - a progress bar with done/total, and the created date;
  - the specs the change has deltas for.
- **File tabs:** the page SHALL show tabs for the change's files, grouped as:
  - Docs: `proposal.md`, `design.md`, `tasks.md`, each only when it exists;
  - Other: any other markdown file in the change folder;
  - Spec deltas: one tab per `specs/<capability>/spec.md`.

  `proposal.md` SHALL be selected first.
- **File view:** the selected file SHALL be shown as rendered markdown, with its path under `openspec/` and an Edit action that opens it in a main-area editor tab. On the `tasks.md` tab, task boxes SHALL be shown as a read-only checklist.
- **Side column:** a side column SHALL show the workspace (and store, when linked) and the related changes: other active or archived changes with a delta for one of the same specs. Clicking a related change SHALL open its detail page.
- **Actions on an active change:** Apply, Verify, Explore, Open in editor and Archive. Apply, Verify and Explore SHALL launch the agent at once, with Explore sending `/openspec-explore <change>` in the `skill` style or `/opsx:explore <change>` in the `opsx` style.
- **Actions on an archived change:** only Open in editor.
- **Going back:** a Back button, a breadcrumb link, the header title and the Esc key SHALL each return to the board, keeping its filter and scroll position.

File content SHALL be rendered as text and markup only. Content from a file SHALL never run as script.

#### Scenario: Open a change
- **WHEN** the user clicks the `add-dark-mode` card, which has proposal.md, tasks.md, `agent/notes.md` and a delta for `ui-theme`
- **THEN** the detail page shows tabs proposal.md, tasks.md (Docs), notes.md (Other) and ui-theme (Spec deltas), with proposal.md rendered

#### Scenario: Edit a file
- **WHEN** the user presses Edit on the design.md tab
- **THEN** `openspec/changes/<change>/design.md` opens in a main-area editor tab

#### Scenario: Script in a file
- **WHEN** a proposal.md contains `<script>alert(1)</script>`
- **THEN** the text is shown literally and nothing runs

#### Scenario: Archived change
- **WHEN** the user opens an archived change
- **THEN** its files can be read but no Apply, Verify, Explore or Archive action is shown

#### Scenario: Back with Esc
- **WHEN** the detail page is open and no dialog is open and the user presses Esc
- **THEN** the board is shown again

### Requirement: Spec detail page
Clicking a spec in the specs drawer SHALL open its detail page in the board tab. The page SHALL show the rendered `spec.md`, an Edit action that opens it in an editor tab, and the changes (active and archived) that carry a delta for that spec, each opening its change detail page.

#### Scenario: Changes that touched a spec
- **WHEN** the user opens spec `ui-theme`, and the active change `add-dark-mode` and one archived change have deltas for it
- **THEN** the page lists both changes under "Changed by"

### Requirement: Confirm archive on the board
Archive on the board, from a card or the detail page, SHALL first show a dialog naming the change and the command it will send. Only its confirm button SHALL launch the agent; Cancel, a click outside the dialog, or Esc SHALL close it and launch nothing. When the change has unfinished tasks, the dialog SHALL say how many. Apply, Verify and Explore on the board, and every action in the sidebar panel, SHALL launch without a dialog.

#### Scenario: Cancel archive
- **WHEN** the user presses Archive on a change and then Cancel
- **THEN** no agent starts

#### Scenario: Unfinished tasks warning
- **WHEN** the user presses Archive on a change at 11/12 tasks
- **THEN** the dialog says 1 of 12 tasks is not done

#### Scenario: Apply does not ask
- **WHEN** the user presses Apply on the detail page
- **THEN** an agent starts at once with `/openspec-apply-change <change>`

### Requirement: Board file access stays inside OpenSpec
Reading or opening a file from the board SHALL be allowed only for paths inside the focused workspace's OpenSpec data root (`openspec/`, or the linked store's root). Paths that resolve outside it, including through `..` or a symlink, SHALL be refused with an error and nothing SHALL be read or opened.

#### Scenario: Path outside OpenSpec
- **WHEN** the board asks to read `changes/../../src/worker.ts`
- **THEN** the request fails with an error and no file is read

### Requirement: Create a store
The panel SHALL offer "New store" on the "not set up" screen and in the Change store control. The form SHALL take a store id (letters, digits, `.`, `_`, `-`) and a folder, defaulting to `openspec-<id>` next to the focused workspace's folder. Creating SHALL run `openspec store setup <id> --path <folder>`, which also starts a git repository with a first commit. The new store SHALL then be linked to the workspace (not set up) or switched to (Change store). Folder paths containing `"`, `&`, `|`, `<`, `>`, `^`, `%` or a line break SHALL be refused before anything runs.

#### Scenario: Create and link from the not-set-up screen
- **WHEN** ACME HR has no OpenSpec and the user creates store `hr` with the default folder
- **THEN** `openspec store setup hr --path C:\projects\openspec-hr` runs, and the workspace's `openspec/config.yaml` gets `store: hr`

#### Scenario: Unsafe folder
- **WHEN** the folder contains `&`
- **THEN** the panel shows an error and no command runs

### Requirement: Change a workspace's store
In a store-linked workspace, the panel SHALL offer a Change store control: switch to another registered store, or unlink. Switching SHALL rewrite only the top-level `store:` line of the workspace's OpenSpec config. Unlinking SHALL remove that line, and delete `config.yaml` if nothing else remains in it. Workspaces with a local OpenSpec root (no `store:` line) SHALL NOT offer Change store. A workspace whose `openspec/` folder has no config, no `changes/` and no `specs/` SHALL count as not set up.

#### Scenario: Switch store
- **WHEN** ACME CLAIMS is linked to `teamstore` and the user switches to `acme`
- **THEN** its config's `store:` line reads `store: acme`, other config lines are unchanged, and the panel shows acme's items with "via store acme"

#### Scenario: Unlink
- **WHEN** the user unlinks a workspace whose config holds only `store: teamstore`
- **THEN** `config.yaml` is deleted and the panel shows the "not set up" screen with Init OpenSpec and Link store

#### Scenario: Local root
- **WHEN** the workspace has its own `openspec/changes` and no `store:` line
- **THEN** no Change store control is shown
