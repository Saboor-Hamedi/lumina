import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import {
  Compartment,
  EditorSelection,
  Facet,
  Prec,
  StateEffect,
  StateField,
  Transaction
} from '@codemirror/state'
import { Decoration, EditorView, WidgetType, keymap, ViewPlugin } from '@codemirror/view'
import { undo, redo } from '@codemirror/commands'
import { treeGrowthEffect, treeProgressPlugin } from './tree-progress'
import { useVaultStore } from '../../core/store/useVaultStore'
import { TableAutocomplete } from './wikilinkAutocompletion'
import { setupTableFormattingToolbar } from './tableFormattingToolbar'
import { openCellMenu } from './tableContextMenu'
import { setupTableSelection } from './tableGridSelection'
// Removed global tooltip repositioner

function collectCells(state, rowNode) {
  // Split the row's raw line on unescaped `|` rather than collecting
  // lezer `TableCell` nodes. lezer emits NO `TableCell` for an empty
  // cell, so a node-based count silently drops blank columns — which
  // is exactly what "Insert column left/right" creates. Counting cells
  // from the pipe-delimited text keeps blank columns (and their
  // positions) intact through the parse → serialize round-trip.
  return splitRowCells(state.doc.lineAt(rowNode.from).text)
}
export function splitRowCells(line) {
  let s = line.trim()
  // Strip the optional outer pipes so they don't yield phantom empty
  // leading/trailing cells.
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  const cells = []
  let buf = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    // A backslash escapes the next char (e.g. `\|` is a literal pipe in
    // a GFM cell) — keep both and don't treat the pipe as a separator.
    if (ch === '\\' && i + 1 < s.length) {
      buf += ch + s[i + 1]
      i++
      continue
    }
    if (ch === '|') {
      cells.push(buf.trim())
      buf = ''
      continue
    }
    buf += ch
  }
  cells.push(buf.trim())
  return cells
}
function parseTable(state, tableNode) {
  const header = []
  const rows = []
  let delimiterLine = ''
  const cursor = tableNode.cursor()
  if (!cursor.firstChild()) return null
  do {
    if (cursor.name === 'TableHeader') {
      header.push(...collectCells(state, cursor.node))
      // The delimiter row follows the header
      const headerLine = state.doc.lineAt(cursor.to)
      if (headerLine.number < state.doc.lines) {
        delimiterLine = state.doc.line(headerLine.number + 1).text
      }
    } else if (cursor.name === 'TableRow') {
      rows.push(collectCells(state, cursor.node))
    }
    // TableDelimiter (per-row `|` and whole-line `|---|---|`) is ignored.
  } while (cursor.nextSibling())
  if (header.length === 0) return null

  const alignments = []
  if (delimiterLine) {
    const delimiterCells = splitRowCells(delimiterLine)
    for (const cell of delimiterCells) {
      const s = cell.trim()
      if (s.startsWith(':') && s.endsWith(':')) alignments.push('center')
      else if (s.endsWith(':')) alignments.push('right')
      else if (s.startsWith(':')) alignments.push('left')
      else alignments.push('')
    }
  }
  // Pad alignments array if needed
  while (alignments.length < header.length) alignments.push('')

  return { header, rows, alignments }
}
// Escape cell content so it can't break the row's GFM structure: an
// unescaped `|` would split the cell into two columns, and a stray
// newline would terminate the table. A pipe that's already escaped
// (`\|` — e.g. round-tripping content the parser handed us) is left
// alone so serialize is idempotent.
function escapeCell(text) {
  // Escape pipes that are NOT inside inline code blocks
  // A simple heuristic: split by inline code segments, escape pipes in non-code segments.
  const parts = text.split(/(`[^`\n]+`)/)
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      parts[i] = parts[i].replace(/\r?\n/g, ' ').replace(/(?<!\\)\|/g, '\\|')
    } else {
      parts[i] = parts[i].replace(/\r?\n/g, ' ') // Keep code blocks intact
    }
  }
  return parts.join('')
}
export function serializeTable(model) {
  const columnCount = model.header.length
  const lines = []
  lines.push('| ' + model.header.map(escapeCell).join(' | ') + ' |')
  
  const delimiterRow = []
  for (let c = 0; c < columnCount; c++) {
    const align = model.alignments?.[c] || ''
    if (align === 'center') delimiterRow.push(':---:')
    else if (align === 'right') delimiterRow.push('---:')
    else if (align === 'left') delimiterRow.push(':---')
    else delimiterRow.push('---')
  }
  lines.push('| ' + delimiterRow.join(' | ') + ' |')

  for (const row of model.rows) {
    const padded = []
    for (let c = 0; c < columnCount; c++) padded.push(escapeCell(row[c] ?? ''))
    lines.push('| ' + padded.join(' | ') + ' |')
  }
  return lines.join('\n')
}
export function readModelFromDom(wrap) {
  const header = Array.from(wrap.querySelectorAll('thead th')).map(readCellSource)
  const alignments = Array.from(wrap.querySelectorAll('thead th')).map(th => {
    if (th.style.textAlign === 'center') return 'center'
    if (th.style.textAlign === 'right') return 'right'
    if (th.style.textAlign === 'left') return 'left'
    return ''
  })
  const rows = Array.from(wrap.querySelectorAll('tbody tr')).map((tr) =>
    Array.from(tr.querySelectorAll('td')).map(readCellSource)
  )
  return { header, rows, alignments }
}
// A cell's raw markdown lives in `dataset.raw` — the source of truth
// that `readModelFromDom` reads when serializing the table back to
// markdown. The inner `.cm-atomic-table-cell-source` element displays
// an escape-stripped view of that raw text so RSS-ingested cells
// don't show `\.` / `\(` / `\-` style literal backslashes in the
// reader; the input handler pulls innerText back to dataset.raw on
// every keystroke (any escapes the user types get preserved there,
// but won't round-trip back through stripEscapes on re-render —
// acceptable tradeoff because the escapes are typically ingestion
// artifacts users don't want to preserve anyway).
function readCellSource(cell) {
  return (cell.dataset.raw ?? '').trim()
}
function getCellSource(cell) {
  return cell.querySelector('.cm-atomic-table-cell-source')
}
export function parseCellInline(raw) {
  const tokens = []
  let textBuf = ''
  let i = 0
  const flushText = () => {
    if (textBuf.length) {
      tokens.push({ type: 'text', text: textBuf })
      textBuf = ''
    }
  }
  while (i < raw.length) {
    // CommonMark backslash escape — the following char is emitted
    // literally and can't open/close a mark. Pair is consumed.
    if (raw[i] === '\\' && i + 1 < raw.length && /[!-/:-@[-`{-~]/.test(raw[i + 1])) {
      textBuf += raw[i + 1]
      i += 2
      continue
    }
    const match = matchCellMarkAt(raw, i)
    if (match) {
      flushText()
      tokens.push(match.token)
      i = match.end
      continue
    }
    textBuf += raw[i]
    i++
  }
  flushText()
  return tokens
}
function matchCellMarkAt(raw, from) {
  const rest = raw.slice(from)
  // Bold with `**` or `__` — greedy on the outside, lazy on the
  // content so we catch the nearest closer.
  let m = rest.match(/^\*\*([\s\S]+?)\*\*/)
  if (m) {
    return {
      token: { type: 'strong', delim: '**', children: parseCellInline(m[1]) },
      end: from + m[0].length
    }
  }
  m = rest.match(/^__([\s\S]+?)__/)
  if (m) {
    return {
      token: { type: 'strong', delim: '__', children: parseCellInline(m[1]) },
      end: from + m[0].length
    }
  }
  // Inline Code
  m = rest.match(/^`([^`\n]+)`/)
  if (m) {
    return {
      token: { type: 'code', text: m[1] },
      end: from + m[0].length
    }
  }
  // Strikethrough.
  m = rest.match(/^~~([\s\S]+?)~~/)
  if (m) {
    return {
      token: { type: 'strike', children: parseCellInline(m[1]) },
      end: from + m[0].length
    }
  }
  // Wikilink `[[text]]`.
  m = rest.match(/^\[\[([^\]]+)\]\]/)
  if (m) {
    return {
      token: {
        type: 'wikilink',
        textChildren: parseCellInline(m[1]),
        url: m[1]
      },
      end: from + m[0].length
    }
  }
  // Link `[text](url)`. Reject empty text / url via `+` quantifiers.
  // `]` and `)` can't appear unescaped inside their respective fields.
  m = rest.match(/^\[([^\]\n]+)\]\(([^\s)"'\n]+)\)/)
  if (m) {
    return {
      token: {
        type: 'link',
        textChildren: parseCellInline(m[1]),
        url: m[2]
      },
      end: from + m[0].length
    }
  }
  // Italic with `*`. Reject a leading `*` (that would have matched
  // the bold regex above; this guards against pathological inputs
  // like `***` that slip through).
  m = rest.match(/^\*([^*\n]+?)\*/)
  if (m) {
    return {
      token: { type: 'em', delim: '*', children: parseCellInline(m[1]) },
      end: from + m[0].length
    }
  }
  // Tags and Mentions
  const prevChar = from > 0 ? raw[from - 1] : ''
  if (!/\w/.test(prevChar)) {
    m = rest.match(/^#([\w-]+)/)
    if (m) {
      return {
        token: { type: 'tag', text: m[1] },
        end: from + m[0].length
      }
    }
    m = rest.match(/^@([\w-]+)/)
    if (m) {
      return {
        token: { type: 'mention', text: m[1] },
        end: from + m[0].length
      }
    }
  }

  // Italic with `_`. Avoid triggering inside words like `snake_case`
  // by requiring the char before `_` to not be a word character.
  // (Fallback to true when `_` is at start-of-input.)
  const prev = from > 0 ? raw[from - 1] : ''
  if (!/\w/.test(prev)) {
    m = rest.match(/^_([^_\n]+?)_/)
    if (m) {
      return {
        token: { type: 'em', delim: '_', children: parseCellInline(m[1]) },
        end: from + m[0].length
      }
    }
  }
  return null
}
// Build the decorated DOM for a cell's source. The parser strips
// CommonMark backslash escapes inline (so `\*` emits a literal `*`
// text node); the fragment's `textContent` equals the escape-stripped
// raw. The cell's input handler reads `textContent` to update
// `dataset.raw` — round-trip is one-way for escapes (same as the
// pre-markdown-in-cells behavior), but fully preserves every inline
// mark delimiter because those live in `display: none` spans inside
// the DOM rather than being derived on serialize.
function buildCellSourceDom(raw) {
  const frag = document.createDocumentFragment()
  const tokens = parseCellInline(raw)
  for (const tok of tokens) frag.appendChild(renderCellToken(tok))
  return frag
}
function renderCellToken(tok) {
  if (tok.type === 'text') {
    return document.createTextNode(tok.text)
  }
  if (tok.type === 'tag') {
    const frag = document.createDocumentFragment()
    const prefix = document.createElement('span')
    prefix.className = 'cm-tag-prefix'
    prefix.textContent = '#'
    frag.appendChild(prefix)
    const text = document.createElement('span')
    text.className = 'cm-inline-tag'
    text.textContent = tok.text
    frag.appendChild(text)
    return frag
  }
  if (tok.type === 'mention') {
    const frag = document.createDocumentFragment()
    const prefix = document.createElement('span')
    prefix.className = 'cm-mention-prefix'
    prefix.textContent = '@'
    frag.appendChild(prefix)
    const text = document.createElement('span')
    text.className = 'cm-inline-mention'
    text.textContent = tok.text
    frag.appendChild(text)
    return frag
  }
  if (tok.type === 'strong') {
    const wrap = document.createElement('span')
    wrap.className = 'cm-atomic-strong-wrap'
    wrap.appendChild(makeCellMark(tok.delim))
    const inner = document.createElement('span')
    inner.className = 'cm-atomic-strong'
    inner.appendChild(renderTokensTo(tok.children))
    wrap.appendChild(inner)
    wrap.appendChild(makeCellMark(tok.delim))
    return wrap
  }
  if (tok.type === 'code') {
    const wrap = document.createElement('span')
    wrap.className = 'cm-atomic-inline-code-wrap'
    wrap.appendChild(makeCellMark('`'))
    const inner = document.createElement('span')
    inner.className = 'cm-atomic-inline-code'
    inner.textContent = tok.text
    wrap.appendChild(inner)
    wrap.appendChild(makeCellMark('`'))
    return wrap
  }
  if (tok.type === 'em') {
    const wrap = document.createElement('span')
    wrap.className = 'cm-atomic-em-wrap'
    wrap.appendChild(makeCellMark(tok.delim))
    const inner = document.createElement('span')
    inner.className = 'cm-atomic-em'
    inner.appendChild(renderTokensTo(tok.children))
    wrap.appendChild(inner)
    wrap.appendChild(makeCellMark(tok.delim))
    return wrap
  }
  if (tok.type === 'strike') {
    const wrap = document.createElement('span')
    wrap.className = 'cm-atomic-strike-wrap'
    wrap.appendChild(makeCellMark('~~'))
    const inner = document.createElement('span')
    inner.className = 'cm-atomic-strike'
    inner.appendChild(renderTokensTo(tok.children))
    wrap.appendChild(inner)
    wrap.appendChild(makeCellMark('~~'))
    return wrap
  }
  if (tok.type === 'wikilink') {
    const wrap = document.createElement('span')
    wrap.className = 'cm-atomic-link-wrap cm-atomic-wikilink-wrap'
    wrap.dataset.url = tok.url
    wrap.dataset.wikiLinkTarget = tok.url
    wrap.appendChild(makeCellMark('[['))
    const inner = document.createElement('span')
    inner.className = 'cm-atomic-link cm-atomic-wiki-link' // Use wiki-link to match CSS
    inner.dataset.url = tok.url
    inner.dataset.wikiLinkTarget = tok.url
    inner.appendChild(renderTokensTo(tok.textChildren))
    wrap.appendChild(inner)
    wrap.appendChild(makeCellMark(']]'))
    return wrap
  }
  // Link. Shape mirrors the outer-editor markup: `.cm-atomic-link` on
  // the visible text (picks up link color + external-link icon via
  // `::after`), faint marks for `[`, `]`, `(`, URL, `)`. `data-url`
  // lets the cell-source click handler open the right URL without
  // re-parsing.
  const wrap = document.createElement('span')
  wrap.className = 'cm-atomic-link-wrap'
  wrap.dataset.url = tok.url
  wrap.appendChild(makeCellMark('['))
  const inner = document.createElement('span')
  inner.className = 'cm-atomic-link'
  inner.appendChild(renderTokensTo(tok.textChildren))
  wrap.appendChild(inner)
  wrap.appendChild(makeCellMark(']'))
  wrap.appendChild(makeCellMark('('))
  const urlMark = makeCellMark(tok.url)
  urlMark.classList.add('cm-atomic-link-url')
  wrap.appendChild(urlMark)
  wrap.appendChild(makeCellMark(')'))
  // Real, clickable external-link icon. A CSS `::after` pseudo can't
  // receive a click (no event target), so the icon is its own
  // non-editable element; the source's delegated click handler opens
  // the URL. `contenteditable=false` keeps it out of caret navigation
  // and out of the cell's serialized text.
  const icon = document.createElement('span')
  icon.className = 'cm-atomic-link-icon'
  icon.setAttribute('aria-hidden', 'true')
  wrap.appendChild(icon)
  return wrap
}
function renderTokensTo(tokens) {
  const frag = document.createDocumentFragment()
  for (const tok of tokens) frag.appendChild(renderCellToken(tok))
  return frag
}
function makeCellMark(text) {
  const el = document.createElement('span')
  el.className = 'cm-atomic-mark'
  el.textContent = text
  return el
}
// Render a cell source element in its decorated form. Safe to call
// multiple times — overwrites whatever was there.
//
// Marks start collapsed: all `.cm-atomic-mark` descendants (delimiters
// like `**`, `_`, `~~`, `[`, `]`, `(`, `)`, and URL text) are hidden
// via CSS by default. When the caret enters a mark wrap, JS adds an
// `active` class that reveals that wrap's delimiters — mirroring the
// outer editor's cursor-inside-link unfold for every inline mark.
function renderCellSourceDecorated(source) {
  const raw = source.parentElement?.dataset.raw ?? ''
  source.replaceChildren(buildCellSourceDom(raw))
}
// Caret utilities — encode positions as character offsets within the
// element's textContent so we can survive the full-DOM re-render that
// follows every keystroke (new marks need to decorate immediately;
// the whole tree rebuilds from scratch).
export function getCaretCharOffset(container) {
  const selection = container.ownerDocument?.defaultView?.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (!container.contains(range.startContainer)) return null
  const pre = range.cloneRange()
  pre.selectNodeContents(container)
  pre.setEnd(range.startContainer, range.startOffset)
  return pre.toString().length
}
export function setCaretCharOffset(container, offset) {
  const doc = container.ownerDocument
  const win = doc?.defaultView || doc?.parentWindow
  if (!win) return
  const sel = win.getSelection()
  if (!sel) return
  const range = doc.createRange()
  let chars = 0
  let found = false
  function traverse(node) {
    if (found) return
    if (node.nodeType === 3) {
      const next = chars + node.length
      if (offset <= next) {
        range.setStart(node, offset - chars)
        range.setEnd(node, offset - chars)
        found = true
      }
      chars = next
    } else {
      for (let i = 0; i < node.childNodes.length; i++) traverse(node.childNodes[i])
    }
  }
  traverse(container)
  if (!found) {
    range.selectNodeContents(container)
    range.collapse(false)
  }
  sel.removeAllRanges()
  sel.addRange(range)
}

