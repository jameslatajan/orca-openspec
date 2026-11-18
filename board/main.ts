// The OpenSpec board: a Kanban view of the focused workspace's changes, opened as a main-area
// editor tab for `openspec/board.openspec`. Plain DOM (custom editors get no Orca components).
// Data, live updates and agent launches all go through the same worker as the sidebar panel.
// Views: the board, a change's detail page and a spec's detail page. File content is rendered by
// ./markdown with text nodes only.
import type {
  ArchivedInfo,
  ChangeFileInfo,
  ChangeInfo,
  OpenSpecState,
  OpsxStep,
  SpecUseInfo
} from '../src/protocol'
import {
  BATCH,
  filterByName,
  firstBatch,
  guessPrefixes,
  knownPrefixes,
  splitBySystem,
  statusOf,
  type Status
} from '../src/view'
import { parse, toDom } from './markdown'

const COLUMNS: { status: Status; title: string; color: string }[] = [
  { status: 'Planning', title: 'Planning', color: '#E8A15A' },
  { status: 'Not started', title: 'Not started', color: '#8A8A92' },
  { status: 'In progress', title: 'In progress', color: 'var(--orca-primary)' },
  { status: 'Ready to archive', title: 'Ready to archive', color: '#4CC38A' }
]
const ARCHIVED_COLOR = '#A78BFA'

