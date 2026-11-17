## ADDED Requirements

### Requirement: Follow OpenSpec stores
When the focused workspace's `openspec/config.yaml` (or `config.yml`) declares a top-level `store: <id>`, the panel SHALL read changes and specs from that store's `openspec/` folder instead of the workspace's, resolving `<id>` to a folder through `openspec store list --json`. The panel header SHALL show "via store <id>". Auto-refresh SHALL watch the store's `openspec/` folder. The store list SHALL be looked up once per plugin run and again when the user presses Refresh. Agent actions are unchanged: they still start in the focused workspace. Workspaces without a `store:` line SHALL behave as before.

#### Scenario: Workspace linked to a store
- **WHEN** `colin_eclaims/openspec/config.yaml` contains `store: isotech` and `isotech` is registered at `C:\wamp64\www\projects\openspec-store`
- **THEN** the panel lists the changes and specs under `C:\wamp64\www\projects\openspec-store\openspec` and shows "via store isotech"

#### Scenario: Unknown store
- **WHEN** the config declares `store: missing` and no store with that id is registered
- **THEN** the panel shows an error naming the store and the fix (`openspec store register <path>`)

#### Scenario: OpenSpec CLI unavailable
- **WHEN** the config declares a store and `openspec store list --json` cannot run
- **THEN** the panel shows an error saying the `openspec` CLI is needed to resolve stores

#### Scenario: Store edits refresh the panel
- **WHEN** a `tasks.md` in the store's `openspec/changes/` is saved with one more box checked
- **THEN** the panel shows the updated progress without pressing Refresh
