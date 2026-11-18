import { assert, test } from 'orca/testing'
import { inline, parse, toDom, type MdNode } from './markdown'

/** All text in a parsed tree, to check nothing was lost or turned into markup. */
const text = (nodes: MdNode[]): string => nodes.map((n) => (typeof n === 'string' ? n : text(n.children))).join('')
const tags = (nodes: MdNode[]): string[] => nodes.flatMap((n) => (typeof n === 'string' ? [] : [n.tag, ...tags(n.children)]))

test('headings, paragraphs, lists and code', () => {
  const tree = parse('# Title\n\nSome **bold** and `code`.\n\n- one\n- two\n\n1. first\n\n```\nlet a = 1\n```\n')
  assert.deepEqual(tags(tree), ['h1', 'p', 'strong', 'code', 'ul', 'li', 'li', 'ol', 'li', 'pre', 'code'])
  assert.equal(text(tree), 'TitleSome bold and code.onetwofirstlet a = 1')
})

test('raw HTML and script stay literal text', () => {
  const tree = parse('## Why\n<script>alert(1)</script>\n<img src=x onerror=alert(1)>\n')
  assert.deepEqual(tags(tree), ['h2', 'p'])
  assert.equal(text(tree), 'Why<script>alert(1)</script> <img src=x onerror=alert(1)>')
})

test('task boxes are read-only checklist items', () => {
  const tree = parse('- [x] 1.1 done\n- [ ] 1.2 open\n- [~] 1.3 odd\n')
  const items = (tree[0] as { children: { cls?: string; checked?: boolean }[] }).children
  assert.deepEqual(items.map((i) => [i.cls, i.checked]), [['task done', true], ['task', false], ['task', false]])
})

test('scenarios group under a box with WHEN/THEN keywords', () => {
  const tree = parse('### Requirement: Login\nText.\n\n#### Scenario: ok\n- **WHEN** a\n- **THEN** b\n\n### Requirement: Next\n')
  assert.deepEqual(tags(tree), ['h3', 'p', 'div', 'h4', 'ul', 'li', 'span', 'li', 'span', 'h3'])
  const box = tree[2] as { cls?: string }
  assert.equal(box.cls, 'scenario')
  assert.equal((tree[0] as { cls?: string }).cls, 'requirement')
})

test('links keep text and show the URL as text', () => {
  assert.deepEqual(inline('see [docs](https://x.dev/a)'), ['see ', { tag: 'span', cls: 'link', children: ['docs'] }, ' (https://x.dev/a)'])
})

test('comments are dropped and tables stay preformatted', () => {
  const tree = parse('<!-- hint -->\n| a | b |\n|---|---|\n| 1 | 2 |\n')
  assert.deepEqual(tags(tree), ['pre'])
})

test('toDom only creates elements from the fixed tag set and text nodes', () => {
  const made: string[] = []
  const fake = {
    createDocumentFragment: () => ({ append: () => undefined }),
    createTextNode: (t: string) => ({ t }),
    createElement: (tag: string) => {
      made.push(tag)
      return { append: () => undefined, setAttribute: () => undefined, className: '', textContent: '' }
    }
  } as unknown as Document
  toDom(parse('<script>x</script>\n- [x] a'), fake)
  assert.deepEqual(made, ['p', 'ul', 'li', 'span'])
})
