import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assert, mockHost, mountWorker, test } from 'orca/testing'
import { countTasks, readChanges, readSpecs } from './openspec'
import { watchFolder } from './watch'
import * as main from './worker'

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'openspec-'))
  const w = (rel: string, text: string): void => {
    mkdirSync(join(root, rel, '..'), { recursive: true })
    writeFileSync(join(root, rel), text)
  }
  w('openspec/changes/add-auth/tasks.md', '- [x] a\n- [ X ] b\n- [x] c\n- [ ] d\n- [~] e\n')
  w('openspec/changes/no-tasks/proposal.md', '# p')
  w('openspec/changes/archive/old/tasks.md', '- [x] a')
  w('openspec/specs/auth/spec.md', '# auth')
  w('openspec/specs/billing/invoices/spec.md', '# inv')
  return root
}

// Launch timings for tests: poll fast, give up fast.
main.options.readyPollMs = 5
main.options.readyTimeoutMs = 200

const READY = { lines: ['  Claude Code', '', '❯ ', '  ⏵⏵ bypass permissions on'], truncated: false }

function host(path: string, settings: Record<string, string> = { agent: 'claude' }, extra: Record<string, unknown> = {}) {
  return mockHost({
    results: {
      'workspace.readContext': { workspaceId: 'w1', branch: 'main', displayName: 'demo', terminals: [] },
      'workspace.list': {
        workspaces: [{ id: 'w1', kind: 'folder', name: 'demo', path, branch: 'main', hostId: 'local' }],
        truncated: false
      },
      'agent.launch': { terminalId: 't1' },
      'terminal.create': { terminalId: 't2' },
      'terminal.focus': { focused: true },
      'terminal.read': READY,
      'terminal.sendText': { accepted: true },
      'notifications.show': { delivered: true },
      ...extra
    },
    settings
  })
}

const sent = (h: ReturnType<typeof host>) =>
  (h.callsOf('terminal.sendText') as { text: string; enter?: boolean }[]).map((c) => c.text)

test('counts task boxes the way OpenSpec does', () => {
  assert.deepEqual(countTasks('- [x] a\r\n- [ x] b\n- [ ] c\n- [-] d\n- []\nplain'), { done: 2, total: 5 })
})

test('reads changes and nested specs, skipping archive', () => {
  const root = fixture()
  assert.deepEqual(readChanges(root), [
    { name: 'add-auth', done: 3, total: 5 },
    { name: 'no-tasks', done: 0, total: null }
  ])
  assert.deepEqual(readSpecs(root), ['auth', 'billing/invoices'])
})

test('answers state, then launches, shows and types the command', async () => {
  const h = host(fixture())
  const worker = await mountWorker(main, { host: h })
  const state = (await worker.request('openspec.state')) as { status: string; changes: unknown[] }
  assert.equal(state.status, 'ok')
  assert.equal(state.changes.length, 2)
  await worker.request('openspec.launch', { step: 'apply', change: 'add-auth' })
  assert.deepEqual(h.callsOf('agent.launch'), [{ workspaceId: 'w1', agent: 'claude' }])
  assert.deepEqual(h.callsOf('terminal.focus'), [{ terminalId: 't1' }])
  assert.deepEqual(h.callsOf('terminal.sendText'), [
    { terminalId: 't1', text: '/openspec-apply-change add-auth', enter: true }
  ])
  const order = h.calls.map((c) => c.method).filter((m) => m.startsWith('agent.') || m.startsWith('terminal.'))
  assert.deepEqual([order[0], order[1], order[order.length - 1]], ['agent.launch', 'terminal.focus', 'terminal.sendText'])
  assert.deepEqual(worker.refusals, [])
  await worker.deactivate()
})

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

test('watchFolder calls onChange once per burst of writes', async () => {
  const root = fixture()
  let calls = 0
  const w = watchFolder(join(root, 'openspec'), () => calls++, () => {}, 100)
  const tasks = join(root, 'openspec/changes/add-auth/tasks.md')
  for (let i = 0; i < 5; i++) writeFileSync(tasks, `- [x] a\n- [ ] b${i}\n`)
  await wait(500)
  w.close()
  assert.equal(calls, 1)
})

test('posts fresh state once when a task is ticked on disk', async () => {
  const root = fixture()
  main.options.watchDelayMs = 100
  const worker = await mountWorker(main, { host: host(root) })
  await worker.request('openspec.state') // starts the watcher
  await wait(300) // let the initial watch and any startup events settle
  const before = worker.posts.length
  const tasks = join(root, 'openspec/changes/add-auth/tasks.md')
  writeFileSync(tasks, '- [x] a\n- [x] b\n- [x] c\n- [x] d\n- [~] e\n')
  await wait(600)
  const posts = worker.posts.slice(before).filter((p) => p.event === 'openspec.changed')
  assert.equal(posts.length, 1)
  const state = posts[0].payload as { changes: { name: string; done: number; total: number }[] }
  assert.deepEqual(state.changes[0], { name: 'add-auth', done: 4, total: 5 })
  await worker.deactivate()
  main.options.watchDelayMs = 300
})

