# Design

## Context

- `board/main.ts` is plain DOM in a custom editor. It gets `OpenSpecState` from the worker (`openspec.state`, `openspec.changed`), and `ChangeInfo` holds only `name`, `done`, `total` and `next`.
- The worker reads from `dataRootOf()` (the workspace, or the linked store's root).
- `readChanges()` skips `archive/`.
- `editor.open` is already used by `openBoard()`, including the absolute-path fallback.
- The interactive mockup is in this chat's scratch folder (`openspec-board-mockup-c93.html`). It is the visual reference; implementation uses `--orca-*` variables, not the mockup's colors.

## Goals / Non-Goals

**Goals:**
- Read any markdown file of a change or spec without leaving the board.
- Keep `OpenSpecState` small: file contents and archived lists are fetched on demand.

**Non-Goals:**
- Full-text search across file contents (the mockup's "Enter searches all files"). The filter matches names and summaries only.
- Showing validation results or the last agent run in the side column.
- Editing in the board. Edit hands off to Orca's editor.
- Task-level apply. The tasks tab is read-only.
- Any sidebar panel change.

## Decisions

### On-demand requests instead of a bigger state
Four new requests are added:
- `openspec.archived {offset, limit, filter?}` returns `{items: ChangeInfo[], total}`.
- `openspec.changeFiles {change, archived}` returns `{files: {path, group}[], specs: string[], created?}`.
- `openspec.readFile {path}` returns `{text}`.
- `openspec.openFile {path}` returns `{opened}`.

`ChangeInfo` gains `summary?` and `created?`, since they are cheap and needed on every card.
- **Why:** a store can hold hundreds of archived changes (one has 476), and pushing them all on every `openspec.changed` would be wasteful.
- **Alternative:** one big state with everything. Rejected because of its size and the re-render cost.

### Related changes from a spec index
The worker builds a map from spec to changes by listing `changes/*/specs/**/spec.md` and `changes/archive/*/specs/**/spec.md` (directory walk only, no file reads). It caches the map until the next refresh or watcher event.
- `changeFiles` returns related changes from this map.
- The spec page's "Changed by" uses it too, through `openspec.specInfo {spec}` → `{changes: {name, archived}[]}`.

### Path confinement in the worker
`readFile` and `openFile` take a path relative to `openspec/`. The worker:
1. resolves the path against the data root's `openspec/`;
2. runs `realpath` on the result;
3. refuses anything whose real path doesn't start with the real `openspec/` path plus a separator;
4. allows only `.md` files.

This lives in a pure function in `src/openspec.ts`, so it is unit-tested on temp folders, including the `..` and symlink cases.

### Markdown rendering without innerHTML
The board gets a small renderer in `board/markdown.ts`. It covers:
- headings, paragraphs, lists, task boxes, code fences;
- inline code, bold and italics, links shown as text;
- `####`-scenario blocks with WHEN/THEN highlighting;
- tables as preformatted text.

It builds nodes with `el()` and `textContent` only.
- **Why:** custom editors can't use Orca components, a library would be a new dependency the CLI can't transpile from npm, and the text-only approach makes script injection impossible by construction.
- **Alternative:** a CDN markdown library plus a sanitizer. Rejected because of the extra trust surface.

### Views as a small router in the board
A module-level `view` value (`{kind:'board'} | {kind:'change', name, archived, tab} | {kind:'spec', name}`) drives `render()`. Board scroll position and filter are kept when going back. Esc closes the dialog first, then returns to the board.

### Archive confirmation is board-only
Archive opens the dialog; the confirm button calls the existing `openspec.launch` with `step: 'archive'`. Nothing changes in the worker's launch path. `explore` with a `change` sends the change name where the description would go.

### Summary and date
- **Summary:** the first sentence (up to `. ` or 160 characters) of the first paragraph under `## Why` in proposal.md.
- **`created`:** from `.openspec.yaml`'s `created:` line.
- **Archived date:** taken from the `YYYY-MM-DD-` folder prefix, which is stripped from the displayed name.

## Risks / Trade-offs

- [Large archives make the spec index slow] → The index is a directory walk only and is cached. It is rebuilt lazily on first use after a change event.
- [The markdown renderer misses some syntax] → Unknown blocks render as plain paragraphs, and Edit always gives the raw file.
- [The board isn't covered by the panel test kit] → Keep logic in pure functions (`src/openspec.ts`, `src/view.ts`, `board/markdown.ts`) with node tests, and check the views live with `orca plugin shot`.
- [New requests change the approval fingerprint?] → Requests don't change capabilities or commands, so no re-approval is expected. Check with `orca plugin check`.
