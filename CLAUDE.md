# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An Orca plugin (`plugin/`) that adds an OpenSpec sidebar panel: active changes with task progress, specs, and buttons/palette commands that launch agents with `/opsx:propose|apply|verify|archive`. The repo also tracks its own development with OpenSpec (`openspec/`).

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
- **Selected change** is a `persist: 'storage'` atom (`selectedChange`), so the worker's palette commands read the same value from `orca.storage`.
- **Worker state:** a worker save restarts it and drops in-memory state. Anything that must survive goes in `orca.storage`.

## Gotchas

- `engines.orca` must be ≥ the newest `Since` of anything used. It is `>=1.4.248` because a capability requires it, and `plugin check` fails if it is lower.
- Adding a capability, command or event changes the approval fingerprint. The user must re-approve the plugin (`orca plugin dev load ./plugin --approve <fingerprint>`), so never approve on their behalf. Code-only edits reload without approval.
- `<Progress value>` is 0–100, not 0–1.
- Panel-only UI state (tab, filters, chip) uses `persist: 'plugin'`. With `persist: 'storage'`, a controlled `Input` or a chip loses input to the storage echo: typing "AUTH" kept "A". Reserve `'storage'` for values the worker reads, such as `selectedChange`.
- Status and filter logic lives in `src/view.ts` (pure functions). Keep `panel.tsx` declarative.
- In panel tests, `view.find({ text })` matches the whole element text exactly, so use a RegExp for partial matches. Don't send `undefined` fields in request payloads, because `deepEqual` sees them.
- Worker tests run the real module with `mockHost({ results: {...} })` and `mountWorker`. Watcher tests set `main.options.watchDelayMs` low and count posts only after the edit, because startup emits extra posts.

## OpenSpec workflow

- Specs live in `openspec/specs/openspec-panel/spec.md`; completed changes are in `openspec/changes/archive/`.
- New features go through a change: propose → apply → archive. Delta specs use `## ADDED/MODIFIED Requirements` with `#### Scenario:` blocks.
- Validate with `openspec validate <change>` and `openspec validate --specs`.
- This repo uses git (`main`, remote `origin` on GitHub), not SVN.