const CSS = `
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body { margin: 0; height: 100vh; display: flex; flex-direction: column; background: var(--orca-background);
  color: var(--orca-foreground); font: 13px/1.45 var(--orca-font-sans, system-ui, sans-serif); }
button, input, textarea { font: inherit; color: inherit; }
button { cursor: pointer; }
.muted { color: var(--orca-muted-foreground); }
header { display: flex; align-items: center; gap: 12px; padding: 10px 18px; border-bottom: 1px solid var(--orca-border); flex-wrap: wrap; }
.title { all: unset; cursor: pointer; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.title:focus-visible { outline: 2px solid var(--orca-primary); outline-offset: 2px; border-radius: 4px; }
.title b { font-size: 15px; }
.title span { font-size: 11px; }
.seg { display: flex; gap: 4px; align-items: center; }
.btn { height: 28px; padding: 0 11px; border-radius: 7px; border: 1px solid var(--orca-border); background: transparent; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.btn:hover { border-color: var(--orca-primary); }
.btn.on, .btn.primary { background: var(--orca-primary); color: var(--orca-primary-foreground); border-color: transparent; font-weight: 600; }
.btn.ghost { border-color: transparent; color: var(--orca-muted-foreground); }
.btn.ghost:hover { color: var(--orca-foreground); background: var(--orca-muted); }
.btn.danger { background: var(--orca-destructive, #DC4A4A); color: #fff; border-color: transparent; font-weight: 600; }
.btn.sm { height: 24px; padding: 0 8px; font-size: 11px; }
.btn:disabled { opacity: .5; cursor: default; }
.search { height: 30px; width: 260px; padding: 0 10px; border-radius: 7px; border: 1px solid var(--orca-border); background: var(--orca-input, transparent); }
.spacer { flex: 1; }
.form { display: none; gap: 8px; padding: 10px 18px; border-bottom: 1px solid var(--orca-border); align-items: flex-start; }
.form.open { display: flex; }
.form textarea { flex: 1; min-height: 56px; padding: 8px; border-radius: 6px; border: 1px solid var(--orca-border); background: var(--orca-input, transparent); resize: vertical; }
.error { padding: 8px 18px; color: var(--orca-destructive); display: none; }
.error.show { display: block; }
.body { flex: 1; min-height: 0; display: flex; position: relative; }
.pane { flex: 1; min-width: 0; overflow: auto; }
.hidden { display: none !important; }
/* board */
.cols { display: grid; grid-template-columns: repeat(5, minmax(210px, 1fr)); gap: 12px; padding: 14px 18px; min-width: 1100px; }
.col { display: flex; flex-direction: column; gap: 8px; min-width: 0; background: var(--orca-card); color: var(--orca-card-foreground); border: 1px solid var(--orca-border); border-radius: 10px; padding: 10px; align-self: start; }
.colhead { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 600; letter-spacing: .03em; text-transform: uppercase; }
.colhead button { all: unset; cursor: pointer; display: flex; gap: 8px; align-items: center; flex: 1; }
.dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.count { margin-left: auto; padding: 1px 7px; border-radius: 999px; background: var(--orca-muted); font-weight: 500; }
.card { position: relative; display: flex; flex-direction: column; gap: 6px; padding: 10px; border-radius: 8px; border: 1px solid var(--orca-border); background: var(--orca-background); }
.card:hover, .card:focus-within { border-color: var(--orca-primary); }
.card .open { all: unset; cursor: pointer; display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.card .open:focus-visible { outline: 2px solid var(--orca-primary); outline-offset: 4px; border-radius: 4px; }
.name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.summary { font-size: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.meta { display: flex; align-items: center; gap: 8px; font-size: 11px; }
.meta .date { margin-left: auto; }
.bar { width: 64px; height: 5px; border-radius: 3px; background: var(--orca-muted); overflow: hidden; flex: none; }
.bar i { display: block; height: 100%; background: #4CC38A; }
.next { font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.quick { display: none; gap: 6px; }
.card:hover .quick, .card:focus-within .quick { display: flex; }
.empty { font-size: 12px; padding: 18px 6px; text-align: center; border: 1px dashed var(--orca-border); border-radius: 8px; }
.more { font-size: 12px; text-align: center; padding: 6px; }
/* detail */
.detail { max-width: 1180px; margin: 0 auto; padding: 14px 18px 30px; }
.crumb { display: flex; gap: 6px; align-items: center; font-size: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.crumb a { cursor: pointer; text-decoration: none; color: var(--orca-muted-foreground); }
.crumb a:hover { color: var(--orca-foreground); }
.crumb .esc { margin-left: auto; }
.hero { border: 1px solid var(--orca-border); border-radius: 12px; background: var(--orca-card); padding: 16px 18px; display: flex; gap: 14px; flex-wrap: wrap; align-items: flex-start; }
.hero h2 { margin: 0; font-size: 19px; word-break: break-word; }
.hero .left { flex: 1; min-width: 240px; display: flex; flex-direction: column; gap: 9px; }
.status { display: inline-flex; padding: 1px 9px; border-radius: 999px; font-size: 11px; font-weight: 600; border: 1px solid currentColor; }
.sub { display: flex; gap: 14px; align-items: center; font-size: 12px; flex-wrap: wrap; }
.sub .bar { width: 140px; height: 6px; }
.chips { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; font-size: 12px; }
.chip { padding: 1px 8px; border-radius: 6px; border: 1px solid var(--orca-border); font: 11px var(--orca-font-mono, ui-monospace, monospace); background: var(--orca-muted); }
.actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.sep { width: 1px; height: 20px; background: var(--orca-border); }
.layout { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 16px; margin-top: 14px; align-items: start; }
.doc { border: 1px solid var(--orca-border); border-radius: 12px; background: var(--orca-card); overflow: hidden; min-width: 0; }
.tabs { display: flex; gap: 4px; align-items: center; padding: 8px 10px; border-bottom: 1px solid var(--orca-border); overflow-x: auto; }
.tabs .grp { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; padding: 0 4px 0 10px; color: var(--orca-muted-foreground); white-space: nowrap; }
.tabs .grp:first-child { padding-left: 2px; }
.tab { border: 1px solid transparent; background: none; color: var(--orca-muted-foreground); padding: 4px 10px; border-radius: 6px; font-size: 12px; white-space: nowrap; }
.tab:hover { color: var(--orca-foreground); }
.tab.on { color: var(--orca-foreground); background: var(--orca-background); border-color: var(--orca-border); font-weight: 600; }
.pathbar { display: flex; align-items: center; gap: 8px; padding: 6px 16px; border-bottom: 1px solid var(--orca-border); font: 11px var(--orca-font-mono, ui-monospace, monospace); }
.pathbar span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.md { padding: 4px 22px 22px; max-width: 800px; overflow-wrap: anywhere; }
.md h1 { font-size: 18px; } .md h2 { font-size: 16px; margin-top: 20px; } .md h3 { font-size: 14px; margin-top: 16px; } .md h4 { font-size: 13px; margin: 0 0 6px; }
.md p, .md li { line-height: 1.6; }
.md code { font: 12px var(--orca-font-mono, ui-monospace, monospace); background: var(--orca-muted); padding: 1px 5px; border-radius: 4px; }
.md pre { background: var(--orca-muted); padding: 10px 12px; border-radius: 8px; overflow: auto; font: 12px var(--orca-font-mono, ui-monospace, monospace); }
.md pre code { background: none; padding: 0; }
.md .requirement { border-left: 3px solid ${ARCHIVED_COLOR}; padding-left: 10px; }
.md .scenario { border: 1px solid var(--orca-border); border-radius: 8px; padding: 10px 12px; margin: 10px 0; }
.md .scenario ul { margin: 0; padding-left: 18px; }
.md .kw { font-weight: 700; color: #E8A15A; }
.md .link { text-decoration: underline; }
.md blockquote { margin: 8px 0; padding-left: 10px; border-left: 3px solid var(--orca-border); color: var(--orca-muted-foreground); }
.md li.task { list-style: none; margin-left: -20px; padding-left: 24px; position: relative; }
.md li.task .chk { position: absolute; left: 0; top: .3em; width: 14px; height: 14px; border-radius: 4px; border: 1.5px solid var(--orca-border); display: grid; place-items: center; font-size: 10px; line-height: 1; }
.md li.task .chk.on { background: #4CC38A; border-color: #4CC38A; color: #06210F; }
.md li.task.done { color: var(--orca-muted-foreground); }
.side { display: flex; flex-direction: column; gap: 12px; position: sticky; top: 0; }
.box { border: 1px solid var(--orca-border); border-radius: 12px; background: var(--orca-card); padding: 12px 14px; }
.box h4 { margin: 0 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--orca-muted-foreground); }
.kv { display: flex; justify-content: space-between; gap: 8px; padding: 3px 0; font-size: 12px; }
.kv span:last-child { text-align: right; overflow-wrap: anywhere; }
.rel { all: unset; cursor: pointer; display: block; padding: 7px 9px; border-radius: 7px; border: 1px solid var(--orca-border); margin-top: 6px; font-size: 12px; overflow-wrap: anywhere; }
.rel:hover, .rel:focus-visible { border-color: var(--orca-primary); }
.rel small { display: block; color: var(--orca-muted-foreground); }
/* specs drawer */
.drawer { width: 300px; flex: none; border-left: 1px solid var(--orca-border); display: flex; flex-direction: column; min-height: 0; background: var(--orca-background); }
.drawer .head { padding: 12px 14px 8px; display: flex; gap: 8px; align-items: center; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; }
.drawer .search { width: auto; margin: 0 14px 8px; }
.drawer ul { list-style: none; margin: 0; padding: 0 8px 8px; overflow: auto; flex: 1; }
.drawer li { display: flex; gap: 8px; padding: 6px 8px; border-radius: 6px; font-size: 12px; }
.drawer li button { all: unset; cursor: pointer; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.drawer li:hover { background: var(--orca-muted); }
.tag { font-size: 10px; }
.notice { padding: 40px; text-align: center; }
/* dialog */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: grid; place-items: center; padding: 16px; z-index: 10; }
.dialog { width: 100%; max-width: 460px; background: var(--orca-card); color: var(--orca-card-foreground); border: 1px solid var(--orca-border); border-radius: 12px; padding: 18px 20px; box-shadow: 0 20px 50px rgba(0,0,0,.4); }
.dialog h3 { margin: 0 0 8px; font-size: 15px; overflow-wrap: anywhere; }
.dialog p { margin: 0 0 12px; color: var(--orca-muted-foreground); line-height: 1.55; }
.dialog code { font: 11px var(--orca-font-mono, ui-monospace, monospace); background: var(--orca-muted); padding: 1px 5px; border-radius: 4px; color: var(--orca-foreground); overflow-wrap: anywhere; }
.warn { border: 1px solid #E8A15A; color: #E8A15A; border-radius: 8px; padding: 8px 10px; font-size: 12px; margin-bottom: 12px; }
.dialog .row { display: flex; justify-content: flex-end; gap: 8px; }
@media (max-width: 820px) { .layout { grid-template-columns: 1fr; } .side { position: static; } }
`

