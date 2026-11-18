import { assert, mockHost, mount, test } from 'orca/testing'
import * as panel from './panel'
import type { OpenSpecState } from './protocol'

const bareState: OpenSpecState = { status: 'no-openspec', workspace: 'ACME HR', changes: [], specs: [] }

test('not set up: link the workspace to a registered store', async () => {
  const links: unknown[] = []
  const linked: OpenSpecState = {
    status: 'ok',
    workspace: 'ACME HR',
    store: 'teamstore',
    changes: [{ name: 'hr-billing', done: 1, total: 2 }],
    specs: []
  }
  const host = mockHost({
    requests: {
      'openspec.state': bareState,
      'openspec.stores': { stores: [{ id: 'teamstore' }, { id: 'acme' }] },
      'openspec.linkStore': (input) => (links.push(input), linked)
    }
  })
  const view = await mount(panel, { host })
  assert.ok(view.find({ label: 'OpenSpec is not set up' }))
  assert.ok(view.find({ text: 'Or use a store' }))
  await view.select({ label: 'Store' }, 'teamstore')
  await view.press({ text: 'Link store' })
  assert.deepEqual(links, [{ store: 'teamstore' }])
  assert.ok(view.find({ text: 'via store teamstore' }))
  assert.equal(view.find({ label: 'OpenSpec is not set up' }), null)
  await view.unmount()
})

test('not set up: no stores registered shows how to register one', async () => {
  const host = mockHost({
    requests: { 'openspec.state': bareState, 'openspec.stores': { stores: [] } }
  })
  const view = await mount(panel, { host })
  assert.ok(view.find({ text: /No OpenSpec stores are registered/ }))
  assert.equal(view.find({ text: 'Link store' }), null)
  assert.ok(view.find({ text: 'Init OpenSpec' }))
  await view.unmount()
})

test('not set up: a failed link shows the error', async () => {
  const host = mockHost({
    requests: {
      'openspec.state': bareState,
      'openspec.stores': { stores: [{ id: 'teamstore' }] },
      'openspec.linkStore': () => {
        throw new Error('This workspace already has an OpenSpec config; it was left unchanged.')
      }
    }
  })
  const view = await mount(panel, { host })
  await view.press({ text: 'Link store' })
  assert.ok(view.find({ text: /already has an OpenSpec config/ }))
  await view.unmount()
})

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
  await view.select({ label: 'Status' }, 'done')
  assert.ok(view.find({ label: 'billing-export' }))
  assert.equal(view.find({ label: 'add-auth' }), null)
  await view.select({ label: 'Status' }, 'all')
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
  assert.deepEqual(view.rowsOf({ label: 'Specs' }), ['auth', 'billing/invoices'])
  await view.type({ label: 'Filter specs' }, 'inv')
  assert.deepEqual(view.rowsOf({ label: 'Specs' }), ['billing/invoices'])
  await view.type({ label: 'Filter specs' }, '', { replace: true })
  await view.unmount()
})

