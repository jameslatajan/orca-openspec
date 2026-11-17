// No build step: Orca strips the types and compiles the JSX when the panel loads.
import {
  atom,
  Badge,
  Box,
  Button,
  Callout,
  EmptyState,
  Heading,
  IconButton,
  Input,
  List,
  ListItem,
  plugin,
  Progress,
  RelativeTime,
  read,
  Row,
  Select,
  set,
  Spinner,
  Stack,
  Tab,
  Tabs,
  Text,
  Textarea,
  Toolbar,
  type PanelContext
} from 'orca'
import type { ChangeInfo, OpenSpecState, OpsxStep } from './protocol'
import {
  filterByName,
  guessPrefixes,
  isReady,
  knownPrefixes,
  matchesChip,
  parsePrefixes,
  progressText,
  splitBySystem,
  statusOf,
  type Chip
} from './view'

const state = atom<OpenSpecState | null>(null)
const actionError = atom<string | null>(null)
/** Shared with the worker's palette commands through plugin storage. */
const selected = atom<string | null>('selectedChange', null, { persist: 'storage' })
const tab = atom<string>('tab', 'changes', { persist: 'plugin' })
const changeFilter = atom<string>('changeFilter', '', { persist: 'plugin' })
const specFilter = atom<string>('specFilter', '', { persist: 'plugin' })
const chip = atom<Chip>('chip', 'all', { persist: 'plugin' })

const CHIPS: { value: Chip; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'In progress' },
  { value: 'done', label: 'Done' }
]

/** True while the Refresh button's reload runs (shown as a spinner). */
const refreshing = atom(false)
/** When the panel last got fresh state, for the "Updated …" line. */
const updatedAt = atom<number | null>(null)
/** The spinner stays at least this long, so a fast refresh is still visible. */
export const MIN_SPIN_MS = 500

/** Store workspaces: show this system's items (plus shared ones) or everything. */
const systemMode = atom<'system' | 'all'>('systemMode', 'system', { persist: 'plugin' })
/** Saved prefixes for the focused workspace (null = none saved, use the guess). */
const savedPrefixes = atom<string[] | null>(null)
/** Which workspace `savedPrefixes` belongs to, so a switch reloads them. */
const prefixesFor = atom<string | null>(null)
const editingSystem = atom(false)
const systemDraft = atom('')

function receive(next: OpenSpecState): void {
  set(state, next)
  set(updatedAt, Date.now())
  const key = next.store ? `${next.workspace ?? ''}@${next.store}` : null
  if (key && key !== read(prefixesFor)) void loadPrefixes(key)
  if (!key) set(prefixesFor, null)
}

async function loadPrefixes(key: string): Promise<void> {
  set(prefixesFor, key)
  set(savedPrefixes, null)
  set(editingSystem, false)
  try {
    const { prefixes } = await plugin.request('openspec.systemPrefixes')
    if (read(prefixesFor) === key) set(savedPrefixes, prefixes)
  } catch {
    // Keep the guess when the saved list can't be read.
  }
}

async function saveSystem(): Promise<void> {
  const prefixes = parsePrefixes(read(systemDraft))
  try {
    const res = await plugin.request('openspec.setSystemPrefixes', { prefixes })
    set(savedPrefixes, res.prefixes)
    set(editingSystem, false)
  } catch (err) {
    set(actionError, err instanceof Error ? err.message : String(err))
  }
}

/** This system's items and shared ones for a store workspace. */
function systemView(s: OpenSpecState) {
  const known = knownPrefixes([...s.changes.map((c) => c.name), ...s.specs])
  const prefixes = read(savedPrefixes) ?? guessPrefixes(s.workspace ?? '', known)
  return {
    prefixes,
    changes: splitBySystem(s.changes, prefixes, known, (c) => c.name),
    specs: splitBySystem(s.specs, prefixes, known, (n) => n)
  }
}

