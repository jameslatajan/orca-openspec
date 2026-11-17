# Orca OpenSpec

An [Orca](https://github.com/stablyai/orca) plugin for [OpenSpec](https://github.com/Fission-AI/OpenSpec). It adds a sidebar panel that shows your workspace's OpenSpec changes and specs, and starts agents for each workflow step.

## Features

- **Changes tab:** every active change in `openspec/changes/` as a compact row with a status (Planning, Not started, In progress, Ready to archive), a progress bar and the checked/total task count from its `tasks.md`. You can filter by name, or use the All / In progress / Done chips.
- **Specs tab:** every capability under `openspec/specs/`, including nested ones such as `billing/invoices`, with a name filter.
- **Actions:**
  - **+** (New change) in the header starts an agent with `/opsx:propose`.
  - Selecting a change shows **Apply** and **Verify**. Once every task is done, **Archive** replaces Verify.
  - Apply, Verify and Archive start an agent in the current workspace with `/opsx:apply <change>`, `/opsx:verify <change>` or `/opsx:archive <change>`.
- **Palette commands:** `OpenSpec: New change`, `Apply change`, `Verify change`, `Archive change` and `Refresh panel`. Apply, Verify and Archive use the change selected in the panel, or the only change if there is just one.
- **Auto-refresh:** the panel updates about 300 ms after files in `openspec/` change, when you switch workspace, and when an agent the plugin started finishes.
- **Init OpenSpec:** in a workspace without an `openspec/` folder, a button opens a terminal running `openspec init`.

## Requirements

- Orca 1.4.248 or newer
- The [`openspec` CLI](https://github.com/Fission-AI/OpenSpec), for Init OpenSpec and for the `/opsx` commands your agent runs
- An agent with the OpenSpec skills or slash commands installed (default: `claude`)

## Install (development)

```sh
git clone https://github.com/jameslatajan/orca-openspec.git
cd orca-openspec
orca plugin dev watch ./plugin
```

The first load shows the access the plugin asks for and waits for your approval. Then open **OpenSpec** in Orca's right sidebar.

### Permissions

The plugin runs a Node worker with your user account's access. It asks for:

| Capability | Used for |
| --- | --- |
| `workspace:read` | Finding the focused workspace and its path |
| `agent:read` | Refreshing when a launched agent finishes |
| `agent:launch` | Starting `/opsx` agents |
| `terminal:send` | Running `openspec init` in a terminal |
| `notifications:show` | Telling you to select a change first |
| `storage:own`, `settings:own` | Remembering the selected change and the agent setting |

### Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| Agent | `claude` | Agent CLI launched for `/opsx` commands |

## Limitations

- Remote and SSH workspaces are not supported yet; the panel says so.
- OpenSpec stores (`--store`) are not read; only the workspace's own `openspec/` folder is.

## Develop

The plugin needs no build step: Orca transpiles the TypeScript when it loads. With `dev watch` running, saving a file reloads it.

```
plugin/
  orca-plugin.json     manifest: panel, commands, events, settings, capabilities
  src/worker.ts        reads openspec/, launches agents, watches for changes
  src/openspec.ts      parses changes, task checkboxes and specs (pure Node)
  src/watch.ts         recursive, debounced folder watcher
  src/panel.tsx        the sidebar panel (Orca components, TSX)
  src/protocol.ts      typed panel <-> worker requests and events
  src/*.test.ts(x)     tests
openspec/              this project's own OpenSpec specs and archived changes
```

```sh
cd plugin
orca plugin test .       # worker and panel tests
orca plugin check .      # validate the manifest and render the panel
orca plugin validate .
```

This plugin is itself built with OpenSpec: see `openspec/specs/openspec-panel/spec.md` for the requirements, and `openspec/changes/archive/` for the changes that produced it.
