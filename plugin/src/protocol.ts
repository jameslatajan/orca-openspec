// The panel <-> worker contract, declared once: src/panel.tsx and src/worker.ts both read it.
export {}

declare module 'orca' {
  interface PluginRequests {
    /** OpenSpec state of the focused workspace. */
    'openspec.state': { output: OpenSpecState }
    /** Like `openspec.state`, but first forgets the cached store list (the Refresh button). */
    'openspec.refresh': { output: OpenSpecState }
    /** Launches an agent in the focused workspace and types the OpenSpec command for `step`. */
    'openspec.launch': {
      input: { step: OpsxStep; change?: string; description?: string; agent?: string; model?: string }
      output: { terminalId: string }
    }
    /** The agent kinds the New change form offers, the default first. */
    'openspec.agents': { output: { agents: string[]; defaultAgent: string } }
    /** The focused workspace's saved system prefixes, or null when it has none yet. */
    'openspec.systemPrefixes': { output: { prefixes: string[] | null } }
    /** Saves the focused workspace's system prefixes. */
    'openspec.setSystemPrefixes': { input: { prefixes: string[] }; output: { prefixes: string[] } }
    /** Opens a terminal running `openspec init` in the focused workspace. */
    'openspec.init': { output: { terminalId: string } }
    /** Creates openspec/board.openspec if needed and opens the board in a main editor tab. */
    'openspec.openBoard': { output: { opened: boolean; message: string } }
    /** The OpenSpec stores registered on this machine. */
    'openspec.stores': { output: { stores: { id: string }[] } }
    /** Links the focused workspace to a store (creates openspec/config.yaml) and answers fresh state. */
    'openspec.linkStore': { input: { store: string }; output: OpenSpecState }
    /** The focused workspace's parent folder, for the new-store folder default. */
    'openspec.storeDefaults': { output: { parent: string } }
    /** Switches a store-linked workspace to `store`, or unlinks it with `null`. */
    'openspec.setStore': { input: { store: string | null }; output: OpenSpecState }
    /** Creates and registers a store; with `link`, links or switches the workspace to it. */
    'openspec.createStore': { input: { id: string; folder: string; link: boolean }; output: OpenSpecState }
  }
  interface PluginPanelEvents {
    /** Fresh state after a workspace switch, a launched agent finishing, or a refresh. */
    'openspec.changed': OpenSpecState
    /** Asks open panels to show the New change form (from the palette command). */
    'openspec.showForm': Record<string, never>
  }
}

export type OpsxStep = 'explore' | 'propose' | 'apply' | 'verify' | 'archive'

export type ChangeInfo = {
  name: string
  done: number
  total: number | null
  /** The first unchecked task's text, when there is one (shown on the board). */
  next?: string
}

export type OpenSpecState = {
  status: 'no-workspace' | 'no-openspec' | 'remote' | 'ok' | 'error'
  workspace?: string
  /** The OpenSpec store this workspace's config points to, when it uses one. */
  store?: string
  changes: ChangeInfo[]
  specs: string[]
  error?: string
}