function SystemBar(props: { prefixes: string[] }) {
  const mode = read(systemMode)
  const editing = read(editingSystem)
  const modes: { value: 'system' | 'all'; label: string }[] = [
    { value: 'system', label: 'This system' },
    { value: 'all', label: 'All' }
  ]
  return (
    <Stack gap="xs">
      <Toolbar label="Store scope" gap="xs">
        {modes.map((m) => (
          <Button
            key={m.value}
            size="sm"
            variant={m.value === mode ? 'solid' : 'outline'}
            tone={m.value === mode ? 'accent' : 'neutral'}
            onPress={() => set(systemMode, m.value)}
          >
            {m.label}
          </Button>
        ))}
      </Toolbar>
      {editing ? (
        <Row gap="xs">
          <Input
            label="System prefixes"
            labelHidden
            placeholder="e.g. eclaims, ess"
            value={read(systemDraft)}
            onChange={(v) => set(systemDraft, v)}
          />
          <Button size="sm" variant="solid" onPress={saveSystem}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onPress={() => set(editingSystem, false)}>
            Cancel
          </Button>
        </Row>
      ) : mode === 'system' ? (
        <Row gap="xs">
          <Text muted size="xs">
            System: {props.prefixes.length ? props.prefixes.join(', ') : 'not set'}
          </Text>
          <Button
            size="sm"
            variant="ghost"
            icon="edit"
            onPress={() => {
              set(systemDraft, props.prefixes.join(', '))
              set(editingSystem, true)
            }}
          >
            Edit system
          </Button>
        </Row>
      ) : null}
    </Stack>
  )
}

async function load(): Promise<void> {
  receive(await plugin.request('openspec.state'))
}

