## 1. Store logic

- [x] 1.1 `store.ts`: `createStore` (validation, setup runner), `setStoreLine` (switch, unlink, preserve lines, delete if empty); unit tests
- [x] 1.2 `openspec.ts` `hasOpenSpec` requires config, `changes/` or `specs/`; tests

## 2. Worker and panel

- [x] 2.1 Worker and protocol: `openspec.createStore`, `openspec.setStore`, `openspec.storeDefaults`; worker tests
- [x] 2.2 Panel: the Change store box (Switch, Unlink, New store) on store workspaces; New store on the not-set-up screen; the shared NewStoreForm with default folder
- [x] 2.3 Panel tests: create and link, switch, unlink, unsafe folder error, no control on local roots

## 3. Docs and verify

- [x] 3.1 README and CLAUDE.md
- [x] 3.2 `orca plugin test` and `check`; live with the user's go-ahead (creating a store writes a folder and a git repo)
