// The plugin's worker: reads openspec/ for the focused workspace and launches /opsx agents.
import type { OrcaWorkerApi } from 'orca/worker'
import { hasOpenSpec, readChanges, readSpecs } from './openspec'
import type { OpenSpecState, OpsxStep } from './protocol'
import { watchFolder, type FolderWatch } from './watch'
import { join } from 'node:path'

/** The live watcher on the focused workspace's openspec/ folder, if any. */
let current: FolderWatch | null = null
/** Debounce for file events; tests shorten it. */
export const options = { watchDelayMs: 300 }

function stopWatching(): void {
  current?.close()
  current = null
}

export function deactivate(): void {
  stopWatching()
}

const SELECTED = 'selectedChange'

type Focus = { workspaceId: string; path: string; hostId: string | null; name: string }

async function focused(orca: OrcaWorkerApi): Promise<Focus | null> {
  const ctx = await orca.host.call('workspace.readContext')
  if (!ctx?.workspaceId) return null
  const { workspaces } = await orca.host.call('workspace.list')
  const row = workspaces.find((w) => w.id === ctx.workspaceId)
  if (!row) return null
  return { workspaceId: row.id, path: row.path, hostId: row.hostId, name: ctx.displayName }
}

export async function readState(orca: OrcaWorkerApi): Promise<OpenSpecState> {
  const empty = { changes: [], specs: [] }
  try {
    const ws = await focused(orca)
    if (!ws) return { status: 'no-workspace', ...empty }
    if (ws.hostId && ws.hostId !== 'local') return { status: 'remote', workspace: ws.name, ...empty }
    if (!hasOpenSpec(ws.path)) return { status: 'no-openspec', workspace: ws.name, ...empty }
    return { status: 'ok', workspace: ws.name, changes: readChanges(ws.path), specs: readSpecs(ws.path) }
  } catch (err) {
    return { status: 'error', ...empty, error: err instanceof Error ? err.message : String(err) }
  }
}

export type CommandStyle = 'skill' | 'opsx'

/** OpenSpec skill command names, as `openspec init` installs them for Claude Code. */
const SKILLS: Record<OpsxStep, string> = {
  propose: 'openspec-propose',
  apply: 'openspec-apply-change',
  verify: 'openspec-verify-change',
  archive: 'openspec-archive-change'
}

export function commandStyleOf(value: unknown): CommandStyle {
  return value === 'opsx' ? 'opsx' : 'skill'
}

export function promptFor(step: OpsxStep, change: string | undefined, style: CommandStyle): string {
  const command = style === 'opsx' ? `/opsx:${step}` : `/${SKILLS[step]}`
  return change ? `${command} ${change}` : command
}

export default function activate(orca: OrcaWorkerApi): void {
  /** Terminals of agents this plugin launched; their `done` triggers a refresh. */
  const launched = new Set<string>()

  const post = async (): Promise<OpenSpecState> => {
    const state = await readState(orca)
    orca.panels.post('openspec.changed', state)
    return state
  }

  /** Watch the focused local workspace's openspec/ folder; no-op when it is already watched. */
  const retarget = async (): Promise<void> => {
    let target: string | null = null
    try {
      const ws = await focused(orca)
      if (ws && (!ws.hostId || ws.hostId === 'local') && hasOpenSpec(ws.path)) {
        target = join(ws.path, 'openspec')
      }
    } catch {
      target = null
    }
    if (current?.path === target) return
    stopWatching()
    if (!target) return
    try {
      current = watchFolder(
        target,
        () => void post(),
        (err) => {
          current = null
          orca.log(`openspec watch stopped: ${err.message}`)
        },
        options.watchDelayMs
      )
    } catch (err) {
      orca.log(`openspec watch failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const refresh = async (): Promise<OpenSpecState> => {
    await retarget()
    return post()
  }

  const launch = async (step: OpsxStep, change?: string): Promise<{ terminalId: string }> => {
    const ws = await focused(orca)
    if (!ws) throw Object.assign(new Error('No workspace is focused.'), { code: 'invalid_params' })
    const setting = await orca.settings.get('agent')
    const agent = typeof setting === 'string' && setting ? setting : 'claude'
    const style = commandStyleOf(await orca.settings.get('commandStyle'))
    const { terminalId } = await orca.host.call('agent.launch', {
      workspaceId: ws.workspaceId,
      agent,
      prompt: promptFor(step, change, style)
    })
    launched.add(terminalId)
    return { terminalId }
  }

  orca.panels.handle('openspec.state', async () => {
    await retarget()
    return readState(orca)
  })
  orca.panels.handle('openspec.launch', ({ step, change }) => launch(step, change))
  orca.panels.handle('openspec.init', async () => {
    const ws = await focused(orca)
    if (!ws) throw Object.assign(new Error('No workspace is focused.'), { code: 'invalid_params' })
    const { terminalId } = await orca.host.call('terminal.create', {
      workspaceId: ws.workspaceId,
      title: 'openspec init',
      command: 'openspec init'
    })
    return { terminalId }
  })

  orca.events.on('workspace.changed', () => void refresh())
  orca.events.on('agent.status.changed', (e) => {
    if (e.state === 'done' && e.terminalId && launched.has(e.terminalId)) void refresh()
  })

  orca.commands.register('openspec.propose', () => launch('propose').then(() => 'Started /opsx:propose'))
  for (const step of ['apply', 'verify', 'archive'] as const) {
    orca.commands.register(`openspec.${step}`, async () => {
      const state = await readState(orca)
      const selected = await orca.storage.get(SELECTED)
      const names = state.changes.map((c) => c.name)
      const change =
        typeof selected === 'string' && names.includes(selected)
          ? selected
          : names.length === 1
            ? names[0]
            : undefined
      if (!change) {
        const message = names.length
          ? 'Select a change in the OpenSpec panel first.'
          : 'No active OpenSpec change in this workspace.'
        await orca.host.call('notifications.show', { title: 'OpenSpec', body: message })
        return message
      }
      await launch(step, change)
      return `Started /opsx:${step} ${change}`
    })
  }
  orca.commands.register('openspec.refresh', async () => {
    await refresh()
    return 'Refreshed'
  })
}
