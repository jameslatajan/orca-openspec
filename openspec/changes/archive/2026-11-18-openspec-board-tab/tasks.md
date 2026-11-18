## 1. Worker and data

- [x] 1.1 `readChanges` adds `next` (first unchecked task text); unit test
- [x] 1.2 Worker `openBoard`: require openspec/, create board.openspec (wx), append .gitignore once, `editor.open`; the `openspec.openBoard` request plus palette command; worker tests

## 2. Board tab

- [x] 2.1 Manifest: customEditor `board` (extensions `.openspec`, entry `board/main.ts`, isolated) and command `openspec.openBoard`
- [x] 2.2 `board/main.ts` + `board/board.css`: header, toggle, filter, four columns with cards (ring, count, next task), selection actions, specs side list with batch loading, live updates, theme variables
- [x] 2.3 Panel header board button

## 3. Docs and verify

- [x] 3.1 README and CLAUDE.md
- [x] 3.2 `orca plugin test` and `check`; the user re-approves; live: open the board in ACME CLAIMS and check the columns, actions and spec loading
