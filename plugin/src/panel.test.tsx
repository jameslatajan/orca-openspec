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

  await view.press({ label: 'New change' })
  assert.deepEqual(launches[3], { step: 'propose' })
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
