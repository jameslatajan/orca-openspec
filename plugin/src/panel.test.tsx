import { assert, mockHost, mount, test } from 'orca/testing'
import * as panel from './panel'
import type { OpenSpecState } from './protocol'

const ok: OpenSpecState = {
  status: 'ok',
  workspace: 'demo',
  changes: [
    { name: 'add-auth', done: 3, total: 5 },
    { name: 'billing-export', done: 4, total: 4 },
    { name: 'store-support', done: 0, total: null }
  ],
  specs: ['auth', 'billing/invoices']
}

function setupHost(extra: Record<string, unknown> = {}) {
  const launches: unknown[] = []
  const host = mockHost({
    requests: {
      'openspec.state': ok,
      'openspec.launch': (input) => (launches.push(input), { terminalId: 't1' }),
      'openspec.agents': { agents: ['claude', 'codex', 'gemini'], defaultAgent: 'claude' },
      ...extra
    }
  })
  return { host, launches }
}

test('lists changes with status and progress on the Changes tab', async () => {
  const { host } = setupHost()
  const view = await mount(panel, { host })
  assert.ok(view.find({ text: /Changes \(3\)/ }))
  assert.ok(view.find({ text: /In progress · 3\/5/ }))
  assert.ok(view.find({ text: /Ready to archive · 4\/4/ }))
  assert.ok(view.find({ text: /Planning · no tasks/ }))
  assert.deepEqual(view.errors, [])
  await view.unmount()
})

test('filters changes by chip and by name', async () => {
  const { host } = setupHost()
  const view = await mount(panel, { host })
  await view.press({ text: 'Done' })
  assert.ok(view.find({ label: 'billing-export' }))
  assert.equal(view.find({ label: 'add-auth' }), null)
  await view.press({ text: 'All' })
  await view.type({ label: 'Filter changes' }, 'AUTH')
  assert.ok(view.find({ label: 'add-auth' }))
  assert.equal(view.find({ label: 'billing-export' }), null)
  await view.type({ label: 'Filter changes' }, 'zzz', { replace: true })
  assert.ok(view.find({ text: 'No matching changes.' }))
  await view.unmount()
})

test('action bar: Apply and Verify, Archive only when ready', async () => {
  const { host, launches } = setupHost()
  const view = await mount(panel, { host })
  await view.press({ label: 'add-auth' })
  assert.ok(view.find({ text: 'Verify' }))
  assert.equal(view.find({ text: 'Archive' }), null)
  await view.press({ text: 'Apply' })
  await view.press({ text: 'Verify' })

  await view.press({ label: 'billing-export' })
  assert.equal(view.find({ text: 'Verify' }), null)
  await view.press({ text: 'Archive' })
  assert.deepEqual(launches, [
    { step: 'apply', change: 'add-auth' },
    { step: 'verify', change: 'add-auth' },
    { step: 'archive', change: 'billing-export' }
  ])
  assert.deepEqual(view.errors, [])
  await view.unmount()
})

test('Specs tab lists and filters specs', async () => {
  const { host } = setupHost()
  const view = await mount(panel, { host })
  await view.select({ label: 'OpenSpec views' }, 'specs')
  assert.ok(view.find({ label: 'auth' }))
  await view.type({ label: 'Filter specs' }, 'inv')
  assert.ok(view.find({ label: 'billing/invoices' }))
  assert.equal(view.find({ label: 'auth' }), null)
  await view.unmount()
})

test('shows the init empty state', async () => {
  let inits = 0
  const host = mockHost({
    requests: {
      'openspec.state': { status: 'no-openspec', workspace: 'demo', changes: [], specs: [] },
      'openspec.init': () => (inits++, { terminalId: 't2' })
    }
  })
  const view = await mount(panel, { host })
  assert.ok(view.find({ label: 'OpenSpec is not set up' }))
  await view.press({ text: 'Init OpenSpec' })
  assert.equal(inits, 1)
  await view.unmount()
})

test('shows no-workspace, remote and error states', async () => {
  for (const [status, label] of [
    ['no-workspace', 'No workspace'],
    ['remote', 'Remote workspace']
  ] as const) {
    const view = await mount(panel, {
      host: mockHost({ requests: { 'openspec.state': { status, changes: [], specs: [] } } })
    })
    assert.ok(view.find({ label }), status)
    await view.unmount()
  }
  const view = await mount(panel, {
    host: mockHost({
      requests: { 'openspec.state': { status: 'error', changes: [], specs: [], error: 'boom' } }
    })
  })
  assert.ok(view.find({ text: /boom/ }))
  await view.unmount()
})

