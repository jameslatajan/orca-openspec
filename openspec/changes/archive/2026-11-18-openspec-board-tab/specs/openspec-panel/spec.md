## ADDED Requirements

### Requirement: Open a board tab
The plugin SHALL offer "OpenSpec: Open board" as a palette command and as a board button in the panel header. It SHALL work only when the focused local workspace has an `openspec/` folder, local or store-linked; otherwise it SHALL say to set up OpenSpec first and create nothing. Opening SHALL create `openspec/board.openspec` if missing, add `board.openspec` to `openspec/.gitignore` once, and open that file in a main-area editor tab.

#### Scenario: Open the board
- **WHEN** the focused workspace has `openspec/` and the user runs "OpenSpec: Open board"
- **THEN** `openspec/board.openspec` exists, `openspec/.gitignore` lists it, and the board opens in a main editor tab

#### Scenario: Workspace without OpenSpec
- **WHEN** the focused workspace has no `openspec/` folder
- **THEN** a notification says to set up OpenSpec first, and no file is created

### Requirement: Kanban board
The board tab SHALL show the focused workspace's active changes in four columns: Planning, Not started, In progress, Ready to archive (using the panel's status rules). Each card SHALL show the change name, a progress ring with done/total, and the next unchecked task when one exists. Selecting a card SHALL show Apply plus Verify, or Archive instead of Verify when the change is Ready to archive, launching agents as the panel does. The header SHALL show the workspace name, "via store <id>" when linked, a change filter, New change and Refresh. In store workspaces, the This system / All toggle SHALL filter cards and specs as in the panel. A side list SHALL show specs with a filter, loading them in batches of 40 as it scrolls. The board SHALL update when the worker posts new state, and follow Orca's light and dark themes.

#### Scenario: Cards in status columns
- **WHEN** the workspace has changes at 0/6, 6/8 and 9/9 tasks and one without tasks.md
- **THEN** they appear under Not started, In progress, Ready to archive and Planning respectively

#### Scenario: Ready card actions
- **WHEN** the user selects a card in Ready to archive
- **THEN** it shows Apply and Archive, and Archive starts an agent with the archive command for that change

#### Scenario: Live update
- **WHEN** a task is ticked in a change's tasks.md
- **THEN** the card's progress updates and it moves column if its status changed
