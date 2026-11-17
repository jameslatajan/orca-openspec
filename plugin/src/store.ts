// OpenSpec stores: a workspace's openspec/config.yaml may say `store: <id>`, meaning its changes
// and specs live in a registered store folder. Pure helpers plus a cached `openspec store list`.
import { exec } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** The top-level `store:` value in an OpenSpec config, or null. Ignores comments and quotes. */
export function storeIdFrom(configText: string): string | null {
  for (const raw of configText.split(/\r?\n/)) {
    const m = /^store:\s*(.*)$/.exec(raw) // top level only: no leading indent
    if (!m) continue
    const value = m[1].replace(/\s+#.*$/, '').trim().replace(/^(['"])(.*)\1$/, '$2').trim()
    return value || null
  }
  return null
}

/** Reads the workspace's openspec/config.yaml (or config.yml) and returns its store id, if any. */
export function workspaceStoreId(workspacePath: string): string | null {
  for (const name of ['config.yaml', 'config.yml']) {
    const file = join(workspacePath, 'openspec', name)
    if (existsSync(file)) return storeIdFrom(readFileSync(file, 'utf8'))
  }
  return null
}

/** Runs `openspec store list --json` and returns its stdout. Injectable for tests. */
export type StoreListRunner = () => Promise<string>

export const runOpenSpecStoreList: StoreListRunner = () =>
  new Promise((resolve, reject) => {
    // One fixed command string through the shell, so Windows finds openspec.cmd; no user text
    // is ever part of it.
    exec('openspec store list --json', { timeout: 15_000, windowsHide: true }, (err, stdout) =>
      err ? reject(err) : resolve(String(stdout))
    )
  })

export class StoreError extends Error {}

let cache: Map<string, string> | null = null

export function clearStoreCache(): void {
  cache = null
}

/** Registered stores (id → root), from the cached `openspec store list --json`. */
async function storeMap(run: StoreListRunner, purpose: string): Promise<Map<string, string>> {
  if (cache) return cache
  let out: string
  try {
    out = await run()
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err)
    throw new StoreError(`The openspec CLI is needed to ${purpose} (${why}).`)
  }
  try {
    const parsed = JSON.parse(out) as { stores?: { id?: unknown; root?: unknown }[] }
    cache = new Map(
      (parsed.stores ?? [])
        .filter((s) => typeof s.id === 'string' && typeof s.root === 'string')
        .map((s) => [s.id as string, s.root as string])
    )
    return cache
  } catch {
    throw new StoreError(`Could not read the output of \`openspec store list --json\` to ${purpose}.`)
  }
}

/** The stores registered on this machine. */
export async function listStores(run: StoreListRunner = runOpenSpecStoreList): Promise<{ id: string; root: string }[]> {
  return [...(await storeMap(run, 'list stores'))].map(([id, root]) => ({ id, root }))
}

/** Store ids that are safe to write into a config line. */
const STORE_ID = /^[A-Za-z0-9._-]+$/

/** Links a workspace to a registered store by creating openspec/config.yaml with `store: <id>`.
 *  Never overwrites: refuses when a config.yaml or config.yml already exists. */
export async function writeStoreLink(
  workspacePath: string,
  id: string,
  run: StoreListRunner = runOpenSpecStoreList
): Promise<string> {
  if (!STORE_ID.test(id)) throw new StoreError(`"${id}" is not a valid store id.`)
  const stores = await storeMap(run, `link store "${id}"`)
  if (!stores.has(id)) {
    throw new StoreError(`Store "${id}" is not registered on this machine. Run \`openspec store register <path>\`.`)
  }
  const dir = join(workspacePath, 'openspec')
  const file = join(dir, 'config.yaml')
  if (existsSync(file) || existsSync(join(dir, 'config.yml'))) {
    throw new StoreError('This workspace already has an OpenSpec config; it was left unchanged.')
  }
  mkdirSync(dir, { recursive: true })
  try {
    writeFileSync(file, `store: ${id}\n`, { flag: 'wx' }) // exclusive create: never overwrite
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new StoreError('This workspace already has an OpenSpec config; it was left unchanged.')
    }
    throw err
  }
  return file
}

/** The store's root folder for `id`. Throws StoreError with a message that names the fix. */
export async function resolveStore(id: string, run: StoreListRunner = runOpenSpecStoreList): Promise<string> {
  await storeMap(run, `resolve store "${id}"`)
  const root = cache!.get(id)
  if (!root) {
    throw new StoreError(`Store "${id}" is not registered on this machine. Run \`openspec store register <path>\`.`)
  }
  return root
}
