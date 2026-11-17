## Context

`openspec store list --json` returns `{stores:[{id, root}]}`; on this machine that is `isotech → C:\wamp64\www\projects\openspec-store`. A linked workspace has `openspec/config.yaml` with a top-level `store: isotech` line. The worker is a trusted Node process and already uses `node:fs`. `readChanges(root)` and `readSpecs(root)` take a folder containing `openspec/`.

## Goals / Non-Goals

**Goals:** a correct panel in store-linked workspaces, live updates, and clear errors.
**Non-Goals:** filtering store changes per project; `--store` handling in agent prompts; the global `defaultStore`.

## Decisions

- **`store.ts`:**
  - `storeIdFrom(configText)` parses a top-level `store:` line, ignoring comments and surrounding quotes. No YAML library is needed because the key is a single scalar.
  - `resolveStore(id, run)` uses an injectable runner (`execFile('openspec', ['store','list','--json'])` with `shell: true` on Windows, so `openspec.cmd` resolves), caches the parsed list, and exposes `clearStoreCache()` for Refresh.
- **Data root:** `readState` computes `dataRoot = storeRoot ?? workspacePath`. The existing readers and `hasOpenSpec` run against `dataRoot`, so a store without `openspec/` reports `no-openspec`. `retarget()` watches `join(dataRoot, 'openspec')`.
- **Errors:**
  - an unknown id gives status `error` with `Store "<id>" is not registered on this machine. Run \`openspec store register <path>\`.`;
  - a runner failure gives `The openspec CLI is needed to resolve store "<id>"`, plus its message.
- **State:** `store?: string`. The panel shows a `Badge` "via store <id>" under the header.

## Risks / Trade-offs

- A shared store shows every project's changes. The user chose this; the badge makes it clear.
- The first panel load in a store workspace pays one CLI call (about 1 s); later loads use the cache.
