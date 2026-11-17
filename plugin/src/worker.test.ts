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

function host(path: string) {
  return mockHost({
    results: {
      'workspace.readContext': { workspaceId: 'w1', branch: 'main', displayName: 'demo', terminals: [] },
      'workspace.list': {
        workspaces: [{ id: 'w1', kind: 'folder', name: 'demo', path, branch: 'main', hostId: 'local' }],
        truncated: false
      },
      'agent.launch': { terminalId: 't1' },
      'terminal.create': { terminalId: 't2' }
    },
    settings: { agent: 'claude' }
  })
}

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

test('answers state and launches /opsx agents', async () => {
  const h = host(fixture())
  const worker = await mountWorker(main, { host: h })
  const state = (await worker.request('openspec.state')) as { status: string; changes: unknown[] }
  assert.equal(state.status, 'ok')
  assert.equal(state.changes.length, 2)
  await worker.request('openspec.launch', { step: 'apply', change: 'add-auth' })
  assert.deepEqual(h.callsOf('agent.launch'), [
    { workspaceId: 'w1', agent: 'claude', prompt: '/openspec-apply-change add-auth' }
  ])
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
  assert.equal(main.commandStyleOf(undefined), 'skill')
  assert.equal(main.commandStyleOf('bogus'), 'skill')
  assert.equal(main.commandStyleOf('opsx'), 'opsx')
})

test('uses the commandStyle setting when launching', async () => {
  const h = mockHost({
    results: {
      'workspace.readContext': { workspaceId: 'w1', branch: 'main', displayName: 'demo', terminals: [] },
      'workspace.list': {
        workspaces: [{ id: 'w1', kind: 'folder', name: 'demo', path: fixture(), branch: 'main', hostId: 'local' }],
        truncated: false
      },
      'agent.launch': { terminalId: 't1' }
    },
    settings: { agent: 'claude', commandStyle: 'opsx' }
  })
  const worker = await mountWorker(main, { host: h })
  await worker.request('openspec.launch', { step: 'verify', change: 'add-auth' })
  assert.equal((h.callsOf('agent.launch')[0] as { prompt: string }).prompt, '/opsx:verify add-auth')
  await worker.deactivate()
})
