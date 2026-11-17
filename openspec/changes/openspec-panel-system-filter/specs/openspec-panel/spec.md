## ADDED Requirements

### Requirement: Filter store items by system
In a store-linked workspace, the panel SHALL offer a "This system / All" toggle, defaulting to This system. A workspace's system is a list of name prefixes, remembered per workspace and editable in the panel. The default list is the workspace-name words that match a known store prefix. A known prefix is the text before the first `-` in a change or spec name, shared by at least 3 store items. In This system mode, the Changes and Specs tabs SHALL list items whose prefix is in the list, then a "Shared" section with items whose prefix is not known; tab counts SHALL include only those. Workspaces without a store SHALL be unchanged.

#### Scenario: Default system from the workspace name
- **WHEN** the workspace "COLIN ECLAIMS" is linked to a store whose items include at least 3 named `eclaims-…`
- **THEN** its prefix list defaults to `eclaims`, and the Changes tab lists only the `eclaims-…` changes plus the Shared ones

#### Scenario: Shared items
- **WHEN** the store has a spec `access-control` and fewer than 3 items start with `access-`
- **THEN** in This system mode `access-control` appears under "Shared"

#### Scenario: Other systems hidden
- **WHEN** This system mode is on with prefixes `eclaims`
- **THEN** `ess-ldna-print` and `doh-…` items are not listed

#### Scenario: All mode
- **WHEN** the user switches the toggle to All
- **THEN** every store change and spec is listed, as before

#### Scenario: Edit the system
- **WHEN** the user sets the prefixes to `eclaims, ess`
- **THEN** items of both systems are listed, and the list is remembered for this workspace
