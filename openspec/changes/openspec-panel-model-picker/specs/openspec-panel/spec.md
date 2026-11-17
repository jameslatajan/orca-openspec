## MODIFIED Requirements

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
