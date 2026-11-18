# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An Orca plugin (`plugin/`) that adds an OpenSpec sidebar panel: active changes with task progress, specs, and buttons/palette commands that launch agents with the OpenSpec commands (`/openspec-propose`, `/openspec-apply-change`, …, or `/opsx:*` via the Command style setting). The repo also tracks its own development with OpenSpec (`openspec/`).

## Commands

Run these from `plugin/`. There is no build step and no package install: Orca transpiles the TypeScript and TSX when it loads them.

```sh
orca plugin test .        # all *.test.ts(x) via node:test; no per-test filter, so run the whole suite
orca plugin check .       # validate the manifest, render the panel per src/panel.check.ts scenario
orca plugin validate .
orca plugin types .       # regenerate .orca/types (gitignored) after an Orca update
orca plugin dev watch .   # load into the running Orca app, stream logs and reloads (blocks; Ctrl-C)
orca plugin logs local.openspec
orca plugin open local.openspec --panel openspec
```

Screenshot the live panel: `timeout 25 orca plugin dev watch ./plugin --shot <dir> --shot-panel openspec`.

The authoritative plugin API reference ships with the CLI. Read it instead of guessing:
- `orca skills get orca-plugin-authoring`
- `orca skills get orca-plugin-authoring --reference <host-api|manifest|recipes|cli|workflow>`
- the typings in `plugin/.orca/types/`

## Architecture

- **Panel ↔ worker split.**
  - `src/panel.tsx` is a components panel: no DOM and no hooks; state lives in `atom`s. It can't touch the filesystem or launch agents; it only calls `plugin.request(...)`.
  - `src/worker.ts` (the manifest `main`, `trusted-worker`) answers with `orca.panels.handle` and pushes `openspec.changed` with `orca.panels.post`.
  - Every request and event name and its payload is declared once in `src/protocol.ts` by augmenting the `orca` module. Add new messages there first.
- **Reading OpenSpec.**
  - `src/openspec.ts` is pure Node `fs` and parses `openspec/changes/*/tasks.md` (skipping `archive/`) and nested `openspec/specs/**/spec.md`. Only `- [x]`/`[X]` counts as done, matching the OpenSpec CLI.
  - The workspace path comes from `workspace.readContext()` → `workspace.list()`. Remote workspaces (`hostId` not `local`) are reported as `remote` and never read.
- **Refresh triggers**, all in the worker:
  - `workspace.changed` and `agent.status.changed` (`done`, for terminals the plugin launched);
  - the Refresh button;
  - a debounced recursive `fs.watch` on `openspec/` (`src/watch.ts`).
  `retarget()` keeps one module-level watcher and skips a retarget when the path is unchanged; `deactivate()` closes it.
- **Stores:** `src/store.ts` reads a top-level `store: <id>` from the workspace's `openspec/config.yaml`, then resolves it with `openspec store list --json`. The listing is cached; only the Refresh button and the palette Refresh clear it, because `workspace.changed` fires on every terminal open or close. `dataRootOf()` returns the store root or the workspace, and both reading and watching use it. Tests inject `options.storeRunner`.
- **Board tab:** Orca places plugin panels only in the right sidebar, so the board is a custom editor for `*.openspec`.
  - `board/main.ts` is plain DOM: editors get no Orca components. It talks to the worker through `orca.plugin.request` / `orca.plugin.on`, and is styled with `--orca-*` CSS variables.
  - It imports `../src/view.ts`, so it classifies changes exactly as the panel does.
  - `openBoard()` in the worker requires `openspec/`, creates `openspec/board.openspec` (with `wx`), adds it to `openspec/.gitignore` once, then calls `editor.open`.
  - The board isn't covered by the panel test kit, so check it live, or with `orca plugin shot <key> --editor <file>`.
- **Creating and changing stores:**
  - `createStore()` validates the id (`STORE_ID`) and the folder: absolute, new, and free of shell metacharacters. It then runs `openspec store setup "<id>" --path "<folder>" --json` through the injectable `options.storeSetupRunner`.
  - `setStoreLine()` rewrites or removes only the top-level `store:` line, keeps the file's line endings, and deletes a config left empty. It refuses local roots (no `store:` line).
  - `hasOpenSpec()` needs a config, `changes/` or `specs/` in `openspec/`, so a lone board file doesn't count as set up.
- **Linking a store:** the OpenSpec CLI has no link command, so `writeStoreLink()` in `store.ts` creates `openspec/config.yaml` itself.
  - It checks the id against `^[A-Za-z0-9._-]+$` and the registered stores, then writes with the `wx` flag. It refuses when `config.yaml` or `config.yml` exists.
  - Worker requests: `openspec.stores` (clears the cache first) and `openspec.linkStore`, which writes the file, then calls `refresh()`.
