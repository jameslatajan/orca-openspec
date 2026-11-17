## 1. Watcher

- [x] 1.1 Add `plugin/src/watch.ts`: `watchFolder(path, onChange, delayMs = 300)` using recursive `fs.watch` with a trailing debounce, and an `error` handler that closes the watcher and reports the error
- [x] 1.2 Unit test: a burst of writes inside the folder calls `onChange` once (use a short delay)

## 2. Worker integration

- [x] 2.1 In `worker.ts`, add `retarget()`: watch only the focused local workspace with `openspec/`, skip when the path is unchanged, and close the old watcher otherwise; call it from `workspace.changed` and `refresh()`
- [x] 2.2 On a debounced change, post fresh state with `openspec.changed`; on a watch failure, `orca.log` it
- [x] 2.3 Export `deactivate()` that closes the watcher
- [x] 2.4 Worker test: in a temp fixture, tick a box in `tasks.md` and assert exactly one `openspec.changed` post with the updated progress

## 3. Verify

- [x] 3.1 `orca plugin test` and `orca plugin check` pass
- [x] 3.2 Live: with the panel open, tick a task in a `tasks.md` by hand and confirm the panel updates without Refresh
