import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assert, test } from 'orca/testing'
import { clearStoreCache, listStores, resolveStore, StoreError, storeIdFrom, writeStoreLink } from './store'

const twoStores = async () =>
  JSON.stringify({ stores: [{ id: 'isotech', root: 'C:\\stores\\isotech' }, { id: 'acme', root: '/s/acme' }] })

test('lists registered stores', async () => {
  clearStoreCache()
  assert.deepEqual(await listStores(twoStores), [
    { id: 'isotech', root: 'C:\\stores\\isotech' },
    { id: 'acme', root: '/s/acme' }
  ])
  clearStoreCache()
})

test('links a workspace by creating openspec/config.yaml', async () => {
  clearStoreCache()
  const ws = mkdtempSync(join(tmpdir(), 'link-'))
  const file = await writeStoreLink(ws, 'isotech', twoStores)
  assert.equal(readFileSync(file, 'utf8'), 'store: isotech\n')
  assert.equal(storeIdFrom(readFileSync(join(ws, 'openspec', 'config.yaml'), 'utf8')), 'isotech')
  clearStoreCache()
})

test('never overwrites a config and refuses unknown or unsafe ids', async () => {
  clearStoreCache()
  const ws = mkdtempSync(join(tmpdir(), 'link-'))
  mkdirSync(join(ws, 'openspec'))
  writeFileSync(join(ws, 'openspec', 'config.yml'), 'schema: spec-driven\n')
  await assert.rejects(writeStoreLink(ws, 'isotech', twoStores), /already has an OpenSpec config/)
  assert.equal(existsSync(join(ws, 'openspec', 'config.yaml')), false)

  const fresh = mkdtempSync(join(tmpdir(), 'link-'))
  await assert.rejects(writeStoreLink(fresh, 'missing', twoStores), /not registered/)
  await assert.rejects(writeStoreLink(fresh, 'bad\nstore: x', twoStores), /not a valid store id/)
  assert.equal(existsSync(join(fresh, 'openspec')), false)
  clearStoreCache()
})

test('reads a top-level store line, ignoring quotes and comments', () => {
  assert.equal(storeIdFrom('store: isotech\n'), 'isotech')
  assert.equal(storeIdFrom('schema: spec-driven\nstore: "isotech"  # shared\n'), 'isotech')
  assert.equal(storeIdFrom("store: 'isotech'\r\n"), 'isotech')
  assert.equal(storeIdFrom('schema: spec-driven\n'), null)
  assert.equal(storeIdFrom('# store: isotech\n'), null)
  assert.equal(storeIdFrom('rules:\n  store: nested\n'), null)
  assert.equal(storeIdFrom('store:\n'), null)
})

const listing = JSON.stringify({ stores: [{ id: 'isotech', root: 'C:\stores\isotech' }], status: [] })

test('resolves a registered store and caches the listing', async () => {
  clearStoreCache()
  let calls = 0
  const run = async () => (calls++, listing)
  assert.equal(await resolveStore('isotech', run), 'C:\stores\isotech')
  assert.equal(await resolveStore('isotech', run), 'C:\stores\isotech')
  assert.equal(calls, 1)
  clearStoreCache()
  await resolveStore('isotech', run)
  assert.equal(calls, 2)
})

test('names the fix for an unknown store or a missing CLI', async () => {
  clearStoreCache()
  await assert.rejects(resolveStore('missing', async () => listing), (err: unknown) => {
    assert.ok(err instanceof StoreError)
    assert.match((err as Error).message, /Store "missing" is not registered.*openspec store register/)
    return true
  })
  clearStoreCache()
  await assert.rejects(
    resolveStore('isotech', async () => {
      throw new Error('spawn openspec ENOENT')
    }),
    /openspec CLI is needed to resolve store "isotech"/
  )
  clearStoreCache()
})

import { createStore, setStoreLine } from './store'
import { hasOpenSpec } from './openspec'

test('creates a store with openspec store setup, refusing unsafe input first', async () => {
  const parent = mkdtempSync(join(tmpdir(), 'stores-'))
  const ran: string[] = []
  const run = async (line: string) => (ran.push(line), '{}')
  const folder = join(parent, 'openspec-his')
  assert.deepEqual(await createStore('his', folder, run), { id: 'his', root: folder })
  assert.deepEqual(ran, [`openspec store setup "his" --path "${folder}" --json`])

  await assert.rejects(createStore('bad id', folder, run), /letters, digits/)
  await assert.rejects(createStore('ok', join(parent, 'a&b'), run), /not allowed/)
  await assert.rejects(createStore('ok', 'relative/path', run), /full folder path/)
  await assert.rejects(createStore('ok', parent, run), /already exists/)
  await assert.rejects(
    createStore('ok', join(parent, 'new'), async () => {
      throw new Error('git not found')
    }),
    /Creating store "ok" failed: git not found/
  )
  assert.equal(ran.length, 1)
})

function linked(config: string): string {
  const ws = mkdtempSync(join(tmpdir(), 'ws-'))
  mkdirSync(join(ws, 'openspec'))
  writeFileSync(join(ws, 'openspec', 'config.yaml'), config)
  return ws
}

test('switches only the store line and keeps the rest of the config', async () => {
  clearStoreCache()
  const ws = linked('schema: spec-driven\r\nstore: isotech\r\n# note\r\n')
  await setStoreLine(ws, 'acme', twoStores)
  assert.equal(readFileSync(join(ws, 'openspec', 'config.yaml'), 'utf8'), 'schema: spec-driven\r\nstore: acme\r\n# note\r\n')
  await assert.rejects(setStoreLine(ws, 'missing', twoStores), /not registered/)
  clearStoreCache()
})

test('unlinks: removes the store line, deleting a config that held nothing else', async () => {
  clearStoreCache()
  const only = linked('store: isotech\n')
  await setStoreLine(only, null, twoStores)
  assert.equal(existsSync(join(only, 'openspec', 'config.yaml')), false)
  writeFileSync(join(only, 'openspec', 'board.openspec'), '#')
  assert.equal(hasOpenSpec(only), false) // board file alone is not "set up"

  const more = linked('schema: spec-driven\nstore: isotech\n')
  await setStoreLine(more, null, twoStores)
  assert.equal(readFileSync(join(more, 'openspec', 'config.yaml'), 'utf8'), 'schema: spec-driven\n')
  clearStoreCache()
})

test('a local OpenSpec root cannot change store', async () => {
  const ws = linked('schema: spec-driven\n')
  await assert.rejects(setStoreLine(ws, 'acme', twoStores), /not linked to a store/)
})
