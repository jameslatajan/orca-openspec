## Decisions

- **Orca `Table`:** `hasMore` and `onLoadMore` are its built-in lazy loading. Lists have no equivalent.
  - columns: `name`, plus `group` in This system mode;
  - `rows` = the first `specLimit` of the filtered specs;
  - `hasMore = limit < total`;
  - `onLoadMore` raises `specLimit` by 40.
- **`specLimit`:** a panel atom, reset to 40 whenever the spec filter, mode or workspace changes. The reset happens in the handlers that change them, never during render.
- **View helper:** `firstBatch(items, limit)` returns `{ rows, hasMore }`, with unit tests.
- **Height:** `maxHeight` keeps the table scrolling inside the panel. The value comes from the typings.
