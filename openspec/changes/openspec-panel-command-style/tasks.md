## 1. Implementation

- [x] 1.1 Add the `commandStyle` setting (enum skill/opsx, default skill) to `plugin/orca-plugin.json`
- [x] 1.2 Replace `opsxPrompt` with `promptFor(step, change, style)` in `worker.ts`; read the setting at launch time and fall back to `skill`
- [x] 1.3 Worker tests: default skill prompts for all four steps, `opsx` style, and the fallback for an unknown value

## 2. Docs and verify

- [x] 2.1 README settings table and the command-style note; CLAUDE.md
- [x] 2.2 `orca plugin test` and `check` pass; reload in Orca (re-approve if prompted); New change starts an agent that runs `/openspec-propose`
