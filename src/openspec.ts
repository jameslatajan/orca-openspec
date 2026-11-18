// Reads an openspec/ folder from disk. Pure Node, no Orca APIs, so it is unit-tested directly.
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { isAbsolute, join, resolve, sep } from 'node:path'
import type { ChangeInfo } from './protocol'

const DONE = /^\s*[-*]\s+\[\s*[xX]\s*\]/
const BOX = /^\s*[-*]\s+\[[^\]]*\]/

/** Counts checked/total task boxes; a box holding only x (any case, any spacing) is done. */
export function countTasks(text: string): { done: number; total: number } {
  let done = 0
  let total = 0
  for (const line of text.split(/\r?\n/)) {
    if (!BOX.test(line)) continue
    total++
    if (DONE.test(line)) done++
  }
  return { done, total }
}

/** The text of the first task box that isn't checked (`- [ ] 3.1 Do it` → `3.1 Do it`), if any. */
export function nextTask(text: string): string | undefined {
  for (const line of text.split(/\r?\n/)) {
    if (BOX.test(line) && !DONE.test(line)) return line.replace(BOX, '').trim() || undefined
  }
  return undefined
}

function dirs(path: string): string[] {
  return readdirSync(path, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
}

/** OpenSpec is set up when openspec/ holds a config, changes/ or specs/. A folder holding only
 *  the board file or a .gitignore (left after unlinking a store) does not count. */
export function hasOpenSpec(root: string): boolean {
  const dir = join(root, 'openspec')
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return false
  return ['config.yaml', 'config.yml', 'changes', 'specs'].some((name) => existsSync(join(dir, name)))
}

/** The first sentence of the first paragraph under `## Why`, at most 160 characters. */
export function proposalSummary(text: string): string | undefined {
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex((l) => /^##\s+Why\b/i.test(l.trim()))
  if (start < 0) return undefined
  const para: string[] = []
  for (const line of lines.slice(start + 1)) {
    const t = line.trim()
    if (/^#/.test(t)) break
    if (!t || t.startsWith('<!--')) {
      if (para.length) break
      continue
    }
    para.push(t)
  }
  const joined = para.join(' ')
  if (!joined) return undefined
  const end = joined.search(/[.!?](\s|$)/)
  const sentence = end >= 0 ? joined.slice(0, end + 1) : joined
  return sentence.length > 160 ? sentence.slice(0, 159).trimEnd() + '…' : sentence
}

/** `created:` from a change's .openspec.yaml, when it is a YYYY-MM-DD date. */
function createdOf(dir: string): string | undefined {
  const file = join(dir, '.openspec.yaml')
  if (!existsSync(file)) return undefined
  const m = /^created:\s*["']?(\d{4}-\d{2}-\d{2})/m.exec(readFileSync(file, 'utf8'))
  return m?.[1]
}

export function readChange(dir: string, name: string, created?: string): ChangeInfo {
  const tasks = join(dir, 'tasks.md')
  const proposal = join(dir, 'proposal.md')
  const info: ChangeInfo = { name, done: 0, total: null }
  if (existsSync(tasks)) {
    const text = readFileSync(tasks, 'utf8')
    Object.assign(info, countTasks(text))
    const next = nextTask(text)
    if (next) info.next = next
  }
  const summary = existsSync(proposal) ? proposalSummary(readFileSync(proposal, 'utf8')) : undefined
  if (summary) info.summary = summary
  const date = created ?? createdOf(dir)
  if (date) info.created = date
  return info
}

export function readChanges(root: string): ChangeInfo[] {
  const base = join(root, 'openspec', 'changes')
  if (!existsSync(base)) return []
  return dirs(base)
    .filter((name) => name !== 'archive')
    .map((name) => readChange(join(base, name), name))
}

const ARCHIVED = /^(\d{4}-\d{2}-\d{2})-(.+)$/

/** Archived change folder names, newest first (by date prefix, then name). */
function archivedFolders(root: string): string[] {
  const base = join(root, 'openspec', 'changes', 'archive')
  if (!existsSync(base)) return []
  const dated = (n: string) => ARCHIVED.test(n)
  return dirs(base).sort((a, b) => {
    if (dated(a) !== dated(b)) return dated(a) ? -1 : 1 // undated folders go last, by name
    if (!dated(a)) return a.localeCompare(b)
    return a < b ? 1 : a > b ? -1 : 0
  })
}

/** A page of archived changes, newest first. `name` is the folder name without its date
 *  prefix; `folder` is the real folder name. `filter` matches name or summary. */
export function readArchived(
  root: string,
  offset: number,
  limit: number,
  filter = ''
): { items: (ChangeInfo & { folder: string })[]; total: number } {
  const base = join(root, 'openspec', 'changes', 'archive')
  const q = filter.trim().toLowerCase()
  let all = archivedFolders(root).map((folder) => {
    const m = ARCHIVED.exec(folder)
    return { folder, name: m ? m[2] : folder, date: m?.[1] }
  })
  if (q) {
    all = all.filter((a) => {
      if (a.name.toLowerCase().includes(q)) return true
      const p = join(base, a.folder, 'proposal.md')
      return existsSync(p) && (proposalSummary(readFileSync(p, 'utf8')) ?? '').toLowerCase().includes(q)
    })
  }
  const items = all
    .slice(Math.max(0, offset), Math.max(0, offset) + Math.max(0, limit))
    .map((a) => ({ ...readChange(join(base, a.folder), a.name, a.date), folder: a.folder }))
  return { items, total: all.length }
}

export type FileGroup = 'docs' | 'other' | 'delta'
export type ChangeFile = { path: string; group: FileGroup; label: string }

const DOCS = ['proposal.md', 'design.md', 'tasks.md']

/** Markdown files of a change, relative to `openspec/`, grouped for the board's tabs. */
export function changeFiles(root: string, folder: string, archived: boolean): { files: ChangeFile[]; specs: string[] } {
  if (!/^[^/\\]+$/.test(folder) || folder === '.' || folder === '..') throw new Error(`Invalid change name: ${folder}`)
  const rel = archived ? `changes/archive/${folder}` : `changes/${folder}`
  const dir = join(root, 'openspec', rel)
  if (!existsSync(dir)) throw new Error(`No such change: ${folder}`)
  const docs: ChangeFile[] = DOCS.filter((f) => existsSync(join(dir, f))).map((f) => ({
    path: `${rel}/${f}`,
    group: 'docs',
    label: f
  }))
  const other: ChangeFile[] = []
  const deltas: ChangeFile[] = []
  const specs: string[] = []
  const walk = (sub: string): void => {
    for (const e of readdirSync(join(dir, sub), { withFileTypes: true })) {
      const p = sub ? `${sub}/${e.name}` : e.name
      if (e.isDirectory()) {
        if (!sub && e.name === 'specs') continue
        walk(p)
      } else if (e.name.toLowerCase().endsWith('.md') && !(DOCS.includes(p))) {
        other.push({ path: `${rel}/${p}`, group: 'other', label: p })
      }
    }
  }
  walk('')
  const specsDir = join(dir, 'specs')
  const walkSpecs = (d: string, prefix: string): void => {
    if (!existsSync(d)) return
    for (const name of dirs(d)) {
      const cap = prefix ? `${prefix}/${name}` : name
      if (existsSync(join(d, name, 'spec.md'))) {
        specs.push(cap)
        deltas.push({ path: `${rel}/specs/${cap}/spec.md`, group: 'delta', label: cap })
      }
      walkSpecs(join(d, name), cap)
    }
  }
  walkSpecs(specsDir, '')
  other.sort((a, b) => a.label.localeCompare(b.label))
  return { files: [...docs, ...other, ...deltas], specs }
}

export type SpecUse = { name: string; folder: string; archived: boolean }

/** Spec capability → changes (active and archived) carrying a delta for it. Directory walks only. */
export function specIndex(root: string): Map<string, SpecUse[]> {
  const index = new Map<string, SpecUse[]>()
  const add = (dir: string, use: SpecUse): void => {
    const walk = (d: string, prefix: string): void => {
      if (!existsSync(d)) return
      for (const name of dirs(d)) {
        const cap = prefix ? `${prefix}/${name}` : name
        if (existsSync(join(d, name, 'spec.md'))) {
          const list = index.get(cap) ?? []
          list.push(use)
          index.set(cap, list)
        }
        walk(join(d, name), cap)
      }
    }
    walk(join(dir, 'specs'), '')
  }
  const base = join(root, 'openspec', 'changes')
  if (!existsSync(base)) return index
  for (const name of dirs(base)) if (name !== 'archive') add(join(base, name), { name, folder: name, archived: false })
  for (const folder of archivedFolders(root)) {
    const m = ARCHIVED.exec(folder)
    add(join(base, 'archive', folder), { name: m ? m[2] : folder, folder, archived: true })
  }
  return index
}

/** Resolves `rel` (relative to `openspec/`) to an absolute path, or throws when it is not a
 *  markdown file inside `openspec/` (after following symlinks). */
export function resolveInside(root: string, rel: string): string {
  const base = join(root, 'openspec')
  if (typeof rel !== 'string' || !rel || isAbsolute(rel) || /^[a-zA-Z]:/.test(rel)) {
    throw new Error('Path must be relative to openspec/.')
  }
  if (!rel.toLowerCase().endsWith('.md')) throw new Error('Only markdown files can be opened from the board.')
  const target = resolve(base, rel)
  if (!existsSync(target)) throw new Error(`No such file: openspec/${rel}`)
  const realBase = realpathSync(base)
  const real = realpathSync(target)
  if (!real.startsWith(realBase + sep)) throw new Error('That file is outside openspec/.')
  return real
}

/** Capability paths with a spec.md, nested ones included (`billing/invoices`). */
export function readSpecs(root: string): string[] {
  const base = join(root, 'openspec', 'specs')
  const out: string[] = []
  const walk = (dir: string, prefix: string): void => {
    if (!existsSync(dir)) return
    for (const name of dirs(dir)) {
      const rel = prefix ? `${prefix}/${name}` : name
      if (existsSync(join(dir, name, 'spec.md'))) out.push(rel)
      walk(join(dir, name), rel)
    }
  }
  walk(base, '')
  return out
}
