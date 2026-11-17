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
