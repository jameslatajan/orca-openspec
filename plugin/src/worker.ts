// The plugin's worker: reads openspec/ for the focused workspace and launches OpenSpec agents.
import type { OrcaWorkerApi } from 'orca/worker'
import { hasOpenSpec, readChanges, readSpecs } from './openspec'
import type { OpenSpecState, OpsxStep } from './protocol'
import { watchFolder, type FolderWatch } from './watch'
import { join } from 'node:path'

/** The live watcher on the focused workspace's openspec/ folder, if any. */
let current: FolderWatch | null = null
/** Timings; tests shorten them. */
export const options = { watchDelayMs: 300, readyPollMs: 500, readyTimeoutMs: 30_000 }

/** Agent kinds the New change form offers. */
export const AGENTS = ['claude', 'codex', 'gemini', 'opencode', 'cursor', 'copilot']

const INPUT_MARKER = /^\s*[│|]?\s*[❯>›]/

/** True when the agent's screen shows an input prompt in its last lines. */
export function isAgentReady(lines: readonly string[]): boolean {
  return lines.slice(-15).some((line) => INPUT_MARKER.test(line))
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

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
  explore: 'openspec-explore',
  propose: 'openspec-propose',
  apply: 'openspec-apply-change',
  verify: 'openspec-verify-change',
  archive: 'openspec-archive-change'
}

export function commandStyleOf(value: unknown): CommandStyle {
  return value === 'opsx' ? 'opsx' : 'skill'
}

/** `arg` is the change name, or the description for explore/propose. Newlines become spaces
 *  so the whole prompt is sent as one line. */
export function promptFor(step: OpsxStep, arg: string | undefined, style: CommandStyle): string {
  const command = style === 'opsx' ? `/opsx:${step}` : `/${SKILLS[step]}`
  const text = arg?.replace(/\s*\r?\n\s*/g, ' ').trim()
  return text ? `${command} ${text}` : command
}

async function defaultAgent(orca: OrcaWorkerApi): Promise<string> {
  const setting = await orca.settings.get('agent')
  return typeof setting === 'string' && setting ? setting : 'claude'
}

/** Starts an agent, shows its terminal, waits until it accepts input, then types the prompt. */
async function launchVisible(
  orca: OrcaWorkerApi,
  workspaceId: string,
  agent: string,
  prompt: string
): Promise<string> {
  const { terminalId } = await orca.host.call('agent.launch', { workspaceId, agent })
  try {
    await orca.host.call('terminal.focus', { terminalId })
  } catch (err) {
    orca.log(`openspec: could not show terminal: ${err instanceof Error ? err.message : String(err)}`)
  }
  let previous = ''
  let ready = false
  const deadline = Date.now() + options.readyTimeoutMs
  while (Date.now() < deadline) {
    await sleep(options.readyPollMs)
    try {
      const { lines } = await orca.host.call('terminal.read', { terminalId, maxLines: 60 })
      const screen = lines.join('\n')
      if (isAgentReady(lines) && screen === previous) {
        ready = true
        break
      }
      previous = screen
    } catch {
      // The terminal may not be readable for a moment after launch; keep polling.
    }
  }
  if (!ready) orca.log(`openspec: ${agent} did not look ready after ${options.readyTimeoutMs} ms; sending anyway`)
  await orca.host.call('terminal.sendText', { terminalId, text: prompt, enter: true })
  return terminalId
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

  const launch = async (step: OpsxStep, arg?: string, agentKind?: string): Promise<{ terminalId: string }> => {
    const ws = await focused(orca)
    if (!ws) throw Object.assign(new Error('No workspace is focused.'), { code: 'invalid_params' })
    const agent = agentKind && agentKind.trim() ? agentKind.trim() : await defaultAgent(orca)
    const style = commandStyleOf(await orca.settings.get('commandStyle'))
    const terminalId = await launchVisible(orca, ws.workspaceId, agent, promptFor(step, arg, style))
    launched.add(terminalId)
    return { terminalId }
  }

  orca.panels.handle('openspec.state', async () => {
    await retarget()
    return readState(orca)
  })
  orca.panels.handle('openspec.launch', ({ step, change, description, agent }) =>
    launch(step, change ?? description, agent)
  )
  orca.panels.handle('openspec.agents', async () => {
    const preferred = await defaultAgent(orca)
    return { agents: [preferred, ...AGENTS.filter((a) => a !== preferred)], defaultAgent: preferred }
  })
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

  orca.commands.register('openspec.propose', async () => {
    orca.panels.post('openspec.showForm', {})
    const message = 'Describe the change in the OpenSpec panel, then press Explore or Propose.'
    await orca.host.call('notifications.show', { title: 'OpenSpec', body: message })
    return message
  })
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
      return `Started ${step} for ${change}`
    })
  }
  orca.commands.register('openspec.refresh', async () => {
    await refresh()
    return 'Refreshed'
  })
}