test('reports no-openspec for a bare folder and inits it', async () => {
  const h = host(mkdtempSync(join(tmpdir(), 'bare-')))
  const worker = await mountWorker(main, { host: h })
  const state = (await worker.request('openspec.state')) as { status: string }
  assert.equal(state.status, 'no-openspec')
  await worker.request('openspec.init')
  assert.equal((h.callsOf('terminal.create')[0] as { command: string }).command, 'openspec init')
  await worker.deactivate()
})

test('builds skill prompts by default and opsx prompts on request', () => {
  assert.equal(main.promptFor('propose', undefined, 'skill'), '/openspec-propose')
  assert.equal(main.promptFor('apply', 'a', 'skill'), '/openspec-apply-change a')
  assert.equal(main.promptFor('verify', 'a', 'skill'), '/openspec-verify-change a')
  assert.equal(main.promptFor('archive', 'a', 'skill'), '/openspec-archive-change a')
  assert.equal(main.promptFor('apply', 'a', 'opsx'), '/opsx:apply a')
  assert.equal(main.promptFor('propose', undefined, 'opsx'), '/opsx:propose')
  assert.equal(main.promptFor('explore', 'idea', 'skill'), '/openspec-explore idea')
  assert.equal(main.promptFor('explore', 'idea', 'opsx'), '/opsx:explore idea')
  assert.equal(main.promptFor('explore', '  ', 'skill'), '/openspec-explore')
  assert.equal(main.commandStyleOf(undefined), 'skill')
  assert.equal(main.commandStyleOf('bogus'), 'skill')
  assert.equal(main.commandStyleOf('opsx'), 'opsx')
})

test('uses the commandStyle setting when launching', async () => {
  const h = host(fixture(), { agent: 'claude', commandStyle: 'opsx' })
  const worker = await mountWorker(main, { host: h })
  await worker.request('openspec.launch', { step: 'verify', change: 'add-auth' })
  assert.deepEqual(sent(h), ['/opsx:verify add-auth'])
  await worker.deactivate()
})

test('explores with the form description and the chosen agent', async () => {
  const h = host(fixture())
  const worker = await mountWorker(main, { host: h })
  await worker.request('openspec.launch', { step: 'explore', description: 'add dark\nmode', agent: 'codex' })
  assert.deepEqual(h.callsOf('agent.launch'), [{ workspaceId: 'w1', agent: 'codex' }])
  assert.deepEqual(sent(h), ['/openspec-explore add dark mode'])
  await worker.deactivate()
})

test('sends anyway and logs when the agent never looks ready', async () => {
  const h = host(fixture(), { agent: 'claude' }, { 'terminal.read': { lines: ['Starting…'], truncated: false } })
  const worker = await mountWorker(main, { host: h })
  await worker.request('openspec.launch', { step: 'propose', description: 'x' })
  assert.deepEqual(sent(h), ['/openspec-propose x'])
  assert.ok(worker.logs.some((l) => /did not look ready/.test(l)))
  await worker.deactivate()
})

test('a focus failure does not stop the launch', async () => {
  const h = host(fixture(), { agent: 'claude' }, {
    'terminal.focus': () => {
      throw Object.assign(new Error('no window'), { code: 'action_failed' })
    }
  })
  const worker = await mountWorker(main, { host: h })
  await worker.request('openspec.launch', { step: 'apply', change: 'add-auth' })
  assert.deepEqual(sent(h), ['/openspec-apply-change add-auth'])
  await worker.deactivate()
})

test('detects an agent input prompt', () => {
  assert.equal(main.isAgentReady(['banner', '❯ Try "edit"', 'status']), true)
  assert.equal(main.isAgentReady(['│ > ', 'footer']), true)
  assert.equal(main.isAgentReady(['Loading…', 'please wait']), false)
  assert.equal(main.isAgentReady([]), false)
})

test('offers agents with the default first', async () => {
  const worker = await mountWorker(main, { host: host(fixture(), { agent: 'gemini' }) })
  const res = (await worker.request('openspec.agents')) as { agents: string[]; defaultAgent: string }
  assert.equal(res.defaultAgent, 'gemini')
  assert.equal(res.agents[0], 'gemini')
  assert.equal(res.agents.filter((a) => a === 'gemini').length, 1)
  await worker.deactivate()
})

