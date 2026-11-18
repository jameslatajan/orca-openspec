// Reads an openspec/ folder from disk. Pure Node, no Orca APIs, so it is unit-tested directly.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
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

export function readChanges(root: string): ChangeInfo[] {
  const base = join(root, 'openspec', 'changes')
  if (!existsSync(base)) return []
  return dirs(base)
    .filter((name) => name !== 'archive')
    .map((name) => {
      const tasks = join(base, name, 'tasks.md')
      if (!existsSync(tasks)) return { name, done: 0, total: null }
      const text = readFileSync(tasks, 'utf8')
      const next = nextTask(text)
      return next ? { name, ...countTasks(text), next } : { name, ...countTasks(text) }
    })
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
