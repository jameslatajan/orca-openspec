# OpenSpec plugin for Orca

A sidebar panel that shows a workspace's OpenSpec changes and specs and launches `/opsx` agents. See the [repository README](../README.md) for features, install, permissions and settings.

## Develop

```sh
orca plugin dev watch .   # load into Orca, stream logs and reloads; Ctrl-C unloads
orca plugin test .        # src/*.test.ts(x)
orca plugin check .       # manifest + panel render
```

The panel (`src/panel.tsx`) asks the worker (`src/worker.ts`) for state with `plugin.request`. The worker reads `openspec/` from disk (`src/openspec.ts`), watches it (`src/watch.ts`), and pushes updates with `orca.panels.post`. `src/protocol.ts` types both sides.
