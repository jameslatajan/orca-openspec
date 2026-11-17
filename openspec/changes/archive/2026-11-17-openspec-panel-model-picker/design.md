## Context

`launchVisible()` already launches the agent without a prompt, focuses it, polls `terminal.read` until `isAgentReady()` sees an input marker on a stable screen, then calls `terminal.sendText`. Claude Code's `/model <alias>` accepts `opus`, `sonnet` and `haiku`.

## Goals / Non-Goals

**Goals:** pick a Claude model per launch from the form.
**Non-Goals:** models for other agents; a model setting for Apply, Verify and Archive (the user chose form only).

## Decisions

- **Wait helper:** factor the polling loop into `waitReady(terminalId)`. The flow becomes: wait → send `/model x` → wait → send the prompt. The second wait first lets the screen change (a short delay), so it doesn't match the pre-`/model` screen.
- **Model only for claude:** the worker sends `/model` only when `agent === 'claude'` and the model is one of `opus`, `sonnet` or `haiku`. Any other value is ignored, so a stale stored value can't type arbitrary text.
- **Form state:** a `formModel` atom with `persist: 'plugin'` (panel-only, like the filters). The picker is shown only while the agent is `claude`.

## Risks / Trade-offs

- If Claude shows a confirmation after `/model`, the second wait times out after 30 s, and the plugin then sends the prompt anyway (logged).
