import { assert, mockHost, mount, test } from 'orca/testing'
import * as panel from './panel'
import type { OpenSpecState } from './protocol'

const ok: OpenSpecState = {
  status: 'ok',
  workspace: 'demo',
  changes: [{ name: 'add-auth', done: 3, total: 5 }],
  specs: ['auth']
}

test('lists changes and specs, and applies the selected change', async () => {
  const launches: unknown[] = []
  const host = mockHost({
    requests: {
      'openspec.state': ok,
      'openspec.launch': (input) => (launches.push(input), { terminalId: 't1' })
    }
  })
  const view = await mount(panel, { host })
  assert.ok(view.find({ text: /3\/5/ }))
  assert.ok(view.find({ label: 'auth' }) ?? view.find({ text: 'auth' }))
  await view.press({ label: 'add-auth' })
  await view.press({ text: 'Apply' })
  assert.deepEqual(launches, [{ step: 'apply', change: 'add-auth' }])
  await view.press({ text: 'New change' })
  assert.deepEqual(launches[1], { step: 'propose' })
  assert.deepEqual(view.errors, [])
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
  const view = await mount(panel, { host: mockHost({ requests: { 'openspec.state': ok } }) })
  await view.post('openspec.changed', { ...ok, changes: [{ name: 'add-auth', done: 5, total: 5 }] })
  assert.ok(view.find({ text: /5\/5/ }))
  await view.unmount()
})
