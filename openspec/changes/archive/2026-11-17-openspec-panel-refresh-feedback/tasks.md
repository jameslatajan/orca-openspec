## 1. Implementation

- [x] 1.1 Panel: `refreshing` and `updatedAt` atoms; `reload()` with a 500 ms minimum spinner, error capture and timestamp
- [x] 1.2 Header shows a Spinner while refreshing; "Updated <RelativeTime>" line; posted state also updates the time
- [x] 1.3 Panel tests: the spinner appears then goes, the updated line, an error shown on failure

## 2. Verify

- [x] 2.1 `orca plugin test` and `check`; live: pressing Refresh shows the spinner and "Updated just now"