/** Element helper: el('div', { class: 'x' }, child, 'text'). Text always goes in as text nodes. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  for (const child of children) if (child !== null && child !== undefined && child !== false) node.append(child)
  return node
}

function button(label: string, cls: string, onClick: () => void, aria?: string): HTMLButtonElement {
  const b = el('button', aria ? { class: cls, 'aria-label': aria } : { class: cls }, label)
  b.addEventListener('click', (e) => {
    e.stopPropagation()
    onClick()
  })
  return b
}

type View =
  | { kind: 'board' }
  | { kind: 'change'; folder: string; archived: boolean; tab: string | null }
  | { kind: 'spec'; name: string }

let state: OpenSpecState | null = null
let savedPrefixes: string[] | null = null
let prefixesFor: string | null = null
let mode: 'system' | 'all' = 'system'
let filter = ''
let specFilter = ''
let specLimit = BATCH
let busy = false
let current: View = { kind: 'board' }
/** Bumped on every navigation, so a slow response for an old view is dropped. */
let navSeq = 0
let archived: { open: boolean; items: ArchivedInfo[]; total: number; limit: number; loading: boolean } = {
  open: false,
  items: [],
  total: 0,
  limit: BATCH,
  loading: false
}

const style = el('style')
style.textContent = CSS
document.head.append(style)

const titleName = el('b', {}, 'OpenSpec')
const titleSub = el('span', { class: 'muted' })
const titleBtn = el('button', { class: 'title', title: 'Back to the board' }, titleName, titleSub)
const modeBox = el('div', { class: 'seg' })
const search = el('input', { class: 'search', type: 'search', placeholder: 'Filter changes', 'aria-label': 'Filter changes' })
const newBtn = el('button', { class: 'btn primary' }, '+ New change')
const specsBtn = el('button', { class: 'btn', 'aria-expanded': 'false' }, 'Specs')
const refreshBtn = el('button', { class: 'btn', 'aria-label': 'Refresh' }, '↻ Refresh')
const header = el('header', {}, titleBtn, modeBox, el('div', { class: 'spacer' }), search, newBtn, specsBtn, refreshBtn)

const formText = el('textarea', { placeholder: 'Describe the change…', 'aria-label': 'Describe the change' })
const exploreBtn = el('button', { class: 'btn primary' }, 'Explore')
const proposeBtn = el('button', { class: 'btn' }, 'Propose')
const cancelBtn = el('button', { class: 'btn' }, 'Cancel')
const form = el('div', { class: 'form' }, formText, el('div', { class: 'actions' }, exploreBtn, proposeBtn, cancelBtn))