test('palette New change asks open panels to show the form', async () => {
  const h = host(fixture())
  const worker = await mountWorker(main, { host: h })
  await worker.command('openspec.propose')
  assert.ok(worker.posts.some((p) => p.event === 'openspec.showForm'))
  assert.equal(h.callsOf('agent.launch').length, 0)
  await worker.deactivate()
})

test('switches the Claude model before sending the command', async () => {
  const h = host(fixture())
  const worker = await mountWorker(main, { host: h })
  await worker.request('openspec.launch', { step: 'explore', description: 'add dark mode', agent: 'claude', model: 'sonnet' })
  assert.deepEqual(sent(h), ['/model sonnet', '/openspec-explore add dark mode'])
  await worker.deactivate()
})

test('sends no /model for the default, other agents, bad values or Apply', async () => {
  const h = host(fixture())
  const worker = await mountWorker(main, { host: h })
  await worker.request('openspec.launch', { step: 'explore', description: 'a', agent: 'claude' })
  await worker.request('openspec.launch', { step: 'explore', description: 'b', agent: 'codex', model: 'sonnet' })
  await worker.request('openspec.launch', { step: 'propose', description: 'c', agent: 'claude', model: 'gpt-5; rm -rf' })
  await worker.request('openspec.launch', { step: 'apply', change: 'add-auth', agent: 'claude', model: 'opus' })
  assert.deepEqual(sent(h), [
    '/openspec-explore a',
    '/openspec-explore b',
    '/openspec-propose c',
    '/openspec-apply-change add-auth'
  ])
  assert.equal(main.modelCommand('claude', 'haiku'), '/model haiku')
  assert.equal(main.modelCommand('claude', ''), null)
  await worker.deactivate()
})

function storeFixture(): { workspace: string; store: string } {
  const store = fixture() // a store is an ordinary folder with openspec/
  const workspace = mkdtempSync(join(tmpdir(), 'linked-'))
  mkdirSync(join(workspace, 'openspec'), { recursive: true })
  writeFileSync(join(workspace, 'openspec', 'config.yaml'), 'store: isotech\n')
  return { workspace, store }
}

const storeRunner = (store: string) => async () => JSON.stringify({ stores: [{ id: 'isotech', root: store }] })

test('reads changes and specs from the store a workspace points to', async () => {
  const { workspace, store } = storeFixture()
  const { clearStoreCache } = await import('./store')
  clearStoreCache()
  main.options.storeRunner = storeRunner(store)
  const worker = await mountWorker(main, { host: host(workspace) })
  const state = (await worker.request('openspec.state')) as {
    status: string
    store?: string
    changes: { name: string }[]
    specs: string[]
  }
  assert.equal(state.status, 'ok')
  assert.equal(state.store, 'isotech')
  assert.deepEqual(state.changes.map((c) => c.name), ['add-auth', 'no-tasks'])
  assert.deepEqual(state.specs, ['auth', 'billing/invoices'])
  await worker.deactivate()
})

test('reports an unknown store as an error with the fix', async () => {
  const { workspace } = storeFixture()
  const { clearStoreCache } = await import('./store')
  clearStoreCache()
  main.options.storeRunner = async () => JSON.stringify({ stores: [] })
  const worker = await mountWorker(main, { host: host(workspace) })
  const state = (await worker.request('openspec.state')) as { status: string; error?: string }
  assert.equal(state.status, 'error')
  assert.match(state.error ?? '', /Store "isotech" is not registered/)
  await worker.deactivate()
  clearStoreCache()
})

test('watches the store folder: a store edit refreshes the panel', async () => {
  const { workspace, store } = storeFixture()
  const { clearStoreCache } = await import('./store')
  clearStoreCache()
  main.options.storeRunner = storeRunner(store)
  main.options.watchDelayMs = 100
  const worker = await mountWorker(main, { host: host(workspace) })
  await worker.request('openspec.state') // starts the watcher on the store
  await wait(300)
  const before = worker.posts.length
  writeFileSync(join(store, 'openspec/changes/add-auth/tasks.md'), '- [x] a\n- [x] b\n')
  await wait(600)
  const posts = worker.posts.slice(before).filter((p) => p.event === 'openspec.changed')
  assert.equal(posts.length, 1)
  const state = posts[0].payload as { store?: string; changes: { name: string; done: number; total: number }[] }
  assert.equal(state.store, 'isotech')
  assert.deepEqual(state.changes[0], { name: 'add-auth', done: 2, total: 2 })
  await worker.deactivate()
  main.options.watchDelayMs = 300
  clearStoreCache()
})
