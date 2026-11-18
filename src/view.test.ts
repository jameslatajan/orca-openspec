import { assert, test } from 'orca/testing'
import { filterByName, matchesChip, progressText, statusOf } from './view'

const planning = { name: 'store-support', done: 0, total: null }
const notStarted = { name: 'leave-sync', done: 0, total: 6 }
const inProgress = { name: 'add-auth', done: 3, total: 5 }
const ready = { name: 'billing-export', done: 12, total: 12 }
const emptyTasks = { name: 'empty', done: 0, total: 0 }

test('derives each status', () => {
  assert.equal(statusOf(planning), 'Planning')
  assert.equal(statusOf(notStarted), 'Not started')
  assert.equal(statusOf(inProgress), 'In progress')
  assert.equal(statusOf(ready), 'Ready to archive')
  assert.equal(statusOf(emptyTasks), 'Not started')
})

test('filters by chip', () => {
  const all = [planning, notStarted, inProgress, ready]
  assert.equal(all.filter((c) => matchesChip(c, 'all')).length, 4)
  assert.deepEqual(all.filter((c) => matchesChip(c, 'active')), [inProgress])
  assert.deepEqual(all.filter((c) => matchesChip(c, 'done')), [ready])
})

test('filters by name, case-insensitive', () => {
  const all = [planning, inProgress, ready]
  assert.deepEqual(filterByName(all, ' AUTH ', (c) => c.name), [inProgress])
  assert.equal(filterByName(all, '', (c) => c.name).length, 3)
  assert.deepEqual(filterByName(['auth', 'billing/invoices'], 'inv', (s) => s), ['billing/invoices'])
})

test('formats progress', () => {
  assert.equal(progressText(planning), 'no tasks')
  assert.equal(progressText(inProgress), '3/5')
})

import { guessPrefixes, knownPrefixes, parsePrefixes, prefixOf, splitBySystem } from './view'

const storeNames = [
  'claims-import', 'claims-fallback', 'claims-print',
  'ess-ldna-print', 'ess-sso', 'ess-leave',
  'access-control', 'absences-page', 'doh'
]

test('derives prefixes and the store systems', () => {
  assert.equal(prefixOf('claims-import'), 'claims')
  assert.equal(prefixOf('doh'), 'doh')
  assert.deepEqual([...knownPrefixes(storeNames)].sort(), ['claims', 'ess'])
})

test('guesses the system from the workspace name', () => {
  const known = knownPrefixes(storeNames)
  assert.deepEqual(guessPrefixes('ACME CLAIMS', known), ['claims'])
  assert.deepEqual(guessPrefixes('CRH ESS', known), ['ess'])
  assert.deepEqual(guessPrefixes('Orca Openspec', known), [])
})

test('parses an edited prefix list', () => {
  assert.deepEqual(parsePrefixes(' Claims, ess ,,ess '), ['claims', 'ess'])
  assert.deepEqual(parsePrefixes(''), [])
})

test('splits items into this system and shared, dropping other systems', () => {
  const known = knownPrefixes(storeNames)
  const { mine, shared } = splitBySystem(storeNames, ['claims'], known, (n) => n)
  assert.deepEqual(mine, ['claims-import', 'claims-fallback', 'claims-print'])
  assert.deepEqual(shared, ['access-control', 'absences-page', 'doh'])
})

import { BATCH, firstBatch } from './view'

test('cuts a list into its first batch', () => {
  const items = Array.from({ length: 125 }, (_, i) => `spec-${i}`)
  const first = firstBatch(items, BATCH)
  assert.equal(first.rows.length, 40)
  assert.equal(first.hasMore, true)
  assert.equal(firstBatch(items, 120).hasMore, true)
  assert.deepEqual(firstBatch(items, 160), { rows: items, hasMore: false })
  assert.deepEqual(firstBatch([], BATCH), { rows: [], hasMore: false })
})