const errorBox = el('div', { class: 'error', role: 'alert' })
const boardPane = el('div', { class: 'pane' })
const columnsEl = el('main', { class: 'cols', 'aria-label': 'Changes by status' })
boardPane.append(columnsEl)
const detailPane = el('div', { class: 'pane hidden' })
const specCount = el('span', { class: 'count' })
const specSearch = el('input', { class: 'search', type: 'search', placeholder: 'Filter specs', 'aria-label': 'Filter specs' })
const specList = el('ul', { 'aria-label': 'Specs' })
const drawer = el(
  'aside',
  { class: 'drawer hidden', 'aria-label': 'Specs' },
  el('div', { class: 'head' }, el('span', {}, 'Specs'), specCount, el('span', { class: 'spacer' }), button('✕', 'btn ghost sm', () => toggleDrawer(false), 'Close specs')),
  specSearch,
  specList
)
const body = el('div', { class: 'body' }, boardPane, detailPane, drawer)
document.body.append(header, form, errorBox, body)

function showError(message: string | null): void {
  errorBox.textContent = message ?? ''
  errorBox.classList.toggle('show', Boolean(message))
}

async function call<T>(fn: () => Promise<T>): Promise<T | undefined> {
  showError(null)
  try {
    return await fn()
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err))
    return undefined
  }
}

const launch = (step: OpsxStep, change?: string) =>
  call(() => orca.plugin.request('openspec.launch', change ? { step, change } : { step }))

const pct = (c: ChangeInfo) => (c.total ? Math.round((100 * c.done) / c.total) : 0)
const progress = (c: ChangeInfo) => (c.total === null ? 'no tasks' : `${c.done}/${c.total}`)

function bar(c: ChangeInfo): HTMLElement {
  const b = el('span', { class: 'bar', 'aria-hidden': 'true' }, el('i'))
  ;(b.firstChild as HTMLElement).style.width = `${pct(c)}%`
  return b
}

function dot(color: string): HTMLElement {
  const d = el('span', { class: 'dot' })
  d.style.background = color
  return d
}

/** The changes and specs to show, after the store system filter. */
function view(s: OpenSpecState) {
  if (!s.store || mode === 'all') return { changes: s.changes, specs: s.specs.map((n) => ({ name: n, tag: '' })), prefixes: null }
  const known = knownPrefixes([...s.changes.map((c) => c.name), ...s.specs])
  const prefixes = savedPrefixes ?? guessPrefixes(s.workspace ?? '', known)
  const ch = splitBySystem(s.changes, prefixes, known, (c) => c.name)
  const sp = splitBySystem(s.specs, prefixes, known, (n) => n)
  return {
    changes: [...ch.mine, ...ch.shared],
    specs: [
      ...sp.mine.map((name) => ({ name, tag: prefixes.join(', ') })),
      ...sp.shared.map((name) => ({ name, tag: 'shared' }))
    ],
    prefixes
  }
}

/** Archived items pass the same system filter as active changes. */
function visibleArchived(items: ArchivedInfo[]): ArchivedInfo[] {
  if (!state?.store || mode === 'all') return items
  const v = view(state)
  if (!v.prefixes) return items
  const known = knownPrefixes([...state.changes.map((c) => c.name), ...state.specs])
  const split = splitBySystem(items, v.prefixes, known, (c) => c.name)
  return [...split.mine, ...split.shared]
}

function matches(c: ChangeInfo, text: string): boolean {
  const q = text.trim().toLowerCase()
  return !q || c.name.toLowerCase().includes(q) || (c.summary ?? '').toLowerCase().includes(q)
}

// ---------- archive dialog ----------

let dialog: HTMLElement | null = null

function closeDialog(): void {
  dialog?.remove()
  dialog = null
}

async function confirmArchive(c: ChangeInfo): Promise<void> {
  closeDialog()
  let cmd = `/openspec-archive-change ${c.name}`
  try {
    cmd = (await orca.plugin.request('openspec.promptFor', { step: 'archive', change: c.name })).prompt
  } catch {
    // keep the default-style command
  }
  const left = c.total === null ? null : c.total - c.done
  const confirm = button('Archive', 'btn danger', () => {
    closeDialog()
    void launch('archive', c.name)
  })
  const box = el(
    'div',
    { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-title' },
    el('h3', { id: 'dlg-title' }, `Archive ${c.name}?`),
    el(
      'p',
      {},
      'An agent will start and receive the ',
      el('code', {}, cmd),
      ' command. It merges the spec deltas into the main specs and moves the change to ',
      el('code', {}, 'changes/archive/'),
      '.'
    ),
    left
      ? el('div', { class: 'warn', role: 'note' }, `${left} of ${c.total} tasks ${left === 1 ? 'is' : 'are'} not done.`)
      : c.total === null
        ? el('div', { class: 'warn', role: 'note' }, 'This change has no tasks.md.')
        : null,
    el('div', { class: 'row' }, button('Cancel', 'btn', closeDialog), confirm)
  )
  dialog = el('div', { class: 'overlay' }, box)
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) closeDialog()
  })
  document.body.append(dialog)
  confirm.focus()
}

// ---------- board ----------

function quickActions(c: ChangeInfo): HTMLElement | null {
  const status = statusOf(c)
  const items =
    status === 'Ready to archive'
      ? [button('Archive', 'btn sm', () => void confirmArchive(c))]
      : status === 'In progress'
        ? [button('▶ Apply', 'btn primary sm', () => void launch('apply', c.name)), button('Verify', 'btn sm', () => void launch('verify', c.name))]
        : [button('▶ Apply', 'btn primary sm', () => void launch('apply', c.name))]
  return el('div', { class: 'quick' }, ...items)
}