test('Specs load 40 at a time as the table scrolls, and a filter starts over', async () => {
  const many = Array.from({ length: 125 }, (_, i) => `spec-${String(i).padStart(3, '0')}`)
  const host = mockHost({ requests: { 'openspec.state': { ...ok, specs: many } } })
  const view = await mount(panel, { host })
  await view.select({ label: 'OpenSpec views' }, 'specs')
  assert.ok(view.find({ text: /Specs \(125\)/ }))
  assert.equal(view.rowsOf({ label: 'Specs' }).length, 40)
  await view.loadMore({ label: 'Specs' })
  assert.equal(view.rowsOf({ label: 'Specs' }).length, 80)
  await view.loadMore({ label: 'Specs' })
  await view.loadMore({ label: 'Specs' })
  assert.equal(view.rowsOf({ label: 'Specs' }).length, 125)

  await view.type({ label: 'Filter specs' }, 'spec-0')
  assert.equal(view.rowsOf({ label: 'Specs' }).length, 40) // 100 matches, first batch again
  await view.type({ label: 'Filter specs' }, '', { replace: true })
  await view.select({ label: 'OpenSpec views' }, 'changes')
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
  await view.select({ label: 'Status' }, 'done')
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

test('shows a "via store" badge for store workspaces', async () => {
  const { host } = setupHost({ 'openspec.state': { ...ok, store: 'teamstore' } })
  const view = await mount(panel, { host })
  assert.ok(view.find({ text: 'via store teamstore' }))
  await view.unmount()
})

test('Refresh shows a spinner, then the updated time', async () => {
  let finish: (v: OpenSpecState) => void = () => {}
  const { host } = setupHost({
    'openspec.refresh': () => new Promise<OpenSpecState>((r) => (finish = r))
  })
  const view = await mount(panel, { host })
  assert.match(String(view.find({ label: 'Refresh' })?.props.tooltip), /^Updated/)
  const pressing = view.press({ label: 'Refresh' })
  await new Promise((r) => setTimeout(r, 50))
  assert.ok(view.find({ label: 'Refreshing' }), 'spinner while refreshing')
  assert.equal(view.find({ label: 'Refresh' }), null)
  finish(ok)
  await pressing
  await new Promise((r) => setTimeout(r, panel.MIN_SPIN_MS + 100))
  await view.settled()
  assert.equal(view.find({ label: 'Refreshing' }), null)
  assert.ok(view.find({ label: 'Refresh' }))
  assert.deepEqual(view.errors, [])
  await view.unmount()
})

test('a failed Refresh shows the error', async () => {
  const { host } = setupHost({
    'openspec.refresh': () => {
      throw new Error('store list timed out')
    }
  })
  const view = await mount(panel, { host })
  await view.press({ label: 'Refresh' })
  await new Promise((r) => setTimeout(r, panel.MIN_SPIN_MS + 100))
  await view.settled()
  assert.ok(view.find({ text: /Refresh failed: store list timed out/ }))
  assert.ok(view.find({ label: 'Refresh' }))
  await view.unmount()
})

const storeState: OpenSpecState = {
  status: 'ok',
  workspace: 'ACME CLAIMS',
  store: 'teamstore',
  changes: [
    { name: 'claims-import', done: 1, total: 4 },
    { name: 'claims-fallback', done: 2, total: 4 },
    { name: 'ess-ldna-print', done: 8, total: 10 },
    { name: 'ess-sso', done: 0, total: 7 },
    { name: 'access-control-fix', done: 0, total: 2 }
  ],
  specs: ['claims-claims', 'ess-leave', 'ess-payslip', 'claims-batch', 'access-control', 'doh-report']
}

function storeHost(saved: string[] | null = null) {
  let prefixes = saved
  const saves: string[][] = []
  const host = mockHost({
    requests: {
      'openspec.state': storeState,
      'openspec.systemPrefixes': () => ({ prefixes }),
      'openspec.setSystemPrefixes': ({ prefixes: next }) => (saves.push(next), (prefixes = next), { prefixes: next })
    }
  })
  return { host, saves }
}

test('store workspace: This system shows its items plus Shared, hides other systems', async () => {
  const { host } = storeHost()
  const view = await mount(panel, { host })
  await view.select({ label: 'Scope' }, 'system')
  assert.equal(scopeLabel(view), 'claims')
  assert.ok(view.find({ text: /Changes \(3\)/ }))
  assert.ok(view.find({ label: 'claims-import' }))
  assert.ok(view.find({ label: 'access-control-fix' })) // shared
  assert.ok(view.find({ text: 'Shared' }))
  assert.equal(view.find({ label: 'ess-ldna-print' }), null)

  await view.select({ label: 'Scope' }, 'all')
  assert.ok(view.find({ text: /Changes \(5\)/ }))
  assert.ok(view.find({ label: 'ess-ldna-print' }))
  assert.equal(view.find({ text: 'Shared' }), null)
  await view.select({ label: 'Scope' }, 'system')
  await view.unmount()
})

test('store workspace: editing the system saves it and widens the list', async () => {
  const { host, saves } = storeHost()
  const view = await mount(panel, { host })
  await view.select({ label: 'Scope' }, 'system')
  await view.press({ label: 'Store settings' })
  await view.type({ label: 'System prefixes' }, 'claims, ess', { replace: true })
  await view.press({ text: 'Save' })
  assert.deepEqual(saves, [['claims', 'ess']])
  assert.equal(scopeLabel(view), 'claims, ess')
  assert.ok(view.find({ label: 'ess-ldna-print' }))
  assert.ok(view.find({ text: /Changes \(5\)/ }))
  await view.unmount()
})

test('store workspace: a saved system wins over the guess', async () => {
  const { host } = storeHost(['ess'])
  const view = await mount(panel, { host })
  await view.select({ label: 'Scope' }, 'system')
  assert.equal(scopeLabel(view), 'ess')
  assert.ok(view.find({ label: 'ess-sso' }))
  assert.equal(view.find({ label: 'claims-import' }), null)
  await view.unmount()
})

test('store workspace: the Specs table marks this system and shared specs', async () => {
  const { host } = storeHost()
  const view = await mount(panel, { host })
  await view.select({ label: 'Scope' }, 'system')
  await view.select({ label: 'OpenSpec views' }, 'specs')
  assert.deepEqual(view.rowsOf({ label: 'Specs' }), ['claims-claims', 'claims-batch', 'access-control', 'doh-report'])
  assert.deepEqual(view.columnsOf({ label: 'Specs' }), ['name', 'group'])
  await view.select({ label: 'Scope' }, 'all')
  assert.deepEqual(view.columnsOf({ label: 'Specs' }), ['name'])
  assert.equal(view.rowsOf({ label: 'Specs' }).length, 6)
  await view.select({ label: 'Scope' }, 'system')
  await view.select({ label: 'OpenSpec views' }, 'changes')
  await view.unmount()
})

test('local workspaces show no system bar', async () => {
  const { host } = setupHost()
  const view = await mount(panel, { host })
  assert.equal(view.find({ text: 'This system' }), null)
  await view.unmount()
})

test('the header board button opens the board', async () => {
  let opens = 0
  const { host } = setupHost({ 'openspec.openBoard': () => (opens++, { opened: true, message: 'Opened the OpenSpec board' }) })
  const view = await mount(panel, { host })
  await view.press({ label: 'Open board' })
  assert.equal(opens, 1)
  await view.unmount()
})

test('not set up: create a new store and link the workspace to it', async () => {
  const creates: unknown[] = []
  const linkedState: OpenSpecState = { status: 'ok', workspace: 'ACME HR', store: 'hr', changes: [], specs: [] }
  const host = mockHost({
    requests: {
      'openspec.state': bareState,
      'openspec.stores': { stores: [{ id: 'teamstore' }] },
      'openspec.storeDefaults': { parent: 'C:\\projects' },
      'openspec.createStore': (input) => (creates.push(input), linkedState)
    }
  })
  const view = await mount(panel, { host })
  await view.press({ text: 'New store' })
  await view.type({ label: 'Store id' }, 'hr')
  assert.equal(view.find({ label: 'Folder' })?.props.value, 'C:\\projects\\openspec-hr')
  await view.press({ text: 'Create store' })
  assert.deepEqual(creates, [{ id: 'hr', folder: 'C:\\projects\\openspec-hr', link: true }])
  assert.ok(view.find({ text: 'via store hr' }))
  await view.unmount()
})

test('store workspace: change store lets you switch or unlink', async () => {
  const sets: unknown[] = []
  let current: OpenSpecState = { ...storeState }
  const host = mockHost({
    requests: {
      'openspec.state': () => current,
      'openspec.systemPrefixes': { prefixes: null },
      'openspec.stores': { stores: [{ id: 'teamstore' }, { id: 'acme' }] },
      'openspec.setStore': ({ store }) => {
        sets.push(store)
        current = store ? { ...storeState, store } : { status: 'no-openspec', workspace: 'ACME CLAIMS', changes: [], specs: [] }
        return current
      }
    }
  })
  const view = await mount(panel, { host })
  await view.press({ label: 'Store settings' })
  assert.ok(view.find({ label: 'Store settings', type: 'Card' }) ?? view.find({ label: 'Store settings' }))
  await view.press({ text: 'Switch' })
  assert.deepEqual(sets, ['acme'])
  assert.ok(view.find({ text: 'via store acme' }))

  await view.press({ label: 'Store settings' })
  await view.press({ text: 'Unlink' })
  assert.deepEqual(sets, ['acme', null])
  assert.ok(view.find({ label: 'OpenSpec is not set up' }))
  await view.unmount()
})

test('local OpenSpec roots have no change-store control', async () => {
  const { host } = setupHost()
  const view = await mount(panel, { host })
  assert.equal(view.find({ label: 'Change store' }), null)
  await view.unmount()
})

/** The label of the scope dropdown's "this system" option. */
function scopeLabel(view: { find: (q: { label: string }) => { props: Record<string, unknown> } | null }): string {
  const options = view.find({ label: 'Scope' })?.props.options as { value: string; label: string }[]
  return options.find((o) => o.value === 'system')!.label
}
