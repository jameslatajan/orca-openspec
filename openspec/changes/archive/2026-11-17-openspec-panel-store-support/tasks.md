## 1. Store resolution

- [x] 1.1 `plugin/src/store.ts`: `storeIdFrom`, `resolveStore` with an injectable runner and cache, `clearStoreCache`
- [x] 1.2 Unit tests: store line with quotes, comments, absent or nested keys; resolve hit, unknown id, runner failure, cache reuse

## 2. Worker and panel

- [x] 2.1 `readState` reads config.yaml/config.yml, resolves the store, uses the data root, and sets `state.store`; maps errors to messages
- [x] 2.2 `retarget` watches the data root's `openspec/`; Refresh clears the store cache
- [x] 2.3 Protocol `store?: string`; panel "via store <id>" badge
- [x] 2.4 Worker tests with a fixture store and a fake runner (state, unknown-store error, watcher refresh from a store edit); panel badge test

## 3. Docs and verify

- [x] 3.1 README (store support) and CLAUDE.md
- [x] 3.2 `orca plugin test` and `check`; live in acme-claims: the panel lists the teamstore store's changes with the badge
