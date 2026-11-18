## Decisions

- **`store.ts` additions:**
  - `createStore(id, folder, run)` validates the id (`STORE_ID`) and the folder (no `"&|<>^%` or line breaks; must be absolute), then runs `openspec store setup "<id>" --path "<folder>" --json` through `exec`, as one string with quoted, validated arguments. Afterwards it clears the store cache.
  - `setStoreLine(workspacePath, id | null)` rewrites or removes the top-level `store:` line in `config.yaml` / `config.yml`, preserving every other line and the file's line endings, and deletes the file when only blank lines and comments remain. Switching requires the id to be registered.
  - The exec runner is injectable (`options.storeSetupRunner`) for tests.
- **`hasOpenSpec(root)`** becomes true only when `openspec/` has a config file, `changes/` or `specs/`. The board file and `.gitignore` alone no longer count.
- **Worker requests:**
  - `openspec.createStore { id, folder, link: boolean }`;
  - `openspec.setStore { store: string | null }`, which refuses when the workspace has no `store:` line (local roots);
  - `openspec.storeDefaults` returns `{ parent }`, the parent folder of the workspace, so the panel can prefill `openspec-<id>`.
  - Each request refreshes afterwards.
- **Panel:**
  - the store badge row gets a small "Change" button that toggles a box with a store Select, **Switch**, **Unlink** and **+ New store**;
  - the "not set up" screen adds **+ New store** under Link store;
  - one shared `NewStoreForm` takes the id (Input), the folder (Input, prefilled) and **Create**.

## Risks / Trade-offs

- `store setup` takes a few seconds (git init and a commit). The form shows a busy state.
- Unlink deletes `config.yaml` when it held only the store line. That is the inverse of Link store, which created it.
