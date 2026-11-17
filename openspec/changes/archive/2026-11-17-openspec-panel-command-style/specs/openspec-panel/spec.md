## MODIFIED Requirements

### Requirement: Launch workflow actions
The plugin SHALL offer New change, Apply, Verify and Archive as palette commands, and New change as a header button. Selecting a change in the panel SHALL show an action bar with Apply and Verify; when the selected change is Ready to archive, Archive SHALL replace Verify in the action bar. Each action SHALL launch an agent in the focused workspace via `agent.launch`. The agent kind SHALL come from a plugin setting (default `claude`). The prompt SHALL follow the `commandStyle` setting:
- `skill` (default): `/openspec-propose`, `/openspec-apply-change <change>`, `/openspec-verify-change <change>` or `/openspec-archive-change <change>`;
- `opsx`: `/opsx:propose`, `/opsx:apply <change>`, `/opsx:verify <change>` or `/opsx:archive <change>`.

New change SHALL send no description, so the agent asks for one.

#### Scenario: Apply a change
- **WHEN** the user selects `add-auth` and presses Apply with the default command style
- **THEN** an agent starts in the focused workspace with prompt `/openspec-apply-change add-auth`

#### Scenario: opsx command style
- **WHEN** `commandStyle` is `opsx` and the user presses Apply on `add-auth`
- **THEN** the agent's prompt is `/opsx:apply add-auth`

#### Scenario: New change
- **WHEN** the user presses New change with the default command style
- **THEN** an agent starts with prompt `/openspec-propose`

#### Scenario: Archive only when ready
- **WHEN** the selected change has 3 of 5 tasks checked
- **THEN** the action bar shows Apply and Verify and no Archive button

#### Scenario: Ready change
- **WHEN** the selected change has all tasks checked
- **THEN** the action bar shows Apply and Archive, and pressing Archive starts an agent with the archive command for that change

#### Scenario: Palette command with several changes
- **WHEN** the user runs the palette command "OpenSpec: Apply change" and more than one change is active
- **THEN** the change selected in the panel is used, or a notification asks the user to select one in the panel
