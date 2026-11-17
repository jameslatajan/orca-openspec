## 1. Store and worker

- [x] 1.1 `store.ts`: `listStores`, and `writeStoreLink` (exclusive create, id validated against registered stores); unit tests
- [x] 1.2 Worker and protocol: the `openspec.stores` and `openspec.linkStore` requests (refuse remote workspaces; retarget and post after linking); worker tests

## 2. Panel

- [x] 2.1 No-openspec screen: store Select plus Link store, or the "no stores registered" hint; errors shown
- [x] 2.2 Panel tests: link flow, no-stores hint, error on an existing config

## 3. Docs and verify

- [x] 3.1 README and CLAUDE.md
- [ ] 3.2 `orca plugin test` and `check`; live in HIS COLIN only with the user's go-ahead (it writes a file into that project)
