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
    /** Opens a terminal running `openspec init` in the focused workspace. */
    'openspec.init': { output: { terminalId: string } }
  }
  interface PluginPanelEvents {
    /** Fresh state after a workspace switch, a launched agent finishing, or a refresh. */
    'openspec.changed': OpenSpecState
    /** Asks open panels to show the New change form (from the palette command). */
    'openspec.showForm': Record<string, never>
  }
}

export type OpsxStep = 'explore' | 'propose' | 'apply' | 'verify' | 'archive'

export type ChangeInfo = { name: string; done: number; total: number | null }

export type OpenSpecState = {
  status: 'no-workspace' | 'no-openspec' | 'remote' | 'ok' | 'error'
  workspace?: string
  /** The OpenSpec store this workspace's config points to, when it uses one. */
  store?: string
  changes: ChangeInfo[]
  specs: string[]
  error?: string
}
