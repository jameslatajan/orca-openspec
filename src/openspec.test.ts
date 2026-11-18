import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assert, test } from 'orca/testing'
import { changeFiles, proposalSummary, readArchived, readChanges, resolveInside, specIndex } from './openspec'

function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'osd-'))
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(join(root, rel, '..'), { recursive: true })
    writeFileSync(join(root, rel), text)
  }
  return root
}

test('proposal summary is the first sentence of Why', () => {
  const text = '# Proposal\n\n## Why\n\n<!-- hint -->\nEmployees cannot print their LDNA. PETRU has an API.\nMore.\n\n## What Changes\n'
  assert.equal(proposalSummary(text), 'Employees cannot print their LDNA.')
  assert.equal(proposalSummary('# P\n\n## What Changes\n- x'), undefined)
  assert.equal(proposalSummary('## Why\n' + 'a'.repeat(300))?.length, 160)
})

test('active changes carry summary and created', () => {
  const root = tree({
    'openspec/changes/add-dark-mode/proposal.md': '## Why\nUsers want dark mode. Really.\n',
    'openspec/changes/add-dark-mode/.openspec.yaml': 'schema: spec-driven\ncreated: 2026-11-16\n',
    'openspec/changes/add-dark-mode/tasks.md': '- [x] 1.1 a\n- [ ] 1.2 b\n'
  })
  assert.deepEqual(readChanges(root), [
    { name: 'add-dark-mode', done: 1, total: 2, next: '1.2 b', summary: 'Users want dark mode.', created: '2026-11-16' }
  ])
})

test('archived changes are newest first, paged and filterable', () => {
  const files: Record<string, string> = {}
  for (let i = 1; i <= 5; i++) files[`openspec/changes/archive/2026-11-0${i}-change-${i}/tasks.md`] = '- [x] a\n'
  files['openspec/changes/archive/2026-11-03-change-3/proposal.md'] = '## Why\nFixes the invoice total.\n'
  const root = tree(files)
  const page = readArchived(root, 0, 2)
  assert.equal(page.total, 5)
  assert.deepEqual(page.items.map((c) => [c.name, c.folder, c.created]), [
    ['change-5', '2026-11-05-change-5', '2026-11-05'],
    ['change-4', '2026-11-04-change-4', '2026-11-04']
  ])
  assert.deepEqual(readArchived(root, 4, 2).items.map((c) => c.name), ['change-1'])
  const hit = readArchived(root, 0, 40, 'invoice')
  assert.deepEqual([hit.total, hit.items[0].name], [1, 'change-3'])
  assert.deepEqual(readArchived(tree({}), 0, 40), { items: [], total: 0 })
})

test('change files are grouped as docs, other and spec deltas', () => {
  const root = tree({
    'openspec/changes/add-dark-mode/proposal.md': '#',
    'openspec/changes/add-dark-mode/tasks.md': '#',
    'openspec/changes/add-dark-mode/agent/notes.md': '#',
    'openspec/changes/add-dark-mode/image.png': 'x',
    'openspec/changes/add-dark-mode/specs/ui-theme/spec.md': '#',
    'openspec/changes/add-dark-mode/specs/billing/invoices/spec.md': '#'
  })
  const r = changeFiles(root, 'add-dark-mode', false)
  assert.deepEqual(r.files.map((f) => [f.group, f.label, f.path]), [
    ['docs', 'proposal.md', 'changes/add-dark-mode/proposal.md'],
    ['docs', 'tasks.md', 'changes/add-dark-mode/tasks.md'],
    ['other', 'agent/notes.md', 'changes/add-dark-mode/agent/notes.md'],
    ['delta', 'billing/invoices', 'changes/add-dark-mode/specs/billing/invoices/spec.md'],
    ['delta', 'ui-theme', 'changes/add-dark-mode/specs/ui-theme/spec.md']
  ])
  assert.deepEqual(r.specs, ['billing/invoices', 'ui-theme'])
  assert.throws(() => changeFiles(root, '../x', false))
  assert.throws(() => changeFiles(root, 'missing', false))
})

test('spec index lists active and archived changes', () => {
  const root = tree({
    'openspec/changes/add-dark-mode/specs/ui-theme/spec.md': '#',
    'openspec/changes/archive/2026-10-01-first-theme/specs/ui-theme/spec.md': '#',
    'openspec/changes/archive/2026-10-01-first-theme/specs/auth/spec.md': '#'
  })
  const index = specIndex(root)
  assert.deepEqual(index.get('ui-theme'), [
    { name: 'add-dark-mode', folder: 'add-dark-mode', archived: false },
    { name: 'first-theme', folder: '2026-10-01-first-theme', archived: true }
  ])
  assert.equal(index.get('auth')?.length, 1)
})

test('file access stays inside openspec/', () => {
  const root = tree({ 'openspec/specs/a/spec.md': '#', 'src/worker.md': '#', 'openspec/config.yaml': 'x' })
  assert.ok(resolveInside(root, 'specs/a/spec.md').endsWith('spec.md'))
  assert.throws(() => resolveInside(root, '../src/worker.md'), /outside/)
  assert.throws(() => resolveInside(root, 'changes/../../src/worker.md'), /outside|No such/)
  assert.throws(() => resolveInside(root, join(root, 'openspec/specs/a/spec.md')), /relative/)
  assert.throws(() => resolveInside(root, 'config.yaml'), /markdown/)
  let linked = false
  try {
    symlinkSync(join(root, 'src', 'worker.md'), join(root, 'openspec', 'out.md'))
    linked = true
  } catch {
    // symlinks need extra rights on Windows; the `..` cases above still cover escaping
  }
  if (linked) assert.throws(() => resolveInside(root, 'out.md'), /outside/)
})
