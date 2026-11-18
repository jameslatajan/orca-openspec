// Derived view state for the panel: pure functions, unit-tested in view.test.ts.
import type { ChangeInfo } from './protocol'

export type Status = 'Planning' | 'Not started' | 'In progress' | 'Ready to archive'
export type Chip = 'all' | 'active' | 'done'

export function statusOf(c: ChangeInfo): Status {
  if (c.total === null) return 'Planning'
  if (c.total > 0 && c.done >= c.total) return 'Ready to archive'
  if (c.done === 0) return 'Not started'
  return 'In progress'
}

export function isReady(c: ChangeInfo): boolean {
  return statusOf(c) === 'Ready to archive'
}

export function matchesChip(c: ChangeInfo, chip: Chip): boolean {
  if (chip === 'active') return statusOf(c) === 'In progress'
  if (chip === 'done') return isReady(c)
  return true
}

export function filterByName<T>(items: readonly T[], text: string, name: (item: T) => string): T[] {
  const needle = text.trim().toLowerCase()
  return needle ? items.filter((i) => name(i).toLowerCase().includes(needle)) : [...items]
}

export function progressText(c: ChangeInfo): string {
  return c.total === null ? 'no tasks' : `${c.done}/${c.total}`
}

/** The system part of a change or spec name: the text before the first '-'. */
export function prefixOf(name: string): string {
  const i = name.indexOf('-')
  return (i > 0 ? name.slice(0, i) : name).toLowerCase()
}

/** Prefixes shared by at least `min` names: the store's systems (doh, ess, claims, …). */
export function knownPrefixes(names: readonly string[], min = 3): Set<string> {
  const counts = new Map<string, number>()
  for (const n of names) counts.set(prefixOf(n), (counts.get(prefixOf(n)) ?? 0) + 1)
  return new Set([...counts].filter(([, c]) => c >= min).map(([p]) => p))
}

/** Words of a workspace name that are known prefixes ("ACME CLAIMS" → ["claims"]). */
export function guessPrefixes(workspaceName: string, known: ReadonlySet<string>): string[] {
  const words = workspaceName.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  return [...new Set(words.filter((w) => known.has(w)))]
}

/** Parses the editable "claims, ess" text into a clean prefix list. */
export function parsePrefixes(text: string): string[] {
  return [...new Set(text.split(/[\s,]+/).map((p) => p.trim().toLowerCase()).filter(Boolean))]
}

/** Items of this system, and shared items (no known prefix). Other systems' items are dropped. */
export function splitBySystem<T>(
  items: readonly T[],
  prefixes: readonly string[],
  known: ReadonlySet<string>,
  nameOf: (item: T) => string
): { mine: T[]; shared: T[] } {
  const mineSet = new Set(prefixes.map((p) => p.toLowerCase()))
  const mine: T[] = []
  const shared: T[] = []
  for (const item of items) {
    const p = prefixOf(nameOf(item))
    if (mineSet.has(p)) mine.push(item)
    else if (!known.has(p)) shared.push(item)
  }
  return { mine, shared }
}

/** Rows drawn per batch in lazily loaded lists. */
export const BATCH = 40

/** The first `limit` items, and whether more remain. */
export function firstBatch<T>(items: readonly T[], limit: number): { rows: T[]; hasMore: boolean } {
  return { rows: items.slice(0, limit), hasMore: items.length > limit }
}
