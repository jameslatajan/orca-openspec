## Decisions

- **`store.ts`:**
  - `listStores(run)` returns `{ id, root }[]` from the cached `openspec store list --json`, refactored out of `resolveStore`;
  - `writeStoreLink(workspacePath, id)` creates `openspec/` if needed and writes `config.yaml` with the `wx` flag (exclusive create), so an existing file is never touched. It also refuses when `config.yml` exists;
  - the id must match `^[A-Za-z0-9._-]+$` and be in the registered list, so nothing else can be written.
- **Worker requests:**
  - `openspec.stores` returns `{ stores: { id }[] }`;
  - `openspec.linkStore { store }` resolves the focused workspace, refuses remote workspaces, writes the link, then retargets the watcher and posts fresh state.
- **Panel:** the no-openspec screen loads the stores once when shown, then renders a Select (default: the first store) plus **Link store**. With no stores, it shows a muted line with the register command.
- **After linking:** the system filter applies automatically, with prefixes guessed from the workspace name.

## Risks / Trade-offs

- The new file appears as untracked in the project's git; the user decides whether to commit it.