test('updates when the worker posts new state', async () => {
  const { host } = setupHost()
  const view = await mount(panel, { host })
  await view.post('openspec.changed', { ...ok, changes: [{ name: 'add-auth', done: 5, total: 5 }] })
  assert.ok(view.find({ text: /Ready to archive · 5\/5/ }))
  await view.unmount()
})

test('Clear filters resets the chip and the name filter', async () => {
  const { host } = setupHost()
  const view = await mount(panel, { host })
  await view.type({ label: 'Filter changes' }, 'zzz')
  await view.press({ text: 'Done' })
  assert.ok(view.find({ text: 'No matching changes.' }))
  await view.press({ text: 'Clear filters' })
  assert.ok(view.find({ label: 'add-auth' }))
  assert.ok(view.find({ label: 'billing-export' }))
  await view.unmount()
})

test('New change opens a form; Explore sends the description and agent', async () => {
  const { host, launches } = setupHost()
  const view = await mount(panel, { host })
  await view.press({ label: 'New change' })
  assert.equal(launches.length, 0)
  assert.ok(view.find({ label: 'Describe the change' }))
  assert.equal(view.find({ text: 'Explore' })?.disabled, true)
  assert.equal(view.find({ text: 'Propose' })?.disabled, true)

  await view.type({ label: 'Describe the change' }, 'add dark mode')
  await view.select({ label: 'Agent' }, 'codex')
  assert.equal(view.find({ text: 'Explore' })?.disabled, false)
  await view.press({ text: 'Explore' })
  assert.deepEqual(launches, [{ step: 'explore', description: 'add dark mode', agent: 'codex' }])
  assert.equal(view.find({ label: 'Describe the change' }), null)
  assert.deepEqual(view.errors, [])
  await view.unmount()
})

test('Propose from the form, and Cancel closes without launching', async () => {
  const { host, launches } = setupHost()
  const view = await mount(panel, { host })
  await view.press({ label: 'New change' })
  await view.type({ label: 'Describe the change' }, 'billing export')
  await view.press({ text: 'Cancel' })
  assert.equal(view.find({ label: 'Describe the change' }), null)
  assert.equal(launches.length, 0)

  await view.press({ label: 'New change' })
  assert.equal(view.find({ text: 'Propose' })?.disabled, true) // description was cleared
  await view.type({ label: 'Describe the change' }, 'billing export')
  await view.press({ text: 'Propose' })
  assert.deepEqual(launches, [{ step: 'propose', description: 'billing export', agent: 'claude' }])
  await view.unmount()
})

test('a failed launch keeps the form open with the error', async () => {
  const { host } = setupHost({
    'openspec.launch': () => {
      throw new Error('agent not installed')
    }
  })
  const view = await mount(panel, { host })
  await view.press({ label: 'New change' })
  await view.type({ label: 'Describe the change' }, 'x')
  await view.press({ text: 'Explore' })
  assert.ok(view.find({ label: 'Describe the change' }))
  assert.ok(view.find({ text: /agent not installed/ }))
  await view.unmount()
})

test('the palette command opens the form', async () => {
  const { host } = setupHost()
  const view = await mount(panel, { host })
  await view.post('openspec.showForm', {})
  assert.ok(view.find({ label: 'Describe the change' }))
  await view.unmount()
})

test('Model picker shows only for claude and is sent with Explore', async () => {
  const { host, launches } = setupHost()
  const view = await mount(panel, { host })
  await view.press({ label: 'New change' })
  await view.select({ label: 'Agent' }, 'claude') // earlier tests leave the form on codex
  assert.ok(view.find({ label: 'Model' }))
  await view.select({ label: 'Agent' }, 'codex')
  assert.equal(view.find({ label: 'Model' }), null)
  await view.select({ label: 'Agent' }, 'claude')
  await view.select({ label: 'Model' }, 'sonnet')
  await view.type({ label: 'Describe the change' }, 'add dark mode')
  await view.press({ text: 'Explore' })
  assert.deepEqual(launches, [{ step: 'explore', description: 'add dark mode', agent: 'claude', model: 'sonnet' }])
  await view.unmount()
})
