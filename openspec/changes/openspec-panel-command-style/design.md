## Context

`worker.ts` builds the prompt in `opsxPrompt(step, change)` and reads the `agent` setting with `orca.settings.get`. On this machine, `~/.claude/commands` has no `opsx` folder. The OpenSpec skills are installed as `openspec-propose`, `openspec-apply-change`, `openspec-verify-change` and `openspec-archive-change`, and the live agent sat idle after receiving `/opsx:propose`.

## Goals / Non-Goals

**Goals:** prompts that run on a default OpenSpec + Claude Code install, plus a switch for setups with `/opsx` commands.
**Non-Goals:** detecting installed commands automatically; asking for a description before New change.

## Decisions

- **Setting `commandStyle`**: a string with enum `["skill","opsx"]`, labels "Skill commands (/openspec-…)" and "OPSX commands (/opsx:…)", default `skill`. A setting rather than autodetection, because the worker can't see which commands the agent has; it may run on another host or in another agent's profile.
- **`promptFor(step, change, style)`** replaces `opsxPrompt`, using a fixed step → skill-name map. Unknown or missing setting values fall back to `skill`.
- **Re-approval:** settings are not capabilities, so no new access is requested. If Orca still prints an approval for the manifest change, the user approves it; never approve on their behalf.

## Risks / Trade-offs

- Users who rely on `/opsx` must switch the setting once; the README says so.
