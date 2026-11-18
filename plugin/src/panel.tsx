// No build step: Orca strips the types and compiles the JSX when the panel loads.
import {
  atom,
  Badge,
  Box,
  Button,
  Card,
  Callout,
  EmptyState,
  Heading,
  IconButton,
  Input,
  List,
  ListItem,
  plugin,
  Progress,
  read,
  Row,
  Select,
  Separator,
  set,
  Spinner,
  Stack,
  Tab,
  Table,
  Tabs,
  Text,
  Textarea,
  update,
  type PanelContext
} from 'orca'
import type { ChangeInfo, OpenSpecState, OpsxStep } from './protocol'
import {
  BATCH,
  filterByName,
  firstBatch,
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
/** How many spec rows the Specs table draws; grows by BATCH as the user scrolls. */
const specLimit = atom(BATCH)

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

/** Registered stores for the "not set up" screen: null while loading, [] when none. */
const storeOptions = atom<string[] | null>(null)
const storePick = atom<string | null>(null)
const linking = atom(false)

async function loadStores(): Promise<void> {
  try {
    const { stores } = await plugin.request('openspec.stores')
    const ids = stores.map((s) => s.id)
    set(storeOptions, ids)
    if (!read(storePick) || !ids.includes(read(storePick) as string)) set(storePick, ids[0] ?? null)
  } catch (err) {
    set(storeOptions, [])
    set(actionError, err instanceof Error ? err.message : String(err))
  }
}

/** New-store form and Change store box (panel-only state). */
const newStoreOpen = atom(false)
const newStoreId = atom('')
const newStoreFolder = atom('')
const folderEdited = atom(false)
const storeParent = atom<string | null>(null)
const changeStoreOpen = atom(false)
const storeBusy = atom(false)

/** `<parent>\openspec-<id>`, using the parent's own path separator. */
function defaultFolder(id: string): string {
  const parent = read(storeParent)
  if (!parent) return ''
  const sep = parent.includes('\\') ? '\\' : '/'
  return `${parent.replace(/[\\/]+$/, '')}${sep}openspec-${id || '<id>'}`
}

async function openNewStore(): Promise<void> {
  set(newStoreOpen, true)
  set(newStoreId, '')
  set(folderEdited, false)
  try {
    set(storeParent, (await plugin.request('openspec.storeDefaults')).parent)
  } catch {
    set(storeParent, null)
  }
  set(newStoreFolder, defaultFolder(''))
}

async function storeAction(fn: () => Promise<OpenSpecState>): Promise<boolean> {
  if (read(storeBusy)) return false
  set(storeBusy, true)
  set(actionError, null)
  try {
    receive(await fn())
    return true
  } catch (err) {
    set(actionError, err instanceof Error ? err.message : String(err))
    return false
  } finally {
    set(storeBusy, false)
  }
}

async function createNewStore(): Promise<void> {
  const id = read(newStoreId).trim()
  const done = await storeAction(() =>
    plugin.request('openspec.createStore', { id, folder: read(newStoreFolder), link: true })
  )
  if (done) {
    set(newStoreOpen, false)
    set(changeStoreOpen, false)
    void loadStores()
  }
}

async function switchStore(store: string | null): Promise<void> {
  if (await storeAction(() => plugin.request('openspec.setStore', { store }))) set(changeStoreOpen, false)
}

function NewStoreForm() {
  const busy = read(storeBusy)
  return (
    <Box direction="column" gap="sm" padding="sm">
      <Text>New store</Text>
      <Input
        label="Store id"
        placeholder="e.g. his"
        value={read(newStoreId)}
        disabled={busy}
        onChange={(v) => {
          set(newStoreId, v)
          if (!read(folderEdited)) set(newStoreFolder, defaultFolder(v.trim()))
        }}
      />
      <Input
        label="Folder"
        value={read(newStoreFolder)}
        disabled={busy}
        onChange={(v) => {
          set(newStoreFolder, v)
          set(folderEdited, true)
        }}
      />
      <Row gap="xs">
        <Button size="sm" variant="solid" tone="accent" disabled={busy || !read(newStoreId).trim()} onPress={createNewStore}>
          {busy ? 'Creating…' : 'Create store'}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onPress={() => set(newStoreOpen, false)}>
          Cancel
        </Button>
      </Row>
      <Text muted size="xs">
        Runs openspec store setup (a new git repo with a first commit), then links this workspace to it.
      </Text>
    </Box>
  )
}

function ChangeStoreBox(props: { current: string; prefixes: string[] }) {
  const stores = (read(storeOptions) ?? []).filter((id) => id !== props.current)
  const pick = read(storePick)
  const target = pick && stores.includes(pick) ? pick : stores[0]
  const busy = read(storeBusy)
  return (
    <Card title="Store settings">
      <Stack gap="sm" align="stretch">
        <Input
          label="System prefixes"
          placeholder="e.g. eclaims, ess"
          value={read(editingSystem) ? read(systemDraft) : props.prefixes.join(', ')}
          disabled={busy}
          onChange={(v) => {
            set(systemDraft, v)
            set(editingSystem, true)
          }}
        />
        <Button size="sm" variant="solid" disabled={busy || !read(editingSystem)} onPress={saveSystem}>
          Save
        </Button>
        {stores.length ? (
          <Select
            label="Switch to"
            value={target}
            options={stores.map((id) => ({ value: id, label: id }))}
            disabled={busy}
            onChange={(v) => set(storePick, v)}
          />
        ) : null}
        {stores.length ? (
          <Button size="sm" variant="solid" disabled={busy} onPress={() => switchStore(target)}>
            Switch
          </Button>
        ) : null}
        <Separator />
        <Button size="sm" variant="outline" icon="add" disabled={busy} onPress={openNewStore}>
          New store
        </Button>
        <Button size="sm" variant="outline" tone="danger" disabled={busy} onPress={() => switchStore(null)}>
          Unlink
        </Button>
      </Stack>
    </Card>
  )
}

async function linkStore(): Promise<void> {
  const id = read(storePick)
  if (!id || read(linking)) return
  set(linking, true)
  set(actionError, null)
  try {
    receive(await plugin.request('openspec.linkStore', { store: id }))
  } catch (err) {
    set(actionError, err instanceof Error ? err.message : String(err))
  } finally {
    set(linking, false)
  }
}

function receive(next: OpenSpecState): void {
  if (read(state)?.workspace !== next.workspace) set(specLimit, BATCH) // new workspace: first batch
  set(state, next)
  set(updatedAt, Date.now())
  if (next.status === 'no-openspec' && !next.store) void loadStores()
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

/** One dropdown for the store scope: this system (named by its prefixes) or all systems. */
function ScopeSelect(props: { prefixes: string[] }) {
  return (
    <Select
      label="Scope"
      labelHidden
      value={read(systemMode)}
      options={[
        { value: 'system', label: props.prefixes.length ? props.prefixes.join(', ') : 'No system set' },
        { value: 'all', label: 'All systems' }
      ]}
      onChange={(v) => {
        set(systemMode, v === 'all' ? 'all' : 'system')
        set(specLimit, BATCH)
      }}
    />
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

function LinkStore() {
  const stores = read(storeOptions)
  if (stores === null) return <Spinner label="Loading stores" />
  const newStore = read(newStoreOpen) ? (
    <NewStoreForm />
  ) : (
    <Stack gap="xs" align="stretch">
      <Button variant="outline" icon="add" onPress={openNewStore}>
        New store
      </Button>
    </Stack>
  )
  if (stores.length === 0)
    return (
      <Stack gap="sm">
        <Text muted size="xs">
          No OpenSpec stores are registered on this machine. Create one below, or register an existing one with
          `openspec store register &lt;path&gt;` and press Refresh.
        </Text>
        {newStore}
      </Stack>
    )
  const busy = read(linking)
  return (
    <Stack gap="sm">
    <Box direction="column" gap="sm" padding="sm">
      <Text>Or use a store</Text>
      <Select
        label="Store"
        value={read(storePick) ?? stores[0]}
        options={stores.map((id) => ({ value: id, label: id }))}
        disabled={busy}
        onChange={(v) => set(storePick, v)}
      />
      <Stack gap="xs" align="stretch">
        <Button variant="solid" tone="accent" icon="link" disabled={busy} onPress={linkStore}>
          Link store
        </Button>
      </Stack>
      <Text muted size="xs">
        Creates openspec/config.yaml with only a store: line. Nothing else in the project changes.
      </Text>
    </Box>
    {newStore}
    </Stack>
  )
}


/** "via store <id>" plus the store settings pencil. */
function StoreSettingsButton() {
  return (
    <IconButton
      icon={read(changeStoreOpen) ? 'close' : 'edit'}
      label={read(changeStoreOpen) ? 'Close store settings' : 'Store settings'}
      size="xs"
      variant="ghost"
      onPress={() => {
        const opening = !read(changeStoreOpen)
        set(changeStoreOpen, opening)
        set(newStoreOpen, false)
        if (opening) void loadStores()
      }}
    />
  )
}

function StoreBadge(props: { store: string }) {
  return (
    <Row gap="none">
      <Badge tone="accent">via store {props.store}</Badge>
      <StoreSettingsButton />
    </Row>
  )
}

/** The main view's store line: a small caption and the settings pencil, above the scope dropdown. */
function StoreCaption(props: { store: string }) {
  return (
    <Row justify="between" align="center" gap="xs">
      <Text muted size="xs">
        via store {props.store}
      </Text>
      <StoreSettingsButton />
    </Row>
  )
}

/** `store` shows the badge in the header; the main view passes `badgeBelow` to put it on the
 *  scope row instead, so the header fits the sidebar width. */
function Header(props: { title: string; canCreate: boolean; store?: string; badgeBelow?: boolean }) {
  return (
    <Row justify="between">
      <Row gap="xs">
        <Heading level={3}>{props.title}</Heading>
        {props.store && !props.badgeBelow ? <StoreBadge store={props.store} /> : null}
      </Row>
      <Row gap="xs">
        {props.canCreate ? (
          <IconButton
            icon={read(formOpen) ? 'close' : 'add'}
            label={read(formOpen) ? 'Close new change' : 'New change'}
            size="sm"
            variant="solid"
            tone="accent"
            onPress={() => (read(formOpen) ? closeForm() : openForm())}
          />
        ) : null}
        {props.canCreate ? (
          <IconButton
            icon="layers"
            label="Open board"
            size="sm"
            variant="ghost"
            onPress={() => call(() => plugin.request('openspec.openBoard'))}
          />
        ) : null}
        {read(refreshing) ? (
          <Spinner label="Refreshing" labelHidden />
        ) : (
          <IconButton
            icon="refresh"
            label="Refresh"
            tooltip={read(updatedAt) ? `Updated ${new Date(read(updatedAt) as number).toLocaleTimeString()}` : 'Refresh'}
            size="sm"
            variant="ghost"
            onPress={reload}
          />
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
      <Row gap="xs">
        <Input
          label="Filter changes"
          labelHidden
          type="search"
          placeholder="Filter changes"
          value={text}
          onChange={(v) => set(changeFilter, v)}
        />
        <Select
          label="Status"
          labelHidden
          value={active}
          options={CHIPS}
          onChange={(v) => set(chip, v as Chip)}
        />
      </Row>
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

function SpecsTab(props: { specs: string[]; shared?: string[] }) {
  const text = read(specFilter)
  const grouped = props.shared !== undefined
  const mineVisible = filterByName(props.specs, text, (s) => s)
  const sharedVisible = props.shared ? filterByName(props.shared, text, (s) => s) : []
  const visible = [
    ...mineVisible.map((name) => ({ name, group: 'This system' })),
    ...sharedVisible.map((name) => ({ name, group: 'Shared' }))
  ]
  const total = props.specs.length + (props.shared?.length ?? 0)
  const { rows, hasMore } = firstBatch(visible, read(specLimit))
  return (
    <Stack gap="sm">
      <Input
        label="Filter specs"
        labelHidden
        type="search"
        placeholder="Filter specs"
        value={text}
        onChange={(v) => {
          set(specFilter, v)
          set(specLimit, BATCH) // a new search starts from the first batch
        }}
      />
      {total === 0 ? (
        <Text muted>No specs yet.</Text>
      ) : visible.length === 0 ? (
        <Text muted>No matching specs.</Text>
      ) : (
        <Table
          label="Specs"
          maxHeight="lg"
          columns={grouped ? [{ key: 'name', label: 'Spec' }, { key: 'group', label: 'Group' }] : [{ key: 'name', label: 'Spec' }]}
          rows={rows.map((r) => ({ key: r.name, cells: grouped ? { name: r.name, group: r.group } : { name: r.name } }))}
          hasMore={hasMore}
          onLoadMore={() => update(specLimit, (n) => n + BATCH)}
        />
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
      <Stack gap="sm">
        <Header title={title} canCreate={false} store={s.store} />
        <EmptyState title="Remote workspace" description="Remote workspaces are not supported yet." />
      </Stack>
    )
  if (s.status === 'error')
    return (
      <Stack gap="sm">
        <Header title={title} canCreate={false} store={s.store} />
        <Callout tone="danger">Could not read OpenSpec: {s.error}</Callout>
      </Stack>
    )
  if (s.status === 'no-openspec')
    return (
      <Stack gap="sm">
        <Header title={title} canCreate={false} store={s.store} />
        <EmptyState title="OpenSpec is not set up" description="This workspace has no openspec/ folder.">
          <Button onPress={init}>Init OpenSpec</Button>
        </EmptyState>
        {s.store ? null : <LinkStore />}
        {errorBox}
      </Stack>
    )

  const view = s.store ? systemView(s) : null
  const filtered = view && read(systemMode) === 'system' ? view : null
  const changeCount = filtered ? filtered.changes.mine.length + filtered.changes.shared.length : s.changes.length
  const specCount = filtered ? filtered.specs.mine.length + filtered.specs.shared.length : s.specs.length
  return (
    <Stack gap="sm">
      <Header title={title} canCreate store={s.store} badgeBelow />
      {s.store && view ? (
        <Stack gap="xs">
          <StoreCaption store={s.store} />
          <ScopeSelect prefixes={view.prefixes} />
        </Stack>
      ) : null}
      {s.store && read(changeStoreOpen) ? (
        read(newStoreOpen) ? <NewStoreForm /> : <ChangeStoreBox current={s.store} prefixes={view?.prefixes ?? []} />
      ) : null}
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
