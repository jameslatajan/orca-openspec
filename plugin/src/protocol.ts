// The panel <-> worker contract, declared once: src/panel.tsx and src/worker.ts both read it.
export {}

declare module 'orca' {
  interface PluginRequests {
    /** OpenSpec state of the focused workspace. */
    'openspec.state': { output: OpenSpecState }
    /** Launches an agent with `/opsx:<step> [change]` in the focused workspace. */
    'openspec.launch': { input: { step: OpsxStep; change?: string }; output: { terminalId: string } }
    /** Opens a terminal running `openspec init` in the focused workspace. */
    'openspec.init': { output: { terminalId: string } }
  }
  interface PluginPanelEvents {
    /** Fresh state after a workspace switch, a launched agent finishing, or a refresh. */
    'openspec.changed': OpenSpecState
  }
}

export type OpsxStep = 'propose' | 'apply' | 'verify' | 'archive'

export type ChangeInfo = { name: string; done: number; total: number | null }

export type OpenSpecState = {
  status: 'no-workspace' | 'no-openspec' | 'remote' | 'ok' | 'error'
  workspace?: string
  changes: ChangeInfo[]
  specs: string[]
  error?: string
}