function restoreFocusAfterHistory(view, cell, source, action) {
  const wrap = cell.closest('.cm-atomic-table')
  if (!wrap) {
    action()
    return
  }

  const range = findCurrentTableRange(view, wrap)
  if (!range) {
    action()
    return
  }

  const tr = cell.closest('tr')
  if (!tr) {
    action()
    return
  }

  const isHeader = cell.tagName === 'TH'
  const rows = Array.from(wrap.querySelectorAll(isHeader ? 'thead tr' : 'tbody tr'))
  const rowIdx = isHeader ? -1 : rows.indexOf(tr)
  const cells = Array.from(tr.querySelectorAll('th, td'))
  const colIdx = cells.indexOf(cell)
  const offset = getCaretCharOffset(source) || 0

  action()

  const { from } = range
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const tables = Array.from(view.dom.querySelectorAll('.cm-atomic-table'))
      let targetWrap = null
      const head = view.state.selection.main.head

      for (const w of tables) {
        const r = findCurrentTableRange(view, w)
        if (r && r.from <= head && r.to >= head) {
          targetWrap = w
          break
        }
      }

      if (!targetWrap) {
        for (const w of tables) {
          const r = findCurrentTableRange(view, w)
          if (r && r.from === from) {
            targetWrap = w
            break
          }
        }
      }

      if (targetWrap) {
        const trs = Array.from(targetWrap.querySelectorAll(isHeader ? 'thead tr' : 'tbody tr'))
        const targetTr = trs[Math.max(0, Math.min(isHeader ? 0 : rowIdx, trs.length - 1))]
        if (targetTr) {
          const targetCells = Array.from(targetTr.querySelectorAll('th, td'))
          const targetCell = targetCells[Math.max(0, Math.min(colIdx, targetCells.length - 1))]
          if (targetCell) {
            const newSource = targetCell.querySelector('.cm-atomic-table-cell-source')
            if (newSource) {
              newSource.focus()
              setCaretCharOffset(newSource, Math.min(offset, (newSource.textContent || '').length))
            }
          }
        }
      }
    })
  })
}
const MARK_WRAP_CLASSES = [
  'cm-atomic-strong-wrap',
  'cm-atomic-em-wrap',
  'cm-atomic-strike-wrap',
  'cm-atomic-link-wrap',
  'cm-atomic-inline-code-wrap'
]
function isMarkWrap(el) {
  for (const c of MARK_WRAP_CLASSES) if (el.classList.contains(c)) return true
  return false
}
// Reveal the delimiters of whatever mark wrap(s) contain the caret,
// and collapse every other wrap in this cell. Walks from the caret
// anchor up to the source element, flagging every ancestor mark wrap
// so nested marks (bold-containing-italic) all reveal together — the
// user sees the full structure around their caret.
function updateActiveMarkForSource(source) {
  // Clear existing `active` classes within this cell only — other
  // cells track their own state via their own focus lifecycle.
  for (const el of source.querySelectorAll('.active')) {
    el.classList.remove('active')
  }
  const doc = source.ownerDocument
  if (!doc) return
  const selection = doc.defaultView?.getSelection()
  if (!selection || selection.rangeCount === 0) return
  const anchor = selection.anchorNode
  if (!anchor || !source.contains(anchor)) return
  let node = anchor
  while (node && node !== source) {
    if (node instanceof Element && isMarkWrap(node)) {
      node.classList.add('active')
    }
    node = node.parentNode
  }
}
function clearActiveMarksInSource(source) {
  for (const el of source.querySelectorAll('.active')) {
    el.classList.remove('active')
  }
}
// Scan raw markdown for `![alt](url)` occurrences. The regex bans `]`
// inside the alt and whitespace inside the URL so we fail closed on
// malformed sources rather than embedding a broken preview.
function extractCellImages(text) {
  const imgs = []
  const re = /!\[([^\]]*)\]\(([^\s)"']+)(?:\s+["'][^)]*["'])?\)/g
  for (const match of text.matchAll(re)) {
    imgs.push({ alt: match[1] || '', src: match[2] })
  }
  return imgs
}
// Refresh (or remove) the image-preview strip that sits below the
// source line. Mirrors how images render outside tables: the
// `![alt](url)` markdown is the source of truth, but on an inactive
// cell (no focus inside) the raw source hides and only the rendered
// image remains visible. `data-has-image` flips on for that CSS hook.
function refreshCellPreview(cell) {
  const existing = cell.querySelector('.cm-atomic-table-cell-preview')
  if (existing) existing.remove()
  const text = cell.dataset.raw ?? ''
  const imgs = extractCellImages(text)
  if (imgs.length === 0) {
    delete cell.dataset.hasImage
    return
  }
  cell.dataset.hasImage = 'true'
  const preview = document.createElement('div')
  preview.className = 'cm-atomic-table-cell-preview'
  // Preview is visual only — no caret, no contenteditable scope.
  // Keeping it out of contenteditable also means clicking the image
  // won't create a phantom caret position at the preview boundary.
  preview.contentEditable = 'false'
  for (const { src, alt } of imgs) {
    const img = document.createElement('img')
    img.src = src
    img.alt = alt
    img.loading = 'lazy'
    img.className = 'cm-atomic-table-cell-image'
    // Clicking the image puts the caret in the source text so the
    // user can edit the underlying markdown — same affordance as
    // clicking a block-level image outside a table.
    img.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      event.stopPropagation()
      const source = getCellSource(cell)
      if (!source) return
      source.focus()
      placeCaretAtEnd(source)
    })
    preview.appendChild(img)
  }
  cell.appendChild(preview)
}
// ---- position resolution --------------------------------------------
// posAtDOM on a block-replace widget returns the start of the replaced
// range. Walk the tree from there to find the enclosing Table node so
// our dispatch targets the current range (positions shift as the user
// types — we can't rely on the from/to captured at widget creation).
function findCurrentTableRange(view, dom) {
  const pos = view.posAtDOM(dom)
  if (pos < 0) return null
  const tree = syntaxTree(view.state)
  let node = tree.resolveInner(pos, 1)
  while (node && node.name !== 'Table') node = node.parent
  if (node) return { from: node.from, to: node.to }
  // Fallback: scan for the nearest Table node containing or starting
  // at pos. Rare — resolveInner + parent walk handles almost every
  // case — but guards against parser edge cases.
  let found = null
  tree.iterate({
    enter: (n) => {
      if (n.name !== 'Table') return
      if (n.from <= pos && n.to >= pos) {
        found = n.node
        return false
      }
    }
  })
  if (found) return { from: found.from, to: found.to }
  return null
}
// ---- DOM helpers ----------------------------------------------------
function placeCaretAtEnd(el) {
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  const sel = window.getSelection()
  if (!sel) return
  sel.removeAllRanges()
  sel.addRange(range)
}
function getAllCells(wrap) {
  return Array.from(wrap.querySelectorAll('th, td'))
}
// ---- widget ---------------------------------------------------------
class TableWidget extends WidgetType {
  constructor(model) {
    super()
    Object.defineProperty(this, 'model', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: model
    })
  }
  // Structure-only equality. Typing in a cell produces a new
  // TableWidget with the same dimensions but different cell contents.
  // Returning true here means CM6 keeps the existing DOM instead of
  // calling `toDOM` again — which is what lets the caret survive
  // across the per-keystroke dispatch cycle.
  eq(other) {
    if (other.model.header.length !== this.model.header.length) return false
    if (other.model.rows.length !== this.model.rows.length) return false
    for (let i = 0; i < this.model.header.length; i++) {
      if (other.model.header[i] !== this.model.header[i]) return false
      if (other.model.alignments?.[i] !== this.model.alignments?.[i]) return false
    }
    for (let r = 0; r < this.model.rows.length; r++) {
      for (let c = 0; c < this.model.rows[r].length; c++) {
        if (other.model.rows[r][c] !== this.model.rows[r][c]) return false
      }
    }
    return true
  }
  toDOM(view) {
    const wrap = document.createElement('div')
    wrap.className = 'cm-atomic-table'
    wrap.tabIndex = -1

    wrap.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        event.stopPropagation()
        view.dispatch({
          selection: { anchor: 0, head: view.state.doc.length }
        })
        view.focus()
      }
    })

    wrap.addEventListener('mousedown', (event) => {
      // If the editor has a selection (like from Ctrl+A), clear it when clicking the table!
      if (!view.state.selection.main.empty) {
        const pos = view.posAtDOM(wrap)
        view.dispatch({ selection: { anchor: pos, head: pos } })
      }

      const source = event.target.closest('.cm-atomic-table-cell-source')
      if (source) return // Let normal focus happen if they clicked directly in the editable text

      // They clicked on padding, borders, or table margins
      event.preventDefault() // Prevent CodeMirror from taking focus and drawing a giant cursor

      const cell = event.target.closest('td, th')
      if (cell) {
        const innerSource = cell.querySelector('.cm-atomic-table-cell-source')
        if (innerSource) {
          innerSource.focus()
          placeCaretAtEnd(innerSource)
        }
      }
    })

    const table = document.createElement('table')
    wrap.appendChild(table)
    const thead = document.createElement('thead')
    const headerRow = document.createElement('tr')
    for (let i = 0; i < this.model.header.length; i++) {
      const cell = makeCell('th', this.model.header[i], view)
      if (this.model.alignments?.[i]) {
        cell.style.textAlign = this.model.alignments[i]
        const source = cell.querySelector('.cm-atomic-table-cell-source')
        if (source) source.style.textAlign = this.model.alignments[i]
      }
      headerRow.appendChild(cell)
    }
    thead.appendChild(headerRow)
    table.appendChild(thead)
    const tbody = document.createElement('tbody')
    const colCount = this.model.header.length
    for (const row of this.model.rows) {
      const tr = document.createElement('tr')
      for (let c = 0; c < colCount; c++) {
        const cell = makeCell('td', row[c] ?? '', view)
        if (this.model.alignments?.[c]) {
          cell.style.textAlign = this.model.alignments[c]
          const source = cell.querySelector('.cm-atomic-table-cell-source')
          if (source) source.style.textAlign = this.model.alignments[c]
        }
        tr.appendChild(cell)
      }
      tbody.appendChild(tr)
    }
    table.appendChild(tbody)
    
    setupTableSelection(wrap, view)
    return wrap
  }
  updateDOM(dom, view) {
    const theadTr = dom.querySelector('thead tr')
    if (!theadTr) return false
    const ths = Array.from(theadTr.querySelectorAll('th'))
    if (ths.length !== this.model.header.length) return false
    for (let i = 0; i < this.model.header.length; i++) {
      const source = ths[i].querySelector('.cm-atomic-table-cell-source')
      
      // Sync alignments
      if (this.model.alignments?.[i]) {
        ths[i].style.textAlign = this.model.alignments[i]
        if (source) source.style.textAlign = this.model.alignments[i]
      } else {
        ths[i].style.textAlign = ''
        if (source) source.style.textAlign = ''
      }

      if (source && source.textContent !== this.model.header[i]) {
        const isFocused = document.activeElement === source
        source.parentElement.dataset.raw = this.model.header[i]
        renderCellSourceDecorated(source)
        if (isFocused) placeCaretAtEnd(source)
      }
    }

    const tbody = dom.querySelector('tbody')
    if (!tbody) return false
    const trs = Array.from(tbody.querySelectorAll('tr'))
    if (trs.length !== this.model.rows.length) return false
    for (let r = 0; r < trs.length; r++) {
      const tds = Array.from(trs[r].querySelectorAll('td'))
      for (let c = 0; c < tds.length; c++) {
        const source = tds[c].querySelector('.cm-atomic-table-cell-source')
        
        // Sync alignments
        if (this.model.alignments?.[c]) {
          tds[c].style.textAlign = this.model.alignments[c]
          if (source) source.style.textAlign = this.model.alignments[c]
        } else {
          tds[c].style.textAlign = ''
          if (source) source.style.textAlign = ''
        }

        if (source && source.textContent !== this.model.rows[r][c]) {
          const isFocused = document.activeElement === source
          source.parentElement.dataset.raw = this.model.rows[r][c]
          renderCellSourceDecorated(source)
          if (isFocused) placeCaretAtEnd(source)
        }
      }
    }
    return true
  }
  // All cell interactions are handled by the listeners we attach in
  // `makeCell`; tell CM6 to stay out of events within the widget so
  // its own selection/click logic doesn't compete with contenteditable.
  ignoreEvent() {
    return true
  }
}
function makeCell(tag, text, view) {
  const cell = document.createElement(tag)
  cell.dataset.raw = text
  // The cell itself is not contenteditable — only the inner source
  // element is. This keeps the image preview strictly visual (no
  // phantom caret positions around images) while the source text
  // stays in a dedicated editable box above it.
  const source = document.createElement('div')
  source.className = 'cm-atomic-table-cell-source'
  source.contentEditable = view.state.readOnly ? 'false' : 'true'
  source.spellcheck = true
  // Decorated DOM on mount. Delimiters (`.cm-atomic-mark`) are
  // `display: none` by default — the caret can't navigate into them,
  // the reader sees a clean rendered view. When the caret enters a
  // mark wrap, JS adds `.active` to reveal that wrap's delimiters —
  // matching the outer-editor cursor-inside-link unfold, applied
  // uniformly to every inline mark inside cells.
  cell.appendChild(source)
  renderCellSourceDecorated(source)
  // Commit the cell's current DOM text to `dataset.raw`, re-render its
  // decorated form (so marks the user just typed — e.g. a new `**` pair
  // — decorate immediately), restore the caret across that rebuild, and
  // push the change into the document.
  let currentCellText = cell.dataset.raw
  const commit = () => {
    const newText = source.textContent || ''
    const offset = getCaretCharOffset(source)
    if (currentCellText !== newText) {
      currentCellText = newText
      cell.dataset.raw = newText
    }
    renderCellSourceDecorated(source)
    if (offset != null) setCaretCharOffset(source, offset)
    updateActiveMarkForSource(source)
    refreshCellPreview(cell)
    dispatchModelFromDom(view, cell)
  }

  const autocomplete = new TableAutocomplete(
    source,
    cell,
    commit,
    getCaretCharOffset,
    setCaretCharOffset
  )

  // IME / dead-key composition. `commit` rebuilds the contenteditable
  // DOM, and doing that mid-composition cancels the composition session
  // — dropping CJK input, accented characters, and dictation. Suppress
  // every update while composing and run one commit when it ends.
  let composing = false
  source.addEventListener('compositionstart', () => {
    composing = true
  })
  source.addEventListener('compositionend', () => {
    composing = false
    commit()
  })
  source.addEventListener('input', (event) => {
    if (composing || event.isComposing) return
    commit()
    autocomplete.handleInput()
  })
  // Paste: drop clipboard content in as a single line of plain text.
  // Without this, pasted rich HTML, newlines, or pipes land in the cell
  // verbatim; newlines and `|` corrupt the row. We flatten whitespace
  // and strip markup here, and `escapeCell` neutralizes any literal `|`
  // on serialize.
  source.addEventListener('paste', (event) => {
    event.preventDefault()
    const text = (event.clipboardData?.getData('text/plain') ?? '').replace(/\s+/g, ' ').trim()
    const sel = source.ownerDocument.defaultView?.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    range.deleteContents()
    range.insertNode(document.createTextNode(text))
    range.collapse(false)
    sel.removeAllRanges()
    sel.addRange(range)
    commit()
  })
  // Caret-position listeners. `focus` / `mouseup` / `keyup` cover the
  // three ways the caret can land in a new mark without firing an
  // input event (click-to-place, arrow-key nav, tab-into-cell). The
  // update is idempotent — redundant calls cost nothing.
  // Focus updates the active CodeMirror selection so history is anchored to the table
  source.addEventListener('focus', () => {
    view.dom.classList.add('cm-table-focused')
    updateActiveMarkForSource(source)
    const wrap = cell.closest('.cm-atomic-table')
    if (wrap) {
      const range = findCurrentTableRange(view, wrap)
      if (range) {
        // Sync CM selection to anchor table state
        view.dispatch({ selection: { anchor: range.from } })
      }
    }
  })
  source.addEventListener('mouseup', () => updateActiveMarkForSource(source))
  source.addEventListener('keyup', () => updateActiveMarkForSource(source))

  source.addEventListener('blur', (e) => {
    requestAnimationFrame(() => {
      if (
        !view.dom.contains(document.activeElement) ||
        !document.activeElement.closest('.cm-atomic-table')
      ) {
        view.dom.classList.remove('cm-table-focused')
      }
    })
    clearActiveMarksInSource(source)
    autocomplete.close()
    const wrap = cell.closest('.cm-atomic-table')
    if (wrap) {
      const range = findCurrentTableRange(view, wrap)
      if (range) {
        view.dispatch({ selection: { anchor: range.from } })
      }
    }
  })
  source.addEventListener('keydown', (event) => {
    if (autocomplete.handleKeyDown(event)) {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    if (event.key === '`') {
      const doc = source.ownerDocument
      const win = doc?.defaultView
      const sel = win?.getSelection()
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0)
        if (range.collapsed) {
          const text = source.textContent || ''
          const offset = getCaretCharOffset(source) || 0
          if (offset < text.length && text[offset] === '`') {
            // Skip over closing backtick
            setCaretCharOffset(source, offset + 1)
            updateActiveMarkForSource(source)
            event.preventDefault()
            event.stopPropagation()
            return
          } else {
            // Auto-pair
            const newText = text.slice(0, offset) + '``' + text.slice(offset)
            source.textContent = newText
            commit()
            setCaretCharOffset(source, offset + 1)
            updateActiveMarkForSource(source)
            event.preventDefault()
            event.stopPropagation()
            return
          }
        }
      }
    }

    // Enter mirrors Tab — advance to the next cell (appending a row past
    // the last one) instead of inserting a line break a single-line cell
    // can't represent. Shift reverses direction for both.
    if (event.key === 'Tab') {
      event.preventDefault()
      event.stopPropagation()
      moveCellFocus(view, cell, event.shiftKey ? -1 : 1)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      const thead = cell.closest('table')?.querySelector('thead tr')
      const colCount = thead ? thead.querySelectorAll('th').length : 1
      moveCellFocus(view, cell, event.shiftKey ? -colCount : colCount)
      return
    }

    if (event.key === 'ArrowUp') {
      const thead = cell.closest('table')?.querySelector('thead tr')
      const colCount = thead ? thead.querySelectorAll('th').length : 1
      moveCellFocus(view, cell, -colCount, { appendOnOverflow: false })
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (event.key === 'ArrowDown') {
      const thead = cell.closest('table')?.querySelector('thead tr')
      const colCount = thead ? thead.querySelectorAll('th').length : 1
      moveCellFocus(view, cell, colCount, { appendOnOverflow: false })
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (event.key === 'ArrowLeft') {
      const offset = getCaretCharOffset(source) || 0
      if (offset === 0) {
        moveCellFocus(view, cell, -1, { appendOnOverflow: false })
        event.preventDefault()
        event.stopPropagation()
        return
      }
    }
    if (event.key === 'ArrowRight') {
      const offset = getCaretCharOffset(source) || 0
      const textLen = source.textContent?.length || 0
      if (offset >= textLen) {
        moveCellFocus(view, cell, 1, { appendOnOverflow: false })
        event.preventDefault()
        event.stopPropagation()
        return
      }
    }

    if (event.key === 'Backspace') {
      const offset = getCaretCharOffset(source)
      const text = source.textContent || ''
      if (offset > 0 && offset < text.length && text[offset - 1] === '`' && text[offset] === '`') {
        // Delete both backticks
        const newText = text.slice(0, offset - 1) + text.slice(offset + 1)
        source.textContent = newText
        commit()
        setCaretCharOffset(source, offset - 1)
        updateActiveMarkForSource(source)
        event.preventDefault()
        event.stopPropagation()
        return
      }

      if (offset === 0) {
        event.preventDefault()
        event.stopPropagation()

        const wrap = cell.closest('.cm-atomic-table')
        if (wrap) {
          const text = source.textContent || ''
          const col = cellColIndex(cell)
          const rowIdx = cellRowIndex(cell)
          const isHeader = cell.tagName === 'TH'
          const m = readModelFromDom(wrap)

          if (text === '') {
            // Check if entire column is empty
            let colEmpty = m.header.length > 1
            if (colEmpty) {
              if (m.header[col].trim() !== '') colEmpty = false
              for (const r of m.rows) {
                if (r[col] && r[col].trim() !== '') colEmpty = false
              }
            }

            if (colEmpty) {
              // Save position BEFORE we modify the DOM
              const { from } = findCurrentTableRange(view, wrap) || { from: 0 }
              // Delete column
              m.header.splice(col, 1)
              for (const r of m.rows) r.splice(col, 1)
              dispatchModel(view, wrap, m)

              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  const tables = Array.from(view.dom.querySelectorAll('.cm-atomic-table'))
                  const target = tables.find((t) => {
                    try {
                      return view.posAtDOM(t) === from
                    } catch {
                      return false
                    }
                  })
                  if (target) {
                    const targetRow = target.querySelectorAll('tr')[isHeader ? 0 : rowIdx + 1]
                    if (targetRow) {
                      const newCells = targetRow.querySelectorAll('.cm-atomic-table-cell-source')
                      const focusCol = Math.max(0, col - 1)
                      if (newCells[focusCol]) {
                        newCells[focusCol].focus()
                        placeCaretAtEnd(newCells[focusCol])
                      }
                    }
                  }
                })
              })
              return
            }

            // Check if entire row is empty
            let rowEmpty = !isHeader && m.rows.length > 0
            if (rowEmpty) {
              for (const c of m.rows[rowIdx]) {
                if (c && c.trim() !== '') rowEmpty = false
              }
            }

            if (rowEmpty) {
              // Save position BEFORE we modify the DOM
              const { from } = findCurrentTableRange(view, wrap) || { from: 0 }
              // Delete row
              m.rows.splice(rowIdx, 1)
              dispatchModel(view, wrap, m)

              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  const tables = Array.from(view.dom.querySelectorAll('.cm-atomic-table'))
                  const target = tables.find((t) => {
                    try {
                      return view.posAtDOM(t) === from
                    } catch {
                      return false
                    }
                  })
                  if (target) {
                    const rows = target.querySelectorAll('tr')
                    const focusTr = rows[Math.max(0, rowIdx)]
                    if (focusTr) {
                      const newCells = focusTr.querySelectorAll('.cm-atomic-table-cell-source')
                      if (newCells[col]) {
                        newCells[col].focus()
                        placeCaretAtEnd(newCells[col])
                      }
                    }
                  }
                })
              })
              return
            }
          }

          // If not deleted, move focus to previous cell
          moveCellFocus(view, cell, -1)
          return
        }
      }
    }

    if (event.key === '|') {
      const doc = source.ownerDocument
      const win = doc?.defaultView
      const sel = win?.getSelection()
      if (sel && sel.rangeCount > 0) {
        const anchor = sel.anchorNode
        if (
          anchor &&
          anchor.parentElement &&
          anchor.parentElement.closest('.cm-atomic-inline-code-wrap')
        ) {
          // Inside inline code, allow typing literal pipe without splitting cell
          return
        }
      }

      event.preventDefault()
      event.stopPropagation()
      const text = source.textContent || ''
      const offset = getCaretCharOffset(source) || 0

      const leftText = text.substring(0, offset).trim()
      const rightText = text.substring(offset).trim()

      const wrap = cell.closest('.cm-atomic-table')
      const col = cellColIndex(cell)
      if (wrap && col >= 0) {
        const m = readModelFromDom(wrap)
        if (cell.tagName === 'TH') {
          m.header[col] = leftText
          m.header.splice(col + 1, 0, rightText)
          for (const r of m.rows) r.splice(col + 1, 0, '')
        } else {
          const row = cellRowIndex(cell)
          m.rows[row][col] = leftText
          m.header.splice(col + 1, 0, '')
          for (let r = 0; r < m.rows.length; r++) {
            if (r === row) {
              m.rows[r].splice(col + 1, 0, rightText)
            } else {
              m.rows[r].splice(col + 1, 0, '')
            }
          }
        }
        // Save position BEFORE we modify the DOM
        const { from } = findCurrentTableRange(view, wrap) || { from: 0 }
        dispatchModel(view, wrap, m)

        const isHeader = cell.tagName === 'TH'
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const tables = Array.from(view.dom.querySelectorAll('.cm-atomic-table'))
            const target = tables.find((t) => {
              try {
                return view.posAtDOM(t) === from
              } catch {
                return false
              }
            })
            if (target) {
              const rows = target.querySelectorAll('tr')
              const targetRow = rows[isHeader ? 0 : cellRowIndex(cell) + 1]
              if (targetRow) {
                const newCells = targetRow.querySelectorAll('.cm-atomic-table-cell-source')
                if (newCells[col + 1]) newCells[col + 1].focus()
              }
            }
          })
        })
        return
      }
    }

    // Forward Undo/Redo commands to CodeMirror view
    const isMac = /Mac/.test(navigator.platform)
    if ((isMac ? event.metaKey : event.ctrlKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      event.stopPropagation()

      // Sync CodeMirror selection to the table so undo doesn't jump to the top
      const wrap = cell.closest('.cm-atomic-table')
      if (wrap) {
        const range = findCurrentTableRange(view, wrap)
        if (range) {
          view.dispatch({ selection: { anchor: range.from } })
        }
      }

      restoreFocusAfterHistory(view, cell, source, () => {
        if (event.shiftKey) {
          redo(view)
        } else {
          undo(view)
        }
      })
      return
    }
    if (!isMac && event.ctrlKey && event.key.toLowerCase() === 'y') {
      event.preventDefault()
      event.stopPropagation()
      const wrap = cell.closest('.cm-atomic-table')
      if (wrap) {
        const range = findCurrentTableRange(view, wrap)
        if (range) {
          view.dispatch({ selection: { anchor: range.from } })
        }
      }
      restoreFocusAfterHistory(view, cell, source, () => {
        redo(view)
      })
      return
    }
  })
  cell.addEventListener('contextmenu', (event) => {
    event.preventDefault()
    event.stopPropagation()
    openCellMenu(view, cell, event.clientX, event.clientY)
  })
  // Link-icon open. The external-link icon is rendered as a real
  // `.cm-atomic-link-icon` element (see `renderCellToken`), not a CSS
  // `::after` pseudo — a pseudo-element has no event target, so clicking
  // its painted region dispatched no pointer event and the link never
  // opened. We open on `click` (a proper popup-activation gesture, so
  // `window.open` isn't blocked) and block the caret on `pointerdown`.
  const linkIconFromEvent = (event) => {
    const target = event.target
    if (!(target instanceof Element)) return null
    return target.closest('.cm-atomic-link-icon')
  }
  source.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    // Block focus / caret placement when pressing the icon; the open
    // happens on the following `click`.
    if (linkIconFromEvent(event)) event.preventDefault()
  })
  source.addEventListener('click', (event) => {
    const icon = linkIconFromEvent(event)
    if (!icon) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const url = icon.closest('.cm-atomic-link-wrap')?.dataset.url
    if (!url) return
    event.preventDefault()
    event.stopPropagation()
    view.state.facet(tableLinkClickFacet)(url)
  })
  // When the cell has an image and the source is visually hidden,
  // clicks land on the cell/image/empty space but not on the source
  // itself. Route every pointerdown inside the cell to a focus on
  // the source so the user can edit regardless of where they tapped.
  // The image's own pointerdown handler already does this, but
  // covers only image hits — this covers empty padding and the
  // space between/around images.
  cell.addEventListener('pointerdown', (event) => {
    // A click on the editable source — including its inner mark spans
    // and text — must keep the browser's native caret placement. Forcing
    // focus-at-end here would yank the caret to the end of the cell
    // whenever the user clicks a styled run (bold/italic/link). Only
    // intercept clicks that land OUTSIDE the source (cell padding, the
    // image preview, the cell box itself) to route focus into it.
    const target = event.target
    if (target instanceof Node && source.contains(target)) return
    event.preventDefault()
    source.focus()
    placeCaretAtEnd(source)
  })
  refreshCellPreview(cell)
  return cell
}
// ---- context menu -------------------------------------------------
export function dispatchModel(view, wrap, nextModel) {
  const range = findCurrentTableRange(view, wrap)
  if (!range) return
  const next = serializeTable(nextModel)
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: next }
  })
}
function dispatchModelFromDom(view, cell) {
  const wrap = cell.closest('.cm-atomic-table')
  if (!wrap) return
  const range = findCurrentTableRange(view, wrap)
  if (!range) return
  const model = readModelFromDom(wrap)
  const next = serializeTable(model)

  const oldText = view.state.sliceDoc(range.from, range.to)
  if (oldText === next) return

  let start = 0
  while (start < oldText.length && start < next.length && oldText[start] === next[start]) {
    start++
  }
  let endOld = oldText.length
  let endNext = next.length
  while (endOld > start && endNext > start && oldText[endOld - 1] === next[endNext - 1]) {
    endOld--
    endNext--
  }

  view.dispatch({
    changes: {
      from: range.from + start,
      to: range.from + endOld,
      insert: next.substring(start, endNext)
    },
    selection: { anchor: range.from + start + next.substring(start, endNext).length },
    // Tag as typing so CM6's history coalesces consecutive cell edits
    // gracefully. Because we are now dispatching fine-grained diffs,
    // CM6 will naturally break history groups on word boundaries/spaces
    // just like standard typing!
    annotations: Transaction.userEvent.of('input.type')
  })
}
function moveCellFocus(view, cell, dir, opts = { appendOnOverflow: true }) {
  const wrap = cell.closest('.cm-atomic-table')
  if (!wrap) return
  const cells = getAllCells(wrap)
  const idx = cells.indexOf(cell)
  if (idx < 0) return
  const next = idx + dir
  if (next < 0) {
    const pos = view.posAtDOM(wrap)
    if (pos !== null) {
      view.dispatch({ selection: { anchor: pos } })
      view.focus()
    }
    return
  }
  if (next >= cells.length) {
    if (opts.appendOnOverflow) {
      const thead = wrap.querySelector('thead tr')
      const colCount = thead ? thead.querySelectorAll('th').length : 1
      appendRow(view, wrap, idx % colCount)
    } else {
      // jump out below
      const range = findCurrentTableRange(view, wrap)
      if (range) {
        view.dispatch({ selection: { anchor: range.to } })
        view.focus()
      }
    }
    return
  }
  const source = getCellSource(cells[next])
  if (!source) return
  source.focus()
  
  if (dir > 0) {
    // Moving forward/down: place caret at start
    const sel = source.ownerDocument?.defaultView?.getSelection()
    if (sel) {
      const range = document.createRange()
      range.selectNodeContents(source)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
    }
  } else {
    // Moving backward/up: place caret at end
    placeCaretAtEnd(source)
  }
}
function appendRow(view, wrap, focusColIndex = 0) {
  const range = findCurrentTableRange(view, wrap)
  if (!range) return
  const model = readModelFromDom(wrap)
  model.rows.push(model.header.map(() => ''))
  const next = serializeTable(model)
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: next }
  })
  // Adding a row changes the widget's row count, so `eq` returns
  // false and CM6 rebuilds the widget DOM. The old `wrap` reference
  // is now detached. Wait for the paint that attaches the new DOM,
  // then look up the fresh widget by position and focus its new
  // last-row cell. Double-rAF because the first rAF only guarantees
  // CM6 has processed the dispatch; the second ensures the layout
  // has painted so focus commands don't get lost.
  const { from } = range
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const tables = Array.from(view.dom.querySelectorAll('.cm-atomic-table'))
      let target = null
      for (const el of tables) {
        try {
          if (view.posAtDOM(el) === from) {
            target = el
            break
          }
        } catch {
          // posAtDOM can throw on detached/transitional DOM nodes
          // — skip and keep looking.
        }
      }
      if (!target) return
      const rows = target.querySelectorAll('tbody tr')
      if (!rows.length) return
      const lastRow = rows[rows.length - 1]
      const newCells = lastRow.querySelectorAll('.cm-atomic-table-cell-source')
      const cellToFocus = newCells[focusColIndex] || newCells[0]
      if (cellToFocus) cellToFocus.focus()
    })
  })
}
// Backspace at the line immediately after a table normally deletes
// the `\n` separator and merges the line-below into the table's last
// source line. Lezer then re-parses the merged content as part of
// the table (or mangles it), producing the "swallow" behavior where
// content below the table looks like it's been absorbed as new rows.
//
// Instead, when the caret sits right after a Table and the user hits
// backspace, select the whole Table range — same pattern Obsidian
// uses for treating the table as an atomic unit for deletion. The
// caller can press backspace again to actually delete the selected
// table.
function backspaceAtTableBoundary(view) {
  const { state } = view
  const sel = state.selection.main
  if (!sel.empty) return false
  const pos = sel.head
  if (pos === 0) return false
  const tree = syntaxTree(state)
  let tableBefore = null
  // Scan a few positions back for a Table whose end is adjacent to
  // the caret. `table.to` is the position just after the table's
  // last character — if the caret sits on the next line, `pos` will
  // be one past `table.to` (the \n separator at `table.to` + start
  // of the line after). Accept both.
  tree.iterate({
    from: Math.max(0, pos - 2),
    to: pos,
    enter: (n) => {
      if (n.name !== 'Table') return
      if (n.to === pos || n.to + 1 === pos) {
        tableBefore = n.node
      }
    }
  })
  if (!tableBefore) return false
  const range = tableBefore
  view.dispatch({
    selection: EditorSelection.range(range.from, range.to)
  })
  return true
}
// ---- state field ----------------------------------------------------
function buildTableWidgets(state) {
  const ranges = []
  // Force full-doc parse so tables past the initial parsed region
  // also get the widget treatment. This StateField only rebuilds on
  // doc change; CM6's background parser advancing the tree later
  // doesn't retrigger it, so a partial tree at mount means orphaned
  // `| col |` raw lines for the rest of the session. 200ms budget
  // bounds the worst case on very long atoms.
  const tree = ensureSyntaxTree(state, state.doc.length, 200) ?? syntaxTree(state)
  const doc = state.doc
  tree.iterate({
    enter: (node) => {
      if (node.name !== 'Table') return
      const model = parseTable(state, node.node)
      if (!model) return
      // Block-replace needs whole-line coverage.
      const startLine = doc.lineAt(node.from)
      const endLine = doc.lineAt(node.to)
      ranges.push(
        Decoration.replace({
          widget: new TableWidget(model),
          block: true
        }).range(startLine.from, endLine.to)
      )
      return false // don't descend
    }
  })
  return Decoration.set(ranges, true)
}
// Detect whether a doc change could have added, removed, or modified
// a Table node. Two cheap signals:
//
//   1. Any existing table decoration overlaps the changed range
//      (edit to / deletion of an existing table).
//   2. Any line touched by the change contains a pipe `|`. GFM
//      tables are pipe-delimited, so every table line has one and
//      editing one without touching a pipe character is impossible.
//      Prose rarely contains pipes; the occasional false positive
//      is fine because `buildTableWidgets` fails cleanly when
//      lezer didn't emit a Table.
//
// If neither fires, skip the full-doc walk and just map existing
// decorations through the change.
function changeAffectsTables(tr, existing) {
  let affected = false
  tr.changes.iterChanges((fromA, toA) => {
    if (affected) return
    existing.between(fromA, toA, () => {
      affected = true
      return false
    })
  })
  if (affected) return true
  const state = tr.state
  tr.changes.iterChanges((_fromA, _toA, fromB, toB) => {
    if (affected) return
    const startLine = state.doc.lineAt(fromB)
    const endLine = toB > startLine.to ? state.doc.lineAt(toB) : startLine
    for (let n = startLine.number; n <= endLine.number; n++) {
      if (state.doc.line(n).text.includes('|')) {
        affected = true
        break
      }
    }
  })
  return affected
}
const tableField = StateField.define({
  create: (state) => buildTableWidgets(state),
  update(deco, tr) {
    // Tree-growth effect: lezer's background parser caught up to a
    // region that wasn't parsed when we last built. Rebuild so any
    // newly-visible Table nodes get their widget.
    for (const effect of tr.effects) {
      if (effect.is(treeGrowthEffect)) return buildTableWidgets(tr.state)
    }
    if (!tr.docChanged) return deco
    const mapped = deco.map(tr.changes)
    if (!changeAffectsTables(tr, deco)) return mapped
    return buildTableWidgets(tr.state)
  },
  provide: (f) => EditorView.decorations.from(f)
})
const defaultLinkOpener = (url) => {
  try {
    window.open(url, '_blank', 'noopener,noreferrer')
  } catch {
    // window.open can throw in sandboxed iframes etc.
  }
}
// Per-view facet so `makeCell`'s pointerdown handler can look up the
// current link-click callback. Avoids threading the config through the
// widget constructor and toDOM args.
export const tableLinkClickFacet = Facet.define({
  combine: (values) => values[0] ?? defaultLinkOpener
})

const tableSelectionSyncPlugin = ViewPlugin.fromClass(class {
  update(update) {
    if (update.selectionSet || update.docChanged || update.viewportChanged) {
      this.syncSelection(update.view)
    }
  }
  syncSelection(view) {
    const sel = view.state.selection.main
    const tables = view.dom.querySelectorAll('.cm-atomic-table')
    for (const table of tables) {
      const pos = view.posAtDOM(table)
      // Check if this pos is inside the selection
      if (pos !== null && pos >= sel.from && pos <= sel.to && !sel.empty) {
        table.classList.add('cm-widget-selected-by-cm')
      } else {
        table.classList.remove('cm-widget-selected-by-cm')
      }
    }
  }
})

export function tables(config = {}) {
  setupTableFormattingToolbar()
  return [
    tableField,
    treeProgressPlugin,
    tableSelectionSyncPlugin,
    ...(config.onLinkClick ? [tableLinkClickFacet.of(config.onLinkClick)] : []),
    Prec.high(keymap.of([{ key: 'Backspace', run: backspaceAtTableBoundary }]))
  ]
}
