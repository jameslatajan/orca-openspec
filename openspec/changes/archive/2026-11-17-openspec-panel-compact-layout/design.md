## Context

`plugin/src/panel.tsx` is a components panel: no DOM or CSS, only Orca components. From the typings:
- `Tabs`/`Tab` take a value plus onChange;
- `Input` takes label/onChange;
- `Toolbar`, `Button` (variant, tone, icon), `IconButton` (icon, label);
- `ListItem` takes title, description, current and onPress, and its children render under the row;
- `Progress` uses a 0–100 value;
- `Box`, `Badge`.

There is no circular progress and no menu component. The worker already sends `{status, workspace, changes:[{name,done,total|null}], specs}`. Everything new can be derived in the panel.

## Goals / Non-Goals

**Goals:** Layout B with the components available, all state that can be derived computed in the panel, and test coverage for each requirement.

**Non-Goals:**
- next-task text, requirement counts, the "Changing" tag and "Open files" (later changes);
- worker, manifest or capability changes.

## Decisions

- **Pure helper `src/view.ts`:** `statusOf(change)`, `matchesChip(change, chip)` and `filterByName(items, text)`. These are easy to unit-test and keep `panel.tsx` declarative.
- **Persisted atoms:** `tab`, `changeFilter`, `specFilter` and `chip` use `persist: 'storage'`, like `selectedChange`.
- **Rows:** `ListItem` with title = name, description = `"<status> · <done>/<total>"`, and a labelHidden `Progress` child when `total > 0`, so a row is one press target.
- **Action bar:** a `Box` after the list, rendered only when the selection matches a visible change. It holds the name, Apply (solid) and a second button: Verify, or Archive (tone `success`) when the change is ready.
- **Header:** `Heading` with the workspace name, plus `IconButton`s `add` (New change) and `refresh`. Both are icon-only, so the header fits at about 260 px.
- **Status tones:** shown in text only (rows have no badge slot), to keep rows compact and avoid colour-only meaning.

## Risks / Trade-offs

- A progress bar replaces the ring, and a conditional button replaces the "···" menu. Both are accepted by the user.
- A persisted filter can hide changes the user expects to see. The tab label always shows the total count, and an empty filtered list says "No matching changes".
