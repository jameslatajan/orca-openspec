// The OpenSpec board: a Kanban view of the focused workspace's changes, opened as a main-area
// editor tab for `openspec/board.openspec`. Plain DOM (custom editors get no Orca components).
// Data, live updates and agent launches all go through the same worker as the sidebar panel.
import type { ChangeInfo, OpenSpecState, OpsxStep } from '../src/protocol'
import {
  BATCH,
  filterByName,
  firstBatch,
  guessPrefixes,
  isReady,
  knownPrefixes,
  progressText,
  splitBySystem,
  statusOf,
  type Status
} from '../src/view'

const COLUMNS: { status: Status; title: string; color: string }[] = [
  { status: 'Planning', title: 'Planning', color: '#E8A15A' },
  { status: 'Not started', title: 'Not started', color: '#8A8A92' },
  { status: 'In progress', title: 'In progress', color: 'var(--orca-primary)' },
  { status: 'Ready to archive', title: 'Ready to archive', color: '#4CC38A' }
]

const CSS = `
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body { margin: 0; height: 100vh; display: flex; flex-direction: column; background: var(--orca-background);
  color: var(--orca-foreground); font: 13px/1.4 var(--orca-font-sans, system-ui, sans-serif); }
button, input, textarea { font: inherit; color: inherit; }
button { cursor: pointer; }
.muted { color: var(--orca-muted-foreground); }
header { display: flex; align-items: center; gap: 12px; padding: 12px 18px; border-bottom: 1px solid var(--orca-border); flex-wrap: wrap; }
.title { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.title b { font-size: 15px; }
.title span { font-size: 11px; }
.seg { display: flex; gap: 4px; align-items: center; }
.btn { height: 28px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--orca-border); background: transparent; font-size: 12px; }
.btn.on, .btn.primary { background: var(--orca-primary); color: var(--orca-primary-foreground); border-color: transparent; font-weight: 600; }
.btn.good { color: #4CC38A; border-color: #2F5A43; }
.btn:disabled { opacity: .5; cursor: default; }
.search { height: 30px; width: 240px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--orca-border); background: var(--orca-input, transparent); }
.spacer { flex: 1; }
.form { display: none; gap: 8px; padding: 10px 18px; border-bottom: 1px solid var(--orca-border); align-items: flex-start; }
.form.open { display: flex; }
.form textarea { flex: 1; min-height: 56px; padding: 8px; border-radius: 6px; border: 1px solid var(--orca-border); background: var(--orca-input, transparent); resize: vertical; }
.error { padding: 8px 18px; color: var(--orca-destructive); display: none; }
.error.show { display: block; }
.body { flex: 1; min-height: 0; display: flex; }
main { flex: 1; min-width: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; padding: 14px 18px; overflow: auto; }
.col { display: flex; flex-direction: column; gap: 8px; min-width: 0; background: var(--orca-card); color: var(--orca-card-foreground); border-radius: 10px; padding: 10px; align-self: start; }
.colhead { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 600; letter-spacing: .03em; text-transform: uppercase; }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.count { margin-left: auto; padding: 1px 7px; border-radius: 999px; background: var(--orca-muted); font-weight: 500; }
.card { text-align: left; width: 100%; display: flex; flex-direction: column; gap: 6px; padding: 10px; border-radius: 8px; border: 1px solid var(--orca-border); background: var(--orca-background); }
.card.sel { border-color: var(--orca-primary); }
.row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.ring { width: 22px; height: 22px; border-radius: 50%; flex: none; display: grid; place-items: center; }
.ring::after { content: ''; width: 14px; height: 14px; border-radius: 50%; background: var(--orca-background); }
.name { flex: 1; min-width: 0; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.next { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.actions { display: flex; gap: 6px; }
.actions .btn { flex: 1; }
.empty { font-size: 12px; padding: 4px 2px; }
aside { width: 290px; flex: none; border-left: 1px solid var(--orca-border); display: flex; flex-direction: column; min-height: 0; }
aside .head { padding: 12px 14px 8px; display: flex; gap: 8px; align-items: center; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; }
aside .search { width: auto; margin: 0 14px 8px; }
aside ul { list-style: none; margin: 0; padding: 0 8px 8px; overflow: auto; flex: 1; }
aside li { display: flex; gap: 8px; padding: 6px 8px; border-radius: 6px; font-size: 12px; }
aside li span:first-child { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tag { font-size: 10px; }
.notice { padding: 40px; text-align: center; }
`

