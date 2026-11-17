// No build step: Orca strips the types and compiles the JSX when the panel loads.
import {
  atom,
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
  read,
  Row,
  set,
  Spinner,
  Stack,
  Tab,
  Tabs,
  Text,
  Toolbar,
  type PanelContext
} from 'orca'
import type { ChangeInfo, OpenSpecState, OpsxStep } from './protocol'
import { filterByName, isReady, matchesChip, progressText, statusOf, type Chip } from './view'

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

async function load(): Promise<void> {
  set(state, await plugin.request('openspec.state'))
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
const init = () => call(() => plugin.request('openspec.init'))
const clearFilters = () => {
  set(chip, 'all')
  set(changeFilter, '')
}

export function setup(ctx: PanelContext): void {
  ctx.subscriptions.push(plugin.on('openspec.changed', (payload) => set(state, payload)))
  void load()
}

function Header(props: { title: string; canCreate: boolean }) {
  return (
    <Row justify="between">
      <Heading>{props.title}</Heading>
      <Row gap="xs">
        {props.canCreate ? (
          <IconButton icon="add" label="New change" variant="solid" tone="accent" onPress={() => run('propose')} />
        ) : null}
        <IconButton icon="refresh" label="Refresh" variant="ghost" onPress={load} />
      </Row>
    </Row>
  )
}

function ChangesTab(props: { changes: ChangeInfo[] }) {
  const text = read(changeFilter)
  const active = read(chip)
  const visible = filterByName(props.changes, text, (c) => c.name).filter((c) => matchesChip(c, active))
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
      {props.changes.length === 0 ? (
        <Text muted>No active changes.</Text>
      ) : visible.length === 0 ? (
        <Row justify="between">
          <Text muted>No matching changes.</Text>
          <Button size="sm" variant="ghost" onPress={clearFilters}>
            Clear filters
          </Button>
        </Row>
      ) : (
        <List label="Changes">
          {visible.map((c) => (
            <ListItem
              key={c.name}
              title={c.name}
              description={`${statusOf(c)} · ${progressText(c)}`}
              current={c.name === current?.name}
              onPress={() => set(selected, c.name)}
            >
              {c.total ? (
                <Progress label={`${c.name} progress`} labelHidden value={Math.round((100 * c.done) / c.total)} />
              ) : null}
            </ListItem>
          ))}
        </List>
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

function SpecsTab(props: { specs: string[] }) {
  const text = read(specFilter)
  const visible = filterByName(props.specs, text, (s) => s)
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
      {props.specs.length === 0 ? (
        <Text muted>No specs yet.</Text>
      ) : visible.length === 0 ? (
        <Text muted>No matching specs.</Text>
      ) : (
        <List label="Specs">
          {visible.map((name) => (
            <ListItem key={name} title={name} icon="file-text" />
          ))}
        </List>
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
        <Header title={title} canCreate={false} />
        <EmptyState title="Remote workspace" description="Remote workspaces are not supported yet." />
      </Stack>
    )
  if (s.status === 'error')
    return (
      <Stack gap="md">
        <Header title={title} canCreate={false} />
        <Callout tone="danger">Could not read OpenSpec: {s.error}</Callout>
      </Stack>
    )
  if (s.status === 'no-openspec')
    return (
      <Stack gap="md">
        <Header title={title} canCreate={false} />
        <EmptyState title="OpenSpec is not set up" description="This workspace has no openspec/ folder.">
          <Button onPress={init}>Init OpenSpec</Button>
        </EmptyState>
        {errorBox}
      </Stack>
    )

  return (
    <Stack gap="md">
      <Header title={title} canCreate />
      {errorBox}
      <Tabs label="OpenSpec views" value={read(tab)} onChange={(v) => set(tab, v)}>
        <Tab value="changes" label={`Changes (${s.changes.length})`}>
          <ChangesTab changes={s.changes} />
        </Tab>
        <Tab value="specs" label={`Specs (${s.specs.length})`}>
          <SpecsTab specs={s.specs} />
        </Tab>
      </Tabs>
    </Stack>
  )
}
