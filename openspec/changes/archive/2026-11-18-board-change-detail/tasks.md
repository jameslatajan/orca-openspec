# Tasks

## 1. Reading OpenSpec files

- [x] 1.1 Add `summary` (first sentence of proposal.md's Why) and `created` (from `.openspec.yaml`) to `ChangeInfo` in `src/protocol.ts` and `readChanges()`; verify with new cases in `src/openspec.test.ts`
- [x] 1.2 Add `readArchived(root, offset, limit, filter?)`, newest first, with the date prefix split into `created` and stripped from the name; test ordering, paging and filtering on a temp folder
- [x] 1.3 Add `changeFiles(root, change, archived)` returning grouped markdown files (Docs / Other / Spec deltas) and touched specs; test with `agent/notes.md` and a nested `specs/billing/invoices/spec.md`
- [x] 1.4 Add a spec index (spec → active and archived changes) built from directory walks; test it lists both kinds
- [x] 1.5 Add `resolveInside(openspecDir, rel)` that resolves with realpath and allows only `.md` inside `openspec/`; test `..`, absolute paths, a symlink out and a non-`.md` file are refused

## 2. Worker requests

- [x] 2.1 Declare `openspec.archived`, `openspec.changeFiles`, `openspec.specInfo`, `openspec.readFile`, `openspec.openFile` in `src/protocol.ts`
- [x] 2.2 Implement them in `src/worker.ts` against `dataRootOf()`, caching the spec index until refresh or a watcher event; `openFile` uses `editor.open` with the same relative/absolute fallback as `openBoard()`; test with `mountWorker` and `mockHost`
- [x] 2.3 Let `openspec.launch` with `step: 'explore'` and a `change` send `/openspec-explore <change>` (or `/opsx:explore <change>`); test both command styles in the worker tests
- [x] 2.4 Run `orca plugin check .` and confirm no new approval fingerprint is required

## 3. Markdown renderer

- [x] 3.1 Create `board/markdown.ts` producing DOM from markdown with text nodes only (headings, paragraphs, lists, task boxes, code, bold/italic, inline code, WHEN/THEN scenarios); test with a DOM shim that `<script>` text stays literal and structure matches

## 4. Board views

- [x] 4.1 Add the view router (board / change / spec) and the Back button, breadcrumb, title click and Esc; keep filter and scroll on return
- [x] 4.2 Board: five columns with Archived collapsed and paged by 40; cards show summary, progress bar, date and next task; hover quick actions per column
- [x] 4.3 Header: workspace and "via store", filter (name + summary), New change, Specs, Refresh; move the specs list into a drawer keeping its filter and batches of 40
- [x] 4.4 Change detail page: header, actions (Apply/Verify/Explore launch at once; Open in editor; Archive), grouped file tabs, path bar with Edit, rendered file, read-only tasks checklist, side column with workspace and related changes; archived changes read-only
- [x] 4.5 Spec detail page: rendered spec.md, Edit, and "Changed by" list linking to change pages
- [x] 4.6 Archive dialog on cards and the detail page: shows the command, warns about unfinished tasks, only Confirm launches; Esc/Cancel/outside click close it
- [ ] 4.7 Style everything with `--orca-*` variables and check light and dark themes

## 5. Verification

- [x] 5.1 `orca plugin test .` passes
- [x] 5.2 `openspec validate board-change-detail` and `openspec validate --specs` pass
- [x] 5.3 Check live with `orca plugin shot <key> --editor openspec/board.openspec` in this repo: board, change detail, spec detail and the archive dialog (cancel only — do not confirm an archive on a real project)
- [x] 5.4 Confirm the sidebar panel is unchanged (`orca plugin check .` scenarios still pass)

## Workflow follow-up

- Archive the change with `/openspec-archive-change board-change-detail` after verification.
