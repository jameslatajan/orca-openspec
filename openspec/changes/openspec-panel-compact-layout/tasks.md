## 1. View logic

- [x] 1.1 Add `plugin/src/view.ts`: `statusOf`, `matchesChip` and case-insensitive `filterByName`
- [x] 1.2 Unit tests for each status, each chip, and name filtering

## 2. Panel

- [x] 2.1 New header: workspace name with IconButtons New change and Refresh; use it in every state
- [x] 2.2 Tabs "Changes (n)" / "Specs (n)" with persisted `tab`
- [x] 2.3 Changes tab: filter Input, chip Toolbar, ListItem rows (status · x/y, Progress child), and a "No matching changes" line
- [x] 2.4 Action bar for the selected change: Apply plus Verify, or Archive when ready
- [x] 2.5 Specs tab: filter Input and spec rows
- [x] 2.6 Persist the filter text and chip; keep empty, no-workspace, remote and error behaviour

## 3. Tests and verify

- [x] 3.1 Rewrite `panel.test.tsx`: tabs, chip and name filters, status text, action bar, Archive visibility, the init state and posted updates
- [x] 3.2 `orca plugin test`, `orca plugin check`, and a live screenshot of the panel in Orca
