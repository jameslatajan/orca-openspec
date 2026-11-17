## Why

Pressing Refresh gave no visible reaction. When nothing had changed (for example, a workspace with every change archived), the user couldn't tell whether Refresh worked, and errors were swallowed.

## What Changes

- **While refreshing:** a spinner replaces the refresh button, for at least 500 ms.
- **After a refresh:** an "Updated <relative time>" line under the header.
- **On failure:** errors show in the panel.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `openspec-panel`: adds the requirement "Refresh feedback".

## Impact

- `plugin/src/panel.tsx` and `plugin/src/panel.test.tsx`. No worker or manifest changes.
