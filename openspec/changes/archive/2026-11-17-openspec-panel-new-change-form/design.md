## Context

Live findings: `agent.launch({workspaceId, agent, prompt})` returned a terminal id, but `orca terminal list` showed every such terminal as `orphaned` (no pane). Each screen showed an idle Claude Code input with no prompt typed. The host API offers `terminal.focus` (`workspace:write`), `terminal.read` (`terminal:read`, last ≤2000 lines as text) and `terminal.sendText` (`terminal:send`, already granted). The components panel has `Textarea`, `Select`, `Button` (with `disabled`) and `Callout`.

## Goals / Non-Goals

**Goals:** a visible agent that reliably receives its command; a description form with an agent picker; explore as the default way to start.
**Non-Goals:** detecting which agents are installed; per-agent command syntax (all agents get the same slash-command text).

## Decisions

- **Launch flow (`launchVisible` in the worker):**
  1. `agent.launch` without a prompt;
  2. `terminal.focus` (failure is logged, not fatal);
  3. `waitReady`;
  4. `terminal.sendText({text: prompt, enter: true})`.

  Sending the prompt ourselves avoids shell quoting, because the text is typed rather than passed on a command line.
- **Readiness (`isReady(lines)`, pure and tested):** the screen is ready when one of its last 15 lines starts with an input marker (`❯`, `>`, `›`). The loop also requires the output to be unchanged between two consecutive reads, so the agent's startup banner has finished. It polls every 500 ms for up to 30 s, and on timeout sends anyway. Delay and timeout are in `options`, so tests run fast.
- **Agent list:** a fixed list of six common Orca agent kinds; the default is the `agent` setting, added to the list if it isn't there.
- **Form state:** panel-only atoms (`formOpen`, `description`, `formAgent`). `description` is not persisted, so it doesn't linger after a launch.
- **Palette "New change":** the worker posts `openspec.showForm` to open panels and shows a notification, "Describe the change in the OpenSpec panel." Workers can't open a panel themselves.
- **Protocol:** `OpsxStep` adds `explore`; `openspec.launch` input adds optional `description` and `agent`. `promptFor(step, arg, style)` uses whichever of change or description is passed.

## Risks / Trade-offs

- Readiness detection depends on an agent's screen. Agents without a `❯`, `>` or `›` prompt hit the 30 s timeout, then still receive the text.
- Two new capabilities mean a one-time re-approval; until then the plugin doesn't load. The user approves, never the agent.
- Non-Claude agents may not understand `/openspec-explore` (each agent installs OpenSpec commands differently). Documented in the README.
