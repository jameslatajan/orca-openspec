## Why

The user wants to pick the Claude model when starting a change from the New change form. Orca's `agent.launch` has no model parameter, but Claude Code accepts `/model <name>` at its prompt, and the plugin already types commands into a ready agent.

## What Changes

- **Model picker:** the New change form shows a Model picker (Default, Opus, Sonnet, Haiku) when the agent is `claude`, and remembers the last choice.
- **Launch:** for Explore and Propose, the plugin types `/model <model>` once Claude is ready, waits for it to be ready again, then types the OpenSpec command.
- **Unchanged:** Default, other agents, and Apply/Verify/Archive send no `/model`.
- No new capabilities, so no re-approval.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `openspec-panel`: "Launch workflow actions" gains the model picker.

## Impact

- `plugin/src/protocol.ts` (`model` on `openspec.launch`), `plugin/src/worker.ts` (`launchVisible`), `plugin/src/panel.tsx`, tests and `README.md`.
