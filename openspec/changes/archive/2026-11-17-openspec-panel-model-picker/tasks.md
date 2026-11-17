## 1. Implementation

- [x] 1.1 Protocol: optional `model` on `openspec.launch`
- [x] 1.2 Worker: factor out `waitReady`; for claude with an allowed model, send `/model <m>`, wait, then the prompt; ignore other values and other agents
- [x] 1.3 Panel: Model Select (Default, Opus, Sonnet, Haiku) shown only for claude, persisted; pass `model` from Explore and Propose
- [x] 1.4 Tests: worker order (`/model` before the prompt), skipped for default, codex and invalid values; panel shows Model only for claude and passes it

## 2. Docs and verify

- [x] 2.1 README form description
- [x] 2.2 `orca plugin test` and `check`; live: Explore with Sonnet runs `/model sonnet`, then the OpenSpec command