function card(c: ChangeInfo, folder: string, isArchived: boolean): HTMLElement {
  const open = el(
    'button',
    { class: 'open', 'aria-label': `Open ${c.name}` },
    el('span', { class: 'name', title: c.name }, c.name),
    c.summary ? el('span', { class: 'summary muted' }, c.summary) : null,
    el('span', { class: 'meta muted' }, bar(c), progress(c), c.created ? el('span', { class: 'date' }, c.created) : null),
    !isArchived && c.next ? el('span', { class: 'next muted', title: c.next }, `Next: ${c.next}`) : null
  )
  open.addEventListener('click', () => openChange(folder, isArchived))
  return el('div', { class: 'card' }, open, isArchived ? null : quickActions(c))
}

function archivedColumn(): HTMLElement {
  const items = visibleArchived(archived.items)
  const toggle = el('button', { 'aria-expanded': String(archived.open) }, dot(ARCHIVED_COLOR), el('span', {}, `${archived.open ? '▾' : '▸'} Archived`))
  toggle.addEventListener('click', () => {
    archived.open = !archived.open
    if (archived.open && !archived.items.length) void loadArchived(true)
    renderBoard()
  })
  const col = el(
    'section',
    { class: 'col', 'aria-label': 'Archived' },
    el('div', { class: 'colhead' }, toggle, el('span', { class: 'count' }, String(archived.total)))
  )
  if (!archived.open) return col
  if (!items.length) col.append(el('div', { class: 'empty muted' }, archived.loading ? 'Loading…' : filter ? 'No matching changes' : 'Nothing archived yet'))
  for (const c of items) col.append(card(c, c.folder, true))
  if (archived.items.length < archived.total) {
    const more = el('div', { class: 'more muted' }, archived.loading ? 'Loading…' : `Showing ${archived.items.length} of ${archived.total}…`)
    col.append(more)
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !archived.loading) {
        io.disconnect()
        void loadArchived(false)
      }
    }, { root: boardPane })
    io.observe(more)
  }
  return col
}

/** Loads the archived total (always) and, when the column is open, the next page. */
async function loadArchived(reset: boolean): Promise<void> {
  if (state?.status !== 'ok') return
  if (reset) archived = { ...archived, items: [], limit: BATCH }
  const offset = archived.items.length
  const limit = archived.open ? BATCH : 0
  archived.loading = archived.open
  const ws = state.workspace
  try {
    const page = await orca.plugin.request('openspec.archived', filter.trim() ? { offset, limit, filter } : { offset, limit })
    if (state?.workspace !== ws) return
    archived.total = page.total
    if (archived.open) archived.items = [...archived.items, ...page.items]
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err))
  } finally {
    archived.loading = false
    if (current.kind === 'board') renderBoard()
  }
}

let boardDrawn = ''

function renderBoard(): void {
  const s = state
  if (!s || s.status !== 'ok') return
  const v = view(s)
  const changes = v.changes.filter((c) => matches(c, filter))
  // Same cards as last time: leave the DOM alone so clicks and hover buttons aren't interrupted.
  const key = JSON.stringify([changes, archived.open, archived.total, archived.loading, archived.items.map((a) => a.folder), visibleArchived(archived.items).length])
  if (key === boardDrawn && columnsEl.childElementCount) return
  boardDrawn = key
  columnsEl.replaceChildren(
    ...COLUMNS.map((col) => {
      const cards = changes.filter((c) => statusOf(c) === col.status)
      return el(
        'section',
        { class: 'col', 'aria-label': col.title },
        el('div', { class: 'colhead' }, dot(col.color), el('span', {}, col.title), el('span', { class: 'count' }, String(cards.length))),
        ...(cards.length ? cards.map((c) => card(c, c.name, false)) : [el('div', { class: 'empty muted' }, 'Nothing here')])
      )
    }),
    archivedColumn()
  )
}

function renderModeBox(prefixes: string[] | null): void {
  modeBox.replaceChildren()
  if (!state?.store) return
  for (const m of ['system', 'all'] as const) {
    const b = el('button', { class: m === mode ? 'btn on' : 'btn' }, m === 'system' ? 'This system' : 'All')
    b.addEventListener('click', () => {
      mode = m
      specLimit = BATCH
      void orca.storage.set('boardSystemMode', m)
      render()
    })
    modeBox.append(b)
  }
  if (mode === 'system') modeBox.append(el('span', { class: 'muted' }, prefixes?.length ? prefixes.join(', ') : 'system not set'))
}

// ---------- specs drawer ----------

function toggleDrawer(open = drawer.classList.contains('hidden')): void {
  drawer.classList.toggle('hidden', !open)
  specsBtn.setAttribute('aria-expanded', String(open))
  specsBtn.classList.toggle('on', open)
  if (open) {
    if (state) renderSpecs(view(state).specs)
    specSearch.focus()
  }
}

/** What the spec list last drew; a live update with the same specs leaves the list alone, so a
 *  redraw between mouse down and up can't swallow a click. */
let specsDrawn = ''

