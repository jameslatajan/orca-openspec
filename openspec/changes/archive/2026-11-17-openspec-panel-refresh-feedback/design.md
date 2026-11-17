## Decisions

- **Panel atoms:** `refreshing` (boolean) and `updatedAt` (ms or null). `reload()` sets `refreshing`, awaits both the request and a 500 ms minimum, sets `updatedAt = Date.now()` on success or `actionError` on failure, then clears `refreshing`.
- **Header:** shows `<Spinner label="Refreshing" />` instead of the refresh `IconButton` while refreshing. Under the header, `<Text muted size="xs">Updated <RelativeTime at={updatedAt} /></Text>`; `RelativeTime` ticks by itself, so there's no polling.
- **Automatic reloads** (workspace switch, file watch) also set `updatedAt` when their posted state arrives, so the line stays truthful.
