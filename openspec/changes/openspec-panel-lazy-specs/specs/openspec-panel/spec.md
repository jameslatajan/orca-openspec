## ADDED Requirements

### Requirement: Load specs in batches
The Specs tab SHALL show specs in a table that first draws at most 40 rows and draws 40 more each time the user scrolls near the last drawn row, until every matching spec is shown. The name filter and the This system / All toggle SHALL search all specs, and changing either SHALL start again from the first 40. The tab label SHALL keep the full count. In a store workspace's This system mode, each row SHALL show whether it belongs to this system or is shared.

#### Scenario: First batch
- **WHEN** the Specs tab holds 125 specs
- **THEN** 40 rows are drawn and the label still reads "Specs (125)"

#### Scenario: Scroll for more
- **WHEN** the user scrolls near the last of 40 drawn rows
- **THEN** 40 more rows are drawn, and loading stops once all 125 are shown

#### Scenario: Filter resets the batch
- **WHEN** the user types in the Specs filter
- **THEN** matches are found among all specs, and drawing restarts from the first 40 matches

#### Scenario: Shared specs in a store workspace
- **WHEN** This system mode is on
- **THEN** each spec row shows "This system" or "Shared"