function renderSpecs(specs: { name: string; tag: string }[], force = false): void {
  const visible = filterByName(specs, specFilter, (s) => s.name)
  const { rows, hasMore } = firstBatch(visible, specLimit)
  const key = JSON.stringify([specs.length, rows, hasMore])
  if (!force && key === specsDrawn && specList.childElementCount) return
  specsDrawn = key
  specCount.textContent = String(specs.length)
  specList.replaceChildren(
    ...rows.map((s) => el('li', {}, el('button', { title: s.name, 'data-spec': s.name }, s.name), el('span', { class: 'tag muted' }, s.tag)))
  )
  if (!visible.length) specList.append(el('li', { class: 'muted' }, specs.length ? 'No matching specs' : 'No specs yet'))
  if (hasMore) {
    const sentinel = el('li', { class: 'muted' }, `Showing ${rows.length} of ${visible.length}…`)
    specList.append(sentinel)
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect()
        specLimit += BATCH
        renderSpecs(specs)
      }
    }, { root: specList })
    io.observe(sentinel)
  }
}

// ---------- navigation ----------

function showPane(kind: View['kind']): void {
  boardPane.classList.toggle('hidden', kind !== 'board')
  detailPane.classList.toggle('hidden', kind === 'board')
}

function goBoard(): void {
  navSeq++
  current = { kind: 'board' }
  showPane('board')
  detailPane.replaceChildren()
  renderBoard()
}

function crumb(...parts: (string | null)[]): HTMLElement {
  const home = el('a', { role: 'link', tabindex: '0' }, 'Board')
  home.addEventListener('click', goBoard)
  home.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') goBoard()
  })
  return el(
    'div',
    { class: 'crumb muted' },
    button('← Board', 'btn sm', goBoard),
    home,
    ...parts.filter((p): p is string => Boolean(p)).flatMap((p) => ['›', el('span', {}, p)]),
    el('span', { class: 'esc' }, 'Esc to go back')
  )
}

async function renderFile(target: HTMLElement, path: string, seq: number): Promise<void> {
  target.replaceChildren(el('p', { class: 'muted' }, 'Loading…'))
  try {
    const { text } = await orca.plugin.request('openspec.readFile', { path })
    if (seq !== navSeq) return
    const nodes = parse(text)
    target.replaceChildren(nodes.length ? toDom(nodes) : el('p', { class: 'muted' }, 'This file is empty.'))
  } catch (err) {
    if (seq !== navSeq) return
    target.replaceChildren(el('p', { class: 'muted' }, `Could not read the file: ${err instanceof Error ? err.message : String(err)}`))
  }
}

const openFile = (path: string) => call(() => orca.plugin.request('openspec.openFile', { path }))

function statusOfView(c: ChangeInfo, isArchived: boolean): { label: string; color: string } {
  if (isArchived) return { label: 'Archived', color: ARCHIVED_COLOR }
  const s = statusOf(c)
  const col = COLUMNS.find((x) => x.status === s)!
  return { label: s, color: col.color }
}

