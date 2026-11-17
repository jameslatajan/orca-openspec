// No build step: Orca strips the types and compiles the JSX when the panel loads.
import {
  atom,
  Badge,
  Button,
  Callout,
  EmptyState,
  Heading,
  List,
  ListItem,
  plugin,
  Progress,
  read,
  Row,
  set,
  Spinner,
  Stack,
  Text,
  type PanelContext
} from 'orca'
import type { OpenSpecState, OpsxStep } from './protocol'

const state = atom<OpenSpecState | null>(null)
/** Shared with the worker's palette commands through plugin storage. */
const selected = atom<string | null>('selectedChange', null, { persist: 'storage' })
const actionError = atom<string | null>(null)

async function load(): Promise<void> {
  set(state, await plugin.request('openspec.state'))
}

async function run(step: OpsxStep, change?: string): Promise<void> {
  set(actionError, null)
  try {
    await plugin.request('openspec.launch', change ? { step, change } : { step })
  } catch (err) {
    set(actionError, err instanceof Error ? err.message : String(err))
  }
}

async function init(): Promise<void> {
  set(actionError, null)
  try {
    await plugin.request('openspec.init')
  } catch (err) {
    set(actionError, err instanceof Error ? err.message : String(err))
  }
}

export function setup(ctx: PanelContext): void {
  ctx.subscriptions.push(plugin.on('openspec.changed', (payload) => set(state, payload)))
  void load()
}

function progressText(done: number, total: number | null): string {
  return total === null ? 'no tasks' : `${done}/${total}`
}

export default function Panel() {
  const s = read(state)
  const err = read(actionError)
  if (!s) return <Spinner label="Loading OpenSpec" />

  const header = (
    <Row justify="between">
      <Heading>{s.workspace ?? 'OpenSpec'}</Heading>
      <Button variant="ghost" onPress={load}>
        Refresh
      </Button>
    </Row>
  )
  const errorBox = err ? <Callout tone="danger">{err}</Callout> : null

  if (s.status === 'no-workspace')
    return <EmptyState title="No workspace" description="Focus a workspace to see its OpenSpec changes." />
  if (s.status === 'remote')
    return (
      <Stack gap="md">
        {header}
        <EmptyState title="Remote workspace" description="Remote workspaces are not supported yet." />
      </Stack>
    )
  if (s.status === 'error')
    return (
      <Stack gap="md">
        {header}
        <Callout tone="danger">Could not read OpenSpec: {s.error}</Callout>
      </Stack>
    )
  if (s.status === 'no-openspec')
    return (
      <Stack gap="md">
        {header}
        <EmptyState title="OpenSpec is not set up" description="This workspace has no openspec/ folder.">
          <Button onPress={init}>Init OpenSpec</Button>
        </EmptyState>
        {errorBox}
      </Stack>
    )

  const sel = read(selected)
  const current = s.changes.find((c) => c.name === sel)?.name
  return (
    <Stack gap="md">
      {header}
      {errorBox}
      <Row justify="between">
        <Heading>Changes</Heading>
        <Button onPress={() => run('propose')}>New change</Button>
      </Row>
      {s.changes.length === 0 ? (
        <Text muted>No active changes.</Text>
      ) : (
        <List>
          {s.changes.map((c) => (
            <ListItem
              key={c.name}
              title={c.name}
              description={progressText(c.done, c.total)}
              current={c.name === current}
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
        <Row gap="xs">
          <Button onPress={() => run('apply', current)}>Apply</Button>
          <Button variant="ghost" onPress={() => run('verify', current)}>
            Verify
          </Button>
          <Button variant="ghost" onPress={() => run('archive', current)}>
            Archive
          </Button>
        </Row>
      ) : s.changes.length ? (
        <Text muted size="xs">
          Select a change to apply, verify or archive it.
        </Text>
      ) : null}
      <Row justify="between">
        <Heading>Specs</Heading>
        <Badge>{s.specs.length}</Badge>
      </Row>
      {s.specs.length === 0 ? (
        <Text muted>No specs yet.</Text>
      ) : (
        <List>
          {s.specs.map((name) => (
            <ListItem key={name} title={name} icon="file-text" />
          ))}
        </List>
      )}
    </Stack>
  )
}
