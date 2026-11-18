## MODIFIED Requirements

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

## ADDED Requirements

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