/** Element helper: el('div', { class: 'x' }, child, 'text'). Text always goes in as text nodes. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string | null)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  for (const child of children) if (child !== null) node.append(child)
  return node
}

let state: OpenSpecState | null = null
let savedPrefixes: string[] | null = null
let prefixesFor: string | null = null
let mode: 'system' | 'all' = 'system'
let selected: string | null = null
let filter = ''
let specFilter = ''
let specLimit = BATCH
let busy = false

const style = el('style')
style.textContent = CSS
document.head.append(style)

const titleName = el('b', {}, 'OpenSpec')
const titleSub = el('span', { class: 'muted' })
const modeBox = el('div', { class: 'seg' })
const search = el('input', { class: 'search', type: 'search', placeholder: 'Filter changes', 'aria-label': 'Filter changes' })
const newBtn = el('button', { class: 'btn primary' }, '+ New change')
const refreshBtn = el('button', { class: 'btn', 'aria-label': 'Refresh' }, '↻ Refresh')
const header = el(
  'header',
  {},
  el('div', { class: 'title' }, titleName, titleSub),
  modeBox,
  el('div', { class: 'spacer' }),
  search,
  newBtn,
  refreshBtn
)

const formText = el('textarea', { placeholder: 'Describe the change…', 'aria-label': 'Describe the change' })
const exploreBtn = el('button', { class: 'btn primary' }, 'Explore')
const proposeBtn = el('button', { class: 'btn' }, 'Propose')
const cancelBtn = el('button', { class: 'btn' }, 'Cancel')
const form = el('div', { class: 'form' }, formText, el('div', { class: 'actions' }, exploreBtn, proposeBtn, cancelBtn))

const errorBox = el('div', { class: 'error', role: 'alert' })
const columnsEl = el('main', { 'aria-label': 'Changes by status' })
const specCount = el('span', { class: 'count' })
const specSearch = el('input', { class: 'search', type: 'search', placeholder: 'Filter specs', 'aria-label': 'Filter specs' })
const specList = el('ul', { 'aria-label': 'Specs' })
const aside = el('aside', {}, el('div', { class: 'head' }, el('span', {}, 'Specs'), specCount), specSearch, specList)
const body = el('div', { class: 'body' }, columnsEl, aside)
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

function ring(c: ChangeInfo, color: string): HTMLElement {
  const pct = c.total ? Math.round((100 * c.done) / c.total) : 0
  const r = el('span', { class: 'ring', 'aria-hidden': 'true' })
  r.style.background = `conic-gradient(${color} ${pct}%, var(--orca-muted) 0)`
  return r
}

function card(c: ChangeInfo, color: string): HTMLElement {
  const isSel = c.name === selected
  const node = el(
    'div',
    { class: isSel ? 'card sel' : 'card' },
    el('button', { class: 'row', style: 'all: unset; display: flex; gap: 8px; align-items: center; cursor: pointer; min-width: 0;' },
      ring(c, color), el('span', { class: 'name' }, c.name), el('span', { class: 'muted' }, progressText(c))),
    el('span', { class: 'next muted' }, c.next ? `Next: ${c.next}` : c.total === null ? 'No tasks yet' : 'All tasks done')
  )
  node.querySelector('button')!.addEventListener('click', () => {
    selected = isSel ? null : c.name
    render()
  })
  if (isSel) {
    const apply = el('button', { class: 'btn primary' }, 'Apply')
    apply.addEventListener('click', () => launch('apply', c.name))
    const second = isReady(c) ? el('button', { class: 'btn good' }, 'Archive') : el('button', { class: 'btn' }, 'Verify')
    second.addEventListener('click', () => launch(isReady(c) ? 'archive' : 'verify', c.name))
    node.append(el('div', { class: 'actions' }, apply, second))
  }
  return node
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

function renderSpecs(specs: { name: string; tag: string }[]): void {
  const visible = filterByName(specs, specFilter, (s) => s.name)
  const { rows, hasMore } = firstBatch(visible, specLimit)
  specCount.textContent = String(specs.length)
  specList.replaceChildren(
    ...rows.map((s) => el('li', {}, el('span', { title: s.name }, s.name), el('span', { class: 'tag muted' }, s.tag)))
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

function render(): void {
  const s = state
  if (!s) return
  titleName.textContent = s.workspace ?? 'OpenSpec'
  titleSub.textContent = [s.store ? `via store ${s.store}` : '', `updated ${new Date().toLocaleTimeString()}`]
    .filter(Boolean)
    .join(' · ')
  const ok = s.status === 'ok'
  for (const b of [newBtn, search]) (b as HTMLElement).style.display = ok ? '' : 'none'
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
    columnsEl.replaceChildren(el('div', { class: 'notice muted' }, msg))
    specList.replaceChildren()
    specCount.textContent = ''
    return
  }
  const v = view(s)
  renderModeBox(v.prefixes)
  const changes = filterByName(v.changes, filter, (c) => c.name)
  columnsEl.replaceChildren(
    ...COLUMNS.map((col) => {
      const cards = changes.filter((c) => statusOf(c) === col.status)
      const dot = el('span', { class: 'dot' })
      dot.style.background = col.color
      return el(
        'section',
        { class: 'col', 'aria-label': col.title },
        el('div', { class: 'colhead' }, dot, el('span', {}, col.title), el('span', { class: 'count' }, String(cards.length))),
        ...(cards.length ? cards.map((c) => card(c, col.color)) : [el('span', { class: 'empty muted' }, 'Nothing here')])
      )
    })
  )
  renderSpecs(v.specs)
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
  if (state?.workspace !== next.workspace) {
    selected = null
    specLimit = BATCH
  }
  state = next
  render()
  void loadPrefixes()
}

search.addEventListener('input', () => {
  filter = search.value
  render()
})
specSearch.addEventListener('input', () => {
  specFilter = specSearch.value
  specLimit = BATCH
  if (state) renderSpecs(view(state).specs)
})
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

orca.plugin.on('openspec.changed', (payload) => receive(payload as OpenSpecState))

// The board file is only an anchor for this tab; start the document session so Orca knows the
// editor is ready, and never edit it.
void orca.document?.session().catch(() => undefined)

const storedMode = await orca.storage.get('boardSystemMode').catch(() => undefined)
if (storedMode === 'all' || storedMode === 'system') mode = storedMode
const first = await call(() => orca.plugin.request('openspec.state'))
if (first) receive(first)
