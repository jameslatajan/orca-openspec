# Proposal

## Why

The board shows each change's name and progress, but not what the change is about. To read a proposal, design, task list or spec you have to leave the board and find the file yourself. Archived changes are not shown at all. The board should let you read a change's files and act on it in one place.

## What Changes

- **Cards:** each card also shows the first sentence of the proposal's Why and the change's date. It keeps the next unchecked task. Hovering a card shows quick actions for its column:
  - Planning and Not started: Apply.
  - In progress: Apply and Verify.
  - Ready to archive: Archive.
- **Archived column:** a fifth column lists `changes/archive/`, newest first. It starts collapsed and loads in batches of 40.
- **Change detail page:** clicking a card opens the change in the board tab:
  - a header with the name, status, progress, created date and the specs it touches;
  - actions: Apply, Verify, Explore, Open in editor and Archive;
  - file tabs grouped as Docs (proposal, design, tasks), Other (any other markdown in the change folder, such as `agent/*.md`) and Spec deltas;
  - the selected file shown as rendered markdown, with its path and an Edit link that opens it in Orca's editor;
  - a read-only checklist on the Tasks tab;
  - a side column with the workspace or store and the related changes (other changes with a delta for the same spec).
  
  Archived changes open read-only, with no agent actions.
- **Spec browsing:** the specs side list stays, now in a drawer opened from the header. Clicking a spec opens its detail page: the rendered `spec.md` and the changes (active and archived) that carry a delta for it.
- **Going back:** a Back button, a breadcrumb, clicking the title, and Esc all return to the board.
- **Confirmation:** Apply, Verify and Explore launch at once, as they do today. Archive, on a card or on the detail page, first shows a dialog with the command it will send. When tasks are unfinished, the dialog warns about them.
- **Removed:** selecting a card no longer shows an inline action bar; the hover actions and the detail page replace it.
- The sidebar panel does not change.

## Capabilities

### New Capabilities

### Modified Capabilities
- `openspec-panel`: The "Kanban board" requirement changes to cover:
  - the card content and its hover actions;
  - the Archived column;
  - the change and spec detail pages;
  - the specs drawer;
  - the Archive confirmation.

## Impact

- `board/main.ts`: new views (board, change detail, spec detail), a markdown renderer that only creates text nodes and elements, the archive dialog, Esc handling.
- `src/protocol.ts`: new requests `openspec.archived`, `openspec.changeFiles`, `openspec.readFile`, `openspec.openFile`, and a `summary`/`created` field on `ChangeInfo`.
- `src/openspec.ts`: reads archived changes, a change's file list, its spec deltas and the proposal summary.
- `src/worker.ts`: handlers for the new requests. File reads and opens are confined to the workspace's data root `openspec/` folder.
- `explore` launches can target a change (`/openspec-explore <change>`).
- Tests for the reader, the worker requests and path confinement.
