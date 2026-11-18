## Context

- Custom editors are plain DOM pages: no Orca components. Ours declares `"frame": "isolated"`, so it runs only in the desktop app.
- The page gets a global `orca` with `plugin.request` / `plugin.on` (the same worker bridge as the panel), `storage`, `settings`, the `theme` event, and `--orca-*` CSS variables.
- The worker's `editor.open({ workspaceId, path })` opens a workspace file in a tab.

## Decisions

- **The file is only an anchor.** `board.openspec` holds a one-line comment, and the board never edits it. It still calls `orca.document.session()`, so Orca knows the editor loaded.
- **Shared logic:** `board/main.ts` imports `../src/view.ts` (status, system filter, batches) by relative path, so the board and panel classify changes identically.
- **Rendering:** a small `render(state)` that rebuilds the columns. With ≤ ~50 changes that's cheap. The spec list appends 40 rows at a time, triggered by an `IntersectionObserver` on a sentinel.
- **Theme:** colours come only from `--orca-*` variables, plus fixed status hues for the column dots and rings, chosen to work on both themes.
- **Next task:** `readChanges` adds `next?: string`, the text of the first unchecked task in `tasks.md`. `ChangeInfo` gains the optional field, and the panel ignores it.
- **Worker:**
  - the `openspec.openBoard` request and the `openspec.openBoard` palette command share one function;
  - the board file is written with `wx`, so an existing one is kept;
  - the `.gitignore` line is appended only if absent;
  - `editor.open` gets the workspace-relative path `openspec/board.openspec`, and falls back to the absolute path if Orca refuses it.
- **System mode on the board:** stored in plugin storage as `boardSystemMode`, separate from the panel's.

## Risks / Trade-offs

- **Testing:** the DOM board isn't covered by `orca plugin test`'s panel kit. Logic stays in `view.ts` (tested), and the board is checked with `orca plugin shot --editor` plus a live check.