async function reload(): Promise<void> {
  if (read(refreshing)) return
  set(refreshing, true)
  set(actionError, null)
  const minimum = new Promise((r) => setTimeout(r, MIN_SPIN_MS))
  try {
    const [next] = await Promise.all([plugin.request('openspec.refresh'), minimum])
    receive(next)
  } catch (err) {
    await minimum
    set(actionError, `Refresh failed: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    set(refreshing, false)
  }
}

async function call(fn: () => Promise<unknown>): Promise<void> {
  set(actionError, null)
  try {
    await fn()
  } catch (err) {
    set(actionError, err instanceof Error ? err.message : String(err))
  }
}

const run = (step: OpsxStep, change?: string) =>
  call(() => plugin.request('openspec.launch', change ? { step, change } : { step }))

/** The New change form: panel-only state; the description is never persisted. */
const formOpen = atom(false)
const description = atom('')
const formAgent = atom<string | null>(null)
const agentOptions = atom<string[]>([])
const formBusy = atom(false)
const formError = atom<string | null>(null)
/** Claude model for the form; 'default' = Claude's own default. Remembered across panel runs. */
const formModel = atom<string>('formModel', 'default', { persist: 'plugin' })

const MODELS = [
  { value: 'default', label: 'Default' },
  { value: 'opus', label: 'Opus' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'haiku', label: 'Haiku' }
]

async function openForm(): Promise<void> {
  set(formError, null)
  set(formOpen, true)
  if (read(agentOptions).length === 0) {
    try {
      const { agents, defaultAgent } = await plugin.request('openspec.agents')
      set(agentOptions, agents)
      if (!read(formAgent)) set(formAgent, defaultAgent)
    } catch {
      set(agentOptions, ['claude'])
      if (!read(formAgent)) set(formAgent, 'claude')
    }
  }
}

function closeForm(): void {
  set(formOpen, false)
  set(description, '')
  set(formError, null)
}

async function startFromForm(step: 'explore' | 'propose'): Promise<void> {
  const text = read(description).trim()
  if (!text || read(formBusy)) return
  set(formBusy, true)
  set(formError, null)
  try {
    const agent = read(formAgent) ?? undefined
    const picked = read(formModel)
    const model = agent === 'claude' && picked !== 'default' ? picked : ''
    await plugin.request('openspec.launch', {
      step,
      description: text,
      ...(agent ? { agent } : {}),
      ...(model ? { model } : {})
    })
    closeForm()
  } catch (err) {
    set(formError, err instanceof Error ? err.message : String(err))
  } finally {
    set(formBusy, false)
  }
}

function NewChangeForm() {
  const text = read(description)
  const busy = read(formBusy)
  const empty = text.trim().length === 0
  const agents = read(agentOptions)
  const err = read(formError)
  return (
    <Box direction="column" gap="sm" padding="sm">
      <Textarea
        label="Describe the change"
        placeholder="What do you want to build or fix?"
        rows={4}
        value={text}
        disabled={busy}
        onChange={(v) => set(description, v)}
        onSubmit={() => startFromForm('explore')}
      />
      <Select
        label="Agent"
        value={read(formAgent) ?? agents[0] ?? 'claude'}
        options={(agents.length ? agents : ['claude']).map((a) => ({ value: a, label: a }))}
        disabled={busy}
        onChange={(v) => set(formAgent, v)}
      />
      {(read(formAgent) ?? agents[0]) === 'claude' ? (
        <Select
          label="Model"
          value={read(formModel)}
          options={MODELS}
          disabled={busy}
          onChange={(v) => set(formModel, v)}
        />
      ) : null}
      {err ? <Callout tone="danger">{err}</Callout> : null}
      <Row gap="xs">
        <Button variant="solid" tone="accent" icon="search" disabled={empty || busy} onPress={() => startFromForm('explore')}>
          Explore
        </Button>
        <Button variant="outline" disabled={empty || busy} onPress={() => startFromForm('propose')}>
          Propose
        </Button>
        <Button variant="ghost" disabled={busy} onPress={closeForm}>
          Cancel
        </Button>
      </Row>
      {busy ? (
        <Text muted size="xs">
          Starting the agent and waiting for it to be ready…
        </Text>
      ) : null}
    </Box>
  )
}
const init = () => call(() => plugin.request('openspec.init'))
const clearFilters = () => {
  set(chip, 'all')
  set(changeFilter, '')
}

export function setup(ctx: PanelContext): void {
  ctx.subscriptions.push(plugin.on('openspec.changed', (payload) => receive(payload)))
  ctx.subscriptions.push(plugin.on('openspec.showForm', () => void openForm()))
  void load()
}

function UpdatedLine() {
  const at = read(updatedAt)
  return at === null ? null : (
    <Text muted size="xs">
      Updated <RelativeTime at={at} muted />
    </Text>
  )
}

function Header(props: { title: string; canCreate: boolean; store?: string }) {
  return (
    <Row justify="between">
      <Row gap="xs">
        <Heading>{props.title}</Heading>
        {props.store ? <Badge tone="accent">via store {props.store}</Badge> : null}
      </Row>
      <Row gap="xs">
        {props.canCreate ? (
          <IconButton
            icon={read(formOpen) ? 'close' : 'add'}
            label={read(formOpen) ? 'Close new change' : 'New change'}
            variant="solid"
            tone="accent"
            onPress={() => (read(formOpen) ? closeForm() : openForm())}
          />
        ) : null}
        {read(refreshing) ? (
          <Spinner label="Refreshing" labelHidden />
        ) : (
          <IconButton icon="refresh" label="Refresh" variant="ghost" onPress={reload} />
        )}
      </Row>
    </Row>
  )
}

function changeRows(items: ChangeInfo[], currentName: string | undefined) {
  return items.map((c) => (
    <ListItem
      key={c.name}
      title={c.name}
      description={`${statusOf(c)} · ${progressText(c)}`}
      current={c.name === currentName}
      onPress={() => set(selected, c.name)}
    >
      {c.total ? <Progress label={`${c.name} progress`} labelHidden value={Math.round((100 * c.done) / c.total)} /> : null}
    </ListItem>
  ))
}

function ChangesTab(props: { changes: ChangeInfo[]; shared?: ChangeInfo[] }) {
  const text = read(changeFilter)
  const active = read(chip)
  const pick = (items: ChangeInfo[]) => filterByName(items, text, (c) => c.name).filter((c) => matchesChip(c, active))
  const mineVisible = pick(props.changes)
  const sharedVisible = props.shared ? pick(props.shared) : []
  const visible = [...mineVisible, ...sharedVisible]
  const total = props.changes.length + (props.shared?.length ?? 0)
  const current = visible.find((c) => c.name === read(selected))
  return (
    <Stack gap="sm">
      <Input
        label="Filter changes"
        labelHidden
        type="search"
        placeholder="Filter changes"
        value={text}
        onChange={(v) => set(changeFilter, v)}
      />
      <Toolbar label="Show" gap="xs">
        {CHIPS.map((c) => (
          <Button
            key={c.value}
            size="sm"
            variant={c.value === active ? 'solid' : 'outline'}
            tone={c.value === active ? 'accent' : 'neutral'}
            onPress={() => set(chip, c.value)}
          >
            {c.label}
          </Button>
        ))}
      </Toolbar>
      {total === 0 ? (
        <Text muted>No active changes.</Text>
      ) : visible.length === 0 ? (
        <Row justify="between">
          <Text muted>No matching changes.</Text>
          <Button size="sm" variant="ghost" onPress={clearFilters}>
            Clear filters
          </Button>
        </Row>
      ) : (
        <Stack gap="xs">
          {mineVisible.length ? <List label="Changes">{changeRows(mineVisible, current?.name)}</List> : null}
          {sharedVisible.length ? (
            <Stack gap="xs">
              <Text muted size="xs">
                Shared
              </Text>
              <List label="Shared changes">{changeRows(sharedVisible, current?.name)}</List>
            </Stack>
          ) : null}
        </Stack>
      )}
      {current ? (
        <Box direction="column" gap="sm" padding="sm">
          <Text>{current.name}</Text>
          <Row gap="xs">
            <Button variant="solid" tone="accent" icon="play" onPress={() => run('apply', current.name)}>
              Apply
            </Button>
            {isReady(current) ? (
              <Button variant="outline" tone="success" icon="check" onPress={() => run('archive', current.name)}>
                Archive
              </Button>
            ) : (
              <Button variant="outline" onPress={() => run('verify', current.name)}>
                Verify
              </Button>
            )}
          </Row>
        </Box>
      ) : visible.length ? (
        <Text muted size="xs">
          Select a change to apply or verify it.
        </Text>
      ) : null}
    </Stack>
  )
}

function specRows(names: string[]) {
  return names.map((name) => <ListItem key={name} title={name} icon="file-text" />)
}

function SpecsTab(props: { specs: string[]; shared?: string[] }) {
  const text = read(specFilter)
  const mineVisible = filterByName(props.specs, text, (s) => s)
  const sharedVisible = props.shared ? filterByName(props.shared, text, (s) => s) : []
  const visible = [...mineVisible, ...sharedVisible]
  const total = props.specs.length + (props.shared?.length ?? 0)
  return (
    <Stack gap="sm">
      <Input
        label="Filter specs"
        labelHidden
        type="search"
        placeholder="Filter specs"
        value={text}
        onChange={(v) => set(specFilter, v)}
      />
      {total === 0 ? (
        <Text muted>No specs yet.</Text>
      ) : visible.length === 0 ? (
        <Text muted>No matching specs.</Text>
      ) : (
        <Stack gap="xs">
          {mineVisible.length ? <List label="Specs">{specRows(mineVisible)}</List> : null}
          {sharedVisible.length ? (
            <Stack gap="xs">
              <Text muted size="xs">
                Shared
              </Text>
              <List label="Shared specs">{specRows(sharedVisible)}</List>
            </Stack>
          ) : null}
        </Stack>
      )}
    </Stack>
  )
}

export default function Panel() {
  const s = read(state)
  const err = read(actionError)
  if (!s) return <Spinner label="Loading OpenSpec" />

  const title = s.workspace ?? 'OpenSpec'
  const errorBox = err ? <Callout tone="danger">{err}</Callout> : null

  if (s.status === 'no-workspace')
    return <EmptyState title="No workspace" description="Focus a workspace to see its OpenSpec changes." />
  if (s.status === 'remote')
    return (
      <Stack gap="md">
        <Header title={title} canCreate={false} store={s.store} />
        <EmptyState title="Remote workspace" description="Remote workspaces are not supported yet." />
      </Stack>
    )
  if (s.status === 'error')
    return (
      <Stack gap="md">
        <Header title={title} canCreate={false} store={s.store} />
        <Callout tone="danger">Could not read OpenSpec: {s.error}</Callout>
      </Stack>
    )
  if (s.status === 'no-openspec')
    return (
      <Stack gap="md">
        <Header title={title} canCreate={false} store={s.store} />
        <EmptyState title="OpenSpec is not set up" description="This workspace has no openspec/ folder.">
          <Button onPress={init}>Init OpenSpec</Button>
        </EmptyState>
        {errorBox}
      </Stack>
    )

  const view = s.store ? systemView(s) : null
  const filtered = view && read(systemMode) === 'system' ? view : null
  const changeCount = filtered ? filtered.changes.mine.length + filtered.changes.shared.length : s.changes.length
  const specCount = filtered ? filtered.specs.mine.length + filtered.specs.shared.length : s.specs.length
  return (
    <Stack gap="md">
      <Header title={title} canCreate store={s.store} />
      <UpdatedLine />
      {view ? <SystemBar prefixes={view.prefixes} /> : null}
      {read(formOpen) ? <NewChangeForm /> : null}
      {errorBox}
      <Tabs label="OpenSpec views" value={read(tab)} onChange={(v) => set(tab, v)}>
        <Tab value="changes" label={`Changes (${changeCount})`}>
          {filtered ? (
            <ChangesTab changes={filtered.changes.mine} shared={filtered.changes.shared} />
          ) : (
            <ChangesTab changes={s.changes} />
          )}
        </Tab>
        <Tab value="specs" label={`Specs (${specCount})`}>
          {filtered ? <SpecsTab specs={filtered.specs.mine} shared={filtered.specs.shared} /> : <SpecsTab specs={s.specs} />}
        </Tab>
      </Tabs>
    </Stack>
  )
}