async function openChange(folder: string, isArchived: boolean, tab: string | null = null, keepScroll = false): Promise<void> {
  const seq = ++navSeq
  const same = current.kind === 'change' && current.folder === folder && current.archived === isArchived
  current = { kind: 'change', folder, archived: isArchived, tab }
  if (!keepScroll) closeDialog()
  showPane('change')
  const scroll = detailPane.scrollTop
  if (!same) detailPane.scrollTop = 0
  if (!detailPane.firstChild) detailPane.replaceChildren(el('div', { class: 'detail muted' }, 'Loading…'))
  const res = await call(() => orca.plugin.request('openspec.changeFiles', { folder, archived: isArchived }))
  if (seq !== navSeq) return
  if (!res) {
    detailPane.replaceChildren(el('div', { class: 'detail' }, crumb(folder), el('p', { class: 'muted' }, 'This change could not be opened.')))
    return
  }
  const c = res.info
  const files: ChangeFileInfo[] = res.files
  const selected = files.find((f) => f.path === tab) ?? files.find((f) => f.label === 'proposal.md') ?? files[0]
  current = { kind: 'change', folder, archived: isArchived, tab: selected?.path ?? null }
  const st = statusOfView(c, isArchived)
  const status = el('span', { class: 'status' }, st.label)
  status.style.color = st.color

  const actions = el('div', { class: 'actions' })
  const editCurrent = () => (selected ? void openFile(selected.path) : undefined)
  if (isArchived) {
    actions.append(button('Open in editor ↗', 'btn', editCurrent))
  } else {
    actions.append(
      button('▶ Apply', 'btn primary', () => void launch('apply', c.name)),
      button('Verify', 'btn', () => void launch('verify', c.name)),
      button('Explore', 'btn', () => void launch('explore', c.name)),
      el('span', { class: 'sep' }),
      button('Open in editor ↗', 'btn ghost', editCurrent),
      button('Archive', 'btn ghost', () => void confirmArchive(c))
    )
  }

  const hero = el(
    'section',
    { class: 'hero' },
    el(
      'div',
      { class: 'left' },
      el('div', { class: 'chips' }, el('h2', {}, c.name), status),
      el('div', { class: 'sub muted' }, bar(c), el('span', {}, `${progress(c)} tasks`), c.created ? el('span', {}, `Created ${c.created}`) : null),
      res.specs.length ? el('div', { class: 'chips muted' }, 'Touches', ...res.specs.map((s) => el('span', { class: 'chip' }, s))) : null
    ),
    actions
  )

  const tabs = el('div', { class: 'tabs', role: 'tablist' })
  const groups: [ChangeFileInfo['group'], string][] = [['docs', 'Docs'], ['other', 'Other'], ['delta', 'Spec deltas']]
  for (const [g, label] of groups) {
    const inGroup = files.filter((f) => f.group === g)
    if (!inGroup.length) continue
    tabs.append(el('span', { class: 'grp' }, label))
    for (const f of inGroup) {
      const t = el('button', { class: f === selected ? 'tab on' : 'tab', role: 'tab', 'aria-selected': String(f === selected), title: f.path }, f.label)
      t.addEventListener('click', () => void openChange(folder, isArchived, f.path))
      tabs.append(t)
    }
  }
  const md = el('div', { class: 'md' })
  const doc = el(
    'section',
    { class: 'doc' },
    tabs,
    selected ? el('div', { class: 'pathbar muted' }, el('span', { title: `openspec/${selected.path}` }, `openspec/${selected.path}`), button('Edit ↗', 'btn ghost sm', editCurrent)) : null,
    md
  )
  if (selected) void renderFile(md, selected.path, seq)
  else md.append(el('p', { class: 'muted' }, 'This change has no markdown files.'))

  const related = el('div', { class: 'box' }, el('h4', {}, 'Related changes'))
  if (!res.related.length) related.append(el('span', { class: 'muted', style: 'font-size:12px' }, 'No other change touches the same specs.'))
  for (const r of res.related as SpecUseInfo[]) {
    const b = el('button', { class: 'rel' }, r.name, el('small', {}, r.archived ? 'Archived' : 'Active'))
    b.addEventListener('click', () => void openChange(r.folder, r.archived))
    related.append(b)
  }
  const where = el(
    'div',
    { class: 'box' },
    el('h4', {}, 'Details'),
    el('div', { class: 'kv' }, el('span', { class: 'muted' }, 'Workspace'), el('span', {}, state?.workspace ?? '')),
    state?.store ? el('div', { class: 'kv' }, el('span', { class: 'muted' }, 'Store'), el('span', {}, state.store)) : null,
    el('div', { class: 'kv' }, el('span', { class: 'muted' }, 'Files'), el('span', {}, String(files.length))),
    el('div', { class: 'kv' }, el('span', { class: 'muted' }, 'Folder'), el('span', {}, isArchived ? `archive/${folder}` : folder))
  )

  detailPane.replaceChildren(
    el('div', { class: 'detail' }, crumb(isArchived ? 'Archived' : st.label, c.name), hero, el('div', { class: 'layout' }, doc, el('aside', { class: 'side' }, where, related)))
  )
  if (same) detailPane.scrollTop = scroll
}

async function openSpec(name: string): Promise<void> {
  const seq = ++navSeq
  current = { kind: 'spec', name }
  closeDialog()
  showPane('spec')
  detailPane.scrollTop = 0
  const path = `specs/${name}/spec.md`
  const md = el('div', { class: 'md' })
  const used = el('div', { class: 'box' }, el('h4', {}, 'Changed by'))
  detailPane.replaceChildren(
    el(
      'div',
      { class: 'detail' },
      crumb('Specs', name),
      el('section', { class: 'hero' }, el('div', { class: 'left' }, el('div', { class: 'chips' }, el('h2', {}, name), el('span', { class: 'status muted' }, 'Spec'))), el('div', { class: 'actions' }, button('Open in editor ↗', 'btn', () => void openFile(path)))),
      el(
        'div',
        { class: 'layout' },
        el('section', { class: 'doc' }, el('div', { class: 'pathbar muted' }, el('span', {}, `openspec/${path}`), button('Edit ↗', 'btn ghost sm', () => void openFile(path))), md),
        el('aside', { class: 'side' }, used)
      )
    )
  )
  void renderFile(md, path, seq)
  const info = await call(() => orca.plugin.request('openspec.specInfo', { spec: name }))
  if (seq !== navSeq || !info) return
  if (!info.changes.length) used.append(el('span', { class: 'muted', style: 'font-size:12px' }, 'No change carries a delta for this spec.'))
  for (const r of info.changes) {
    const b = el('button', { class: 'rel' }, r.name, el('small', {}, r.archived ? 'Archived' : 'Active'))
    b.addEventListener('click', () => void openChange(r.folder, r.archived))
    used.append(b)
  }
}

// ---------- state ----------

