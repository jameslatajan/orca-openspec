## Context

The state already carries `store`, `changes` and `specs`. Store item names: 34 `doh-`, 26 `ess-`, 21 `eclaims-`, 19 `case-`, …, plus many one-off prefixes (`absences-page`, `access-control`). Workspace names look like "COLIN ECLAIMS", "CRH HRIS" and "CRH ESS".

## Decisions

- **Pure functions in `view.ts`:**
  - `prefixOf(name)` returns the text before the first `-`;
  - `knownPrefixes(names, min = 3)`;
  - `guessPrefixes(workspaceName, known)` matches lower-cased name words against `known`;
  - `splitBySystem(items, prefixes, known, nameOf)` returns `{ mine, shared }`.
- **Storage in the worker:**
  - `openspec.systemPrefixes` (get) and `openspec.setSystemPrefixes` (set) store `systemPrefixes:<workspaceId>` in plugin storage, keyed by the focused workspace;
  - get returns `null` when unset, and the panel then uses the guess.
- **Panel:**
  - `systemMode` atom (`persist: 'plugin'`, default `'system'`);
  - a two-button toolbar This system / All, plus a "System: eclaims ✎" line with an `Input` (comma-separated) to edit;
  - the lists render `mine`, then a "Shared" heading with `shared`;
  - shown only when `state.store` is set.
- **Empty guess:** "This system" shows only Shared items, and the edit line reads "System: not set". That prompts the user to set it.

## Risks / Trade-offs

- Prefix conventions are informal; a mis-named item lands in Shared or another system. Switching to All always shows everything.
