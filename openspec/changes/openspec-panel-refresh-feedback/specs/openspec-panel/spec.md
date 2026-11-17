## ADDED Requirements

### Requirement: Refresh feedback
Pressing Refresh SHALL show a spinning indicator in place of the refresh button for at least 500 ms and until the reload finishes. After a successful reload, the panel SHALL show when it was last updated as a relative time that keeps ticking. If the reload fails, the panel SHALL show the error.

#### Scenario: Refresh shows activity
- **WHEN** the user presses Refresh
- **THEN** a spinner replaces the refresh button until the reload finishes (at least 500 ms), then the button returns

#### Scenario: Last updated time
- **WHEN** a refresh completes
- **THEN** the panel shows "Updated" with a relative time such as "just now"

#### Scenario: Refresh fails
- **WHEN** the reload request fails
- **THEN** the panel shows the error message and the refresh button returns
