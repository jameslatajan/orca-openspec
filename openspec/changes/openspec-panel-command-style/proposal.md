## Why

The plugin starts agents with `/opsx:<step> <change>`. Many setups, including the author's machine, have only the OpenSpec skill commands (`/openspec-propose`, `/openspec-apply-change`, `/openspec-verify-change`, `/openspec-archive-change`). There, the agent opens but the unknown command does nothing, so New change, Apply, Verify and Archive all appear broken.

## What Changes

- New plugin setting `commandStyle`:
  - `skill` (the default) sends `/openspec-propose`, `/openspec-apply-change <change>`, `/openspec-verify-change <change>` or `/openspec-archive-change <change>`;
  - `opsx` sends `/opsx:<step> <change>` as before.
- New change still starts without a description; the agent asks for one.
- README settings table and CLAUDE.md updated.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `openspec-panel`: "Launch workflow actions" gains the command-style setting.

## Impact

- `plugin/orca-plugin.json` (one setting), `plugin/src/worker.ts`, `plugin/src/worker.test.ts`, `README.md`, `CLAUDE.md`.
- No new capabilities. A manifest settings change may require re-approving the plugin; see design.md.