function render(): void {
  const s = state
  if (!s) return
  titleName.textContent = s.workspace ?? 'OpenSpec'
  titleSub.textContent = [s.store ? `via store ${s.store}` : '', `updated ${new Date().toLocaleTimeString()}`].filter(Boolean).join(' · ')
  const ok = s.status === 'ok'
  for (const b of [newBtn, search, specsBtn]) (b as HTMLElement).style.display = ok ? '' : 'none'
  if (!ok) {
    modeBox.replaceChildren()
    const msg =
      s.status === 'error'
        ? `Could not read OpenSpec: ${s.error ?? ''}`
        : s.status === 'no-openspec'
          ? 'This workspace has no OpenSpec yet. Set it up from the OpenSpec panel.'
          : s.status === 'remote'
            ? 'Remote workspaces are not supported yet.'
            : 'Focus a workspace to see its OpenSpec board.'
    navSeq++
    current = { kind: 'board' }
    showPane('board')
    detailPane.replaceChildren()
    drawer.classList.add('hidden')
    columnsEl.replaceChildren(el('div', { class: 'notice muted' }, msg))
    boardDrawn = ''
    specsDrawn = ''
    specList.replaceChildren()
    specCount.textContent = ''
    return
  }
  const v = view(s)
  renderModeBox(v.prefixes)
  if (current.kind === 'board') renderBoard()
  if (!drawer.classList.contains('hidden')) renderSpecs(v.specs)
}

async function loadPrefixes(): Promise<void> {
  const key = state?.store ? `${state.workspace ?? ''}@${state.store}` : null
  if (!key || key === prefixesFor) return
  prefixesFor = key
  savedPrefixes = null
  try {
    savedPrefixes = (await orca.plugin.request('openspec.systemPrefixes')).prefixes
  } catch {
    // keep the guess
  }
  render()
}

function receive(next: OpenSpecState): void {
  const prev = state
  const switched = prev?.workspace !== next.workspace || prev?.store !== next.store
  state = next
  if (switched) {
    specLimit = BATCH
    archived = { open: false, items: [], total: 0, limit: BATCH, loading: false }
    if (current.kind !== 'board') goBoard()
  }
  render()
  // The archive only changes when an active change comes or goes (archiving moves it there).
  const names = (s: OpenSpecState | null) => JSON.stringify(s?.changes.map((c) => c.name) ?? null)
  if (switched || names(prev) !== names(next)) void loadArchived(true)
  // Keep an open change page in step with its files, but only when that change changed:
  // redrawing on every update would swallow clicks on its tabs.
  if (next.status === 'ok' && current.kind === 'change' && !current.archived) {
    const folder = current.folder
    const pick = (s: OpenSpecState | null) => JSON.stringify(s?.changes.find((c) => c.name === folder) ?? null)
    if (switched || pick(prev) !== pick(next)) void openChange(folder, false, current.tab, true)
  }
  void loadPrefixes()
}

let filterTimer: ReturnType<typeof setTimeout> | undefined
search.addEventListener('input', () => {
  filter = search.value
  if (current.kind !== 'board') goBoard()
  else renderBoard()
  clearTimeout(filterTimer)
  filterTimer = setTimeout(() => void loadArchived(true), 250)
})
// One listener on the list: it survives redraws of the rows.
specList.addEventListener('click', (e) => {
  const b = (e.target as Element | null)?.closest?.('button[data-spec]')
  const name = b?.getAttribute('data-spec')
  if (name) void openSpec(name)
})
specSearch.addEventListener('input', () => {
  specFilter = specSearch.value
  specLimit = BATCH
  if (state) renderSpecs(view(state).specs)
})
titleBtn.addEventListener('click', () => {
  if (current.kind !== 'board') goBoard()
})
specsBtn.addEventListener('click', () => toggleDrawer())
refreshBtn.addEventListener('click', async () => {
  if (busy) return
  busy = true
  refreshBtn.disabled = true
  const minimum = new Promise((r) => setTimeout(r, 500))
  const next = await call(() => orca.plugin.request('openspec.refresh'))
  await minimum
  if (next) receive(next)
  busy = false
  refreshBtn.disabled = false
})
newBtn.addEventListener('click', () => {
  form.classList.toggle('open')
  if (form.classList.contains('open')) formText.focus()
})
cancelBtn.addEventListener('click', () => {
  form.classList.remove('open')
  formText.value = ''
})
for (const [btn, step] of [[exploreBtn, 'explore'], [proposeBtn, 'propose']] as const) {
  btn.addEventListener('click', async () => {
    const text = formText.value.trim()
    if (!text) return formText.focus()
    btn.disabled = true
    const res = await call(() => orca.plugin.request('openspec.launch', { step, description: text }))
    btn.disabled = false
    if (res) {
      form.classList.remove('open')
      formText.value = ''
    }
  })
}
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return
  if (dialog) {
    closeDialog()
    e.preventDefault()
    return
  }
  const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
  if (typing) return
  if (current.kind !== 'board') {
    goBoard()
    e.preventDefault()
  } else if (!drawer.classList.contains('hidden')) {
    toggleDrawer(false)
    e.preventDefault()
  }
})

orca.plugin.on('openspec.changed', (payload) => receive(payload as OpenSpecState))

// The board file is only an anchor for this tab; start the document session so Orca knows the
// editor is ready, and never edit it.
void orca.document?.session().catch(() => undefined)

const storedMode = await orca.storage.get('boardSystemMode').catch(() => undefined)
if (storedMode === 'all' || storedMode === 'system') mode = storedMode
const first = await call(() => orca.plugin.request('openspec.state'))
if (first) receive(first)
