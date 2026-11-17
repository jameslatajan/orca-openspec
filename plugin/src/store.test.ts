import { assert, test } from 'orca/testing'
import { clearStoreCache, resolveStore, StoreError, storeIdFrom } from './store'

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
