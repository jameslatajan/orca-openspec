## ADDED Requirements

### Requirement: Link a workspace to a store
When the focused workspace has no `openspec/` folder, the "not set up" screen SHALL offer, next to Init OpenSpec, a dropdown of the stores registered on this machine and a Link store button. Linking SHALL create `openspec/config.yaml` containing `store: <id>` and then reload the panel. The plugin SHALL never overwrite an existing config. With no stores registered, the screen SHALL say so and show the `openspec store register <path>` command instead of the dropdown.

#### Scenario: Link to a registered store
- **WHEN** HIS COLIN has no `openspec/` folder, the user picks `isotech` and presses Link store
- **THEN** `openspec/config.yaml` is created with `store: isotech`, and the panel shows the isotech store's items with "via store isotech"

#### Scenario: Existing config is kept
- **WHEN** `openspec/config.yaml` already exists at link time
- **THEN** nothing is written and the panel shows an error saying the config already exists

#### Scenario: No stores registered
- **WHEN** `openspec store list --json` lists no stores
- **THEN** the screen shows "No OpenSpec stores are registered on this machine" with the `openspec store register <path>` command, and only Init OpenSpec is offered
