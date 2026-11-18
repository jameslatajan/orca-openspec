// A small markdown renderer for the board. It parses into a plain tree of tags and strings and
// builds DOM with createElement and text nodes only, so file content can never become markup
// or script. Unknown syntax falls back to plain paragraphs.

/** A rendered node: a string is text; anything else is one element from a fixed set of tags. */
export type MdNode = string | { tag: MdTag; cls?: string; checked?: boolean; children: MdNode[] }
export type MdTag = 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'ul' | 'ol' | 'li' | 'pre' | 'code' | 'strong' | 'em' | 'blockquote' | 'hr' | 'div' | 'span'

const node = (tag: MdTag, children: MdNode[], cls?: string): MdNode => (cls ? { tag, cls, children } : { tag, children })

/** Inline markup: `code`, **bold**, *italic* / _italic_. Links keep their text and show the URL. */
export function inline(text: string): MdNode[] {
  const out: MdNode[] = []
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*)\*|\[([^\]]+)\]\(([^)\s]+)\)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1] !== undefined) out.push(node('code', [m[1]]))
    else if (m[2] !== undefined || m[3] !== undefined) out.push(node('strong', inline(m[2] ?? m[3])))
    else if (m[4] !== undefined) out.push(node('em', inline(m[4])))
    else out.push(node('span', [m[5]], 'link'), ` (${m[6]})`)
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

const TASK = /^\s*[-*]\s+\[([^\]]*)\]\s?(.*)$/
const BULLET = /^(\s*)[-*+]\s+(.*)$/
const NUMBER = /^(\s*)\d+[.)]\s+(.*)$/

/** Parses markdown into block nodes. HTML comments are dropped; raw HTML stays literal text. */
export function parse(markdown: string): MdNode[] {
  const lines = markdown.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/)
  const out: MdNode[] = []
  let para: string[] = []
  let list: { tag: 'ul' | 'ol'; items: MdNode[] } | null = null
  let scenario: MdNode[] | null = null
  const target = (): MdNode[] => scenario ?? out
  const flushPara = () => {
    if (para.length) target().push(node('p', inline(para.join(' '))))
    para = []
  }
  const flushList = () => {
    if (list) target().push(node(list.tag, list.items))
    list = null
  }
  const flush = () => {
    flushPara()
    flushList()
  }
  const endScenario = () => {
    flush()
    if (scenario) out.push(node('div', scenario, 'scenario'))
    scenario = null
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const t = line.trim()
    if (t.startsWith('```')) {
      flush()
      const code: string[] = []
      for (i++; i < lines.length && !lines[i].trim().startsWith('```'); i++) code.push(lines[i])
      target().push(node('pre', [node('code', [code.join('\n')])]))
      continue
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(t)
    if (h) {
      endScenario()
      const level = Math.min(h[1].length, 4) as 1 | 2 | 3 | 4
      const text = h[2]
      if (level === 4 && /^Scenario:/i.test(text)) {
        scenario = [node('h4', inline(text))]
        continue
      }
      const cls = /^Requirement:/i.test(text) ? 'requirement' : undefined
      out.push(node(`h${level}` as MdTag, inline(text), cls))
      continue
    }
    if (!t) {
      flush()
      continue
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      endScenario()
      out.push(node('hr', []))
      continue
    }
    if (t.startsWith('|')) {
      flushPara()
      flushList()
      const rows = [line]
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) rows.push(lines[++i])
      target().push(node('pre', [rows.join('\n')], 'table'))
      continue
    }
    if (t.startsWith('>')) {
      flush()
      target().push(node('blockquote', inline(t.replace(/^>\s?/, ''))))
      continue
    }
    const task = TASK.exec(line)
    if (task) {
      flushPara()
      if (!list || list.tag !== 'ul') {
        flushList()
        list = { tag: 'ul', items: [] }
      }
      const done = /^\s*[xX]\s*$/.test(task[1])
      list.items.push({ tag: 'li', cls: done ? 'task done' : 'task', checked: done, children: inline(task[2]) })
      continue
    }
    const b = BULLET.exec(line) ?? NUMBER.exec(line)
    if (b) {
      flushPara()
      const tag = BULLET.test(line) ? 'ul' : 'ol'
      if (!list || list.tag !== tag) {
        flushList()
        list = { tag, items: [] }
      }
      list.items.push(node('li', scenarioLine(b[2])))
      continue
    }
    flushList()
    para.push(t)
  }
  endScenario()
  return out
}

/** `**WHEN** x` / `**THEN** y` lines get a keyword class so scenarios read at a glance. */
function scenarioLine(text: string): MdNode[] {
  const m = /^\*\*(WHEN|THEN|AND|GIVEN)\*\*\s*(.*)$/.exec(text)
  return m ? [node('span', [m[1]], 'kw'), ' ', ...inline(m[2])] : inline(text)
}

/** Builds DOM for parsed nodes. Text only ever goes in through text nodes. */
export function toDom(nodes: MdNode[], doc: Document = document): DocumentFragment {
  const frag = doc.createDocumentFragment()
  const build = (n: MdNode): Node => {
    if (typeof n === 'string') return doc.createTextNode(n)
    const e = doc.createElement(n.tag)
    if (n.cls) e.className = n.cls
    if (n.checked !== undefined) {
      const box = doc.createElement('span')
      box.className = n.checked ? 'chk on' : 'chk'
      box.setAttribute('aria-hidden', 'true')
      box.textContent = n.checked ? '✓' : ''
      e.append(box)
      e.setAttribute('aria-checked', String(n.checked))
      e.setAttribute('role', 'checkbox')
      e.setAttribute('aria-disabled', 'true')
    }
    for (const c of n.children) e.append(build(c))
    return e
  }
  for (const n of nodes) frag.append(build(n))
  return frag
}