- **System filter (store workspaces):** OpenSpec records no project membership, so the panel filters by name prefix.
  - `view.ts`: `prefixOf`, `knownPrefixes` (a prefix shared by ≥3 items), `guessPrefixes` (from the workspace name) and `splitBySystem` (into `mine` and `shared`; other systems are dropped).
  - The worker stores each workspace's list under `systemPrefixes:<workspaceId>`.
  - `systemMode` (`persist: 'plugin'`) switches between This system and All.
- **Selected change** is a `persist: 'storage'` atom (`selectedChange`), so the worker's palette commands read the same value from `orca.storage`.
- **Worker state:** a worker save restarts it and drops in-memory state. Anything that must survive goes in `orca.storage`.

## Gotchas

- `engines.orca` must be ≥ the newest `Since` of anything used. It is `>=1.4.248` because a capability requires it, and `plugin check` fails if it is lower.
- Adding a capability, command or event changes the approval fingerprint. The user must re-approve the plugin (`orca plugin dev load ./plugin --approve <fingerprint>`), so never approve on their behalf. Code-only edits reload without approval.
- Every worker request acts on Orca's *focused* workspace, and focus can move between CLI calls. Never drive write requests (`setStore`, `linkStore`, `createStore`, `openBoard`) with `orca plugin dev request` against real projects: one such unlink hit the wrong project. Test writes with unit tests on temp folders, or have the user click in the panel of the workspace they're looking at.
- After changing `orca-plugin.json` (commands, editors, events), run `orca plugin dev reload ./plugin`. `dev load` can report `ok` while Orca keeps the old manifest. A command the worker registers but the old manifest lacks makes Orca drop events, shown in `orca plugin logs` as "registered undeclared command".
- `<Progress value>` is 0–100, not 0–1.
- After a panel test waits on a timer (for example the Refresh spinner's 500 ms minimum), call `await view.settled()` before `find`; otherwise the view still shows the old render.
- A `<Select>` option with value `''` makes the Select silently not render; use a real value such as `'default'`.
- Unkeyed form atoms live at module level, so they carry over between panel tests. Set the agent explicitly in a test instead of relying on the default.
- Never pass `prompt` to `agent.launch`. In practice the agent starts as an *orphaned* background terminal (no pane; check with `orca terminal list --worktree <id>`) and the prompt never arrives. `launchVisible()` launches without a prompt, calls `terminal.focus`, polls `terminal.read` until `isAgentReady()` sees an input marker (`❯`, `>`, `›`) on a stable screen, then calls `terminal.sendText`. Timings live in `options`, so tests shorten them.
- Agent prompts come from `promptFor()` in `worker.ts` and follow the `commandStyle` setting. The default `skill` sends `/openspec-apply-change <change>` and so on. Bare `/opsx:*` commands don't exist on a default install: the agent opens and silently does nothing.
- Panel-only UI state (tab, filters, chip) uses `persist: 'plugin'`. With `persist: 'storage'`, a controlled `Input` or a chip loses input to the storage echo: typing "AUTH" kept "A". Reserve `'storage'` for values the worker reads, such as `selectedChange`.
- Status and filter logic lives in `src/view.ts` (pure functions). Keep `panel.tsx` declarative.
- The Specs tab is a `Table` with `hasMore`/`onLoadMore`. `specLimit` grows by `BATCH` (40) and is reset in the handlers that change the filter, the mode or the workspace, never during render. In tests, use `view.rowsOf`, `view.columnsOf` and `view.loadMore`; table cells aren't found by `find({ text })`.
- In panel tests, `view.find({ text })` matches the whole element text exactly, so use a RegExp for partial matches. Don't send `undefined` fields in request payloads, because `deepEqual` sees them.
- Worker tests run the real module with `mockHost({ results: {...} })` and `mountWorker`. Watcher tests set `main.options.watchDelayMs` low and count posts only after the edit, because startup emits extra posts.

## OpenSpec workflow

- Specs live in `openspec/specs/openspec-panel/spec.md`; completed changes are in `openspec/changes/archive/`.
- New features go through a change: propose → apply → archive. Delta specs use `## ADDED/MODIFIED Requirements` with `#### Scenario:` blocks.
- Validate with `openspec validate <change>` and `openspec validate --specs`.
- This repo uses git (`main`, remote `origin` on GitHub), not SVN.
