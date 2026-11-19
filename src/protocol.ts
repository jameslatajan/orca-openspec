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
    'openspec.openBoard': { input?: { change?: string }; output: { opened: boolean; message: string } }
    /** The change the board should open (from a double-click in the panel), cleared once read. */
    'openspec.takeFocus': { output: { change: string | null } }
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
    /** The exact prompt `openspec.launch` would type for this step and change (Command style aware). */
    'openspec.promptFor': { input: { step: OpsxStep; change: string }; output: { prompt: string } }
    /** A page of archived changes, newest first. */
    'openspec.archived': {
      input: { offset: number; limit: number; filter?: string }
      output: { items: ArchivedInfo[]; total: number }
    }
    /** A change's markdown files (paths relative to openspec/), touched specs and related changes. */
    'openspec.changeFiles': {
      input: { folder: string; archived: boolean }
      output: { info: ChangeInfo; files: ChangeFileInfo[]; specs: string[]; related: SpecUseInfo[] }
    }
    /** The changes (active and archived) that carry a delta for `spec`. */
    'openspec.specInfo': { input: { spec: string }; output: { changes: SpecUseInfo[] } }
    /** Reads a markdown file under openspec/ (path relative to it). */
    'openspec.readFile': { input: { path: string }; output: { text: string } }
    /** Opens a markdown file under openspec/ in a main-area editor tab. */
    'openspec.openFile': { input: { path: string }; output: { opened: boolean } }
  }
  interface PluginPanelEvents {
    /** Fresh state after a workspace switch, a launched agent finishing, or a refresh. */
    'openspec.changed': OpenSpecState
    /** Asks open panels to show the New change form (from the palette command). */
    'openspec.showForm': Record<string, never>
    /** Asks an open board to show this change's page (double-click in the panel). */
    'openspec.focusChange': { change: string }
  }
}

export type OpsxStep = 'explore' | 'propose' | 'apply' | 'verify' | 'archive'

export type ChangeInfo = {
  name: string
  done: number
  total: number | null
  /** The first unchecked task's text, when there is one (shown on the board). */
  next?: string
  /** The first sentence of proposal.md's Why section. */
  summary?: string
  /** YYYY-MM-DD: `created` from .openspec.yaml, or an archived folder's date prefix. */
  created?: string
}

/** An archived change; `folder` is the real folder name under changes/archive/. */
export type ArchivedInfo = ChangeInfo & { folder: string }

export type ChangeFileInfo = { path: string; group: 'docs' | 'other' | 'delta'; label: string }

/** A change that carries a delta for a spec. */
export type SpecUseInfo = { name: string; folder: string; archived: boolean }

export type OpenSpecState = {
  status: 'no-workspace' | 'no-openspec' | 'remote' | 'ok' | 'error'
  workspace?: string
  /** The OpenSpec store this workspace's config points to, when it uses one. */
  store?: string
  changes: ChangeInfo[]
  specs: string[]
  error?: string
}
