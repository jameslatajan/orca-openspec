## Decisions

- **Status dropdown:** a `Select` (label "Status", hidden; options all / active / done) in a `Row` with the filter `Input`. It is bound to the existing persisted `chip` atom, so a saved choice carries over.
- **Scope dropdown:** a `Select` labelled "Scope", bound to `systemMode`. Its options are `{system: <prefixes joined> or "This system (not set)"}` and `{all: "All systems"}`. Changing it resets `specLimit`, as the toggle did.
- **Edit system** moves into the Change store box as a small section (Input plus Save), reusing `systemDraft` / `saveSystem`. The box opens from the badge pencil, so its label becomes "Store settings".
- **Updated time:** `UpdatedLine` is removed. The refresh `IconButton` gets `tooltip={"Updated " + time}`, formatted with `toLocaleTimeString` when `updatedAt` changes.
