## ADDED Requirements

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
