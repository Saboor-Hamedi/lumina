import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { Decoration, EditorView, WidgetType, keymap, ViewPlugin } from '@codemirror/view'
import { StateField, StateEffect, Facet } from '@codemirror/state'
import { undo, redo } from '@codemirror/commands'
import { treeGrowthEffect, treeProgressPlugin } from './tree-progress'
import { useVaultStore } from '../../core/store/useVaultStore'
import { TableAutocomplete } from './wikilinkAutocompletion'
import { setupTableFormattingToolbar } from './tableFormattingToolbar'
import { openCellMenu } from './tableContextMenu'
import { setupTableSelection } from './tableGridSelection'
import { icons } from './icons.js'

export function collectCells(state, rowNode) {
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
    // a GFM cell). Unescape `\|` back to `|` for our internal model,
    // but preserve backslashes for everything else so we don't lose data.
    if (ch === '\\' && i + 1 < s.length) {
      if (s[i + 1] === '|') {
        buf += '|'
      } else {
        buf += '\\' + s[i + 1]
      }
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
export function parseTable(state, tableNode) {
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

  let caption = ''
  const startLine = state.doc.lineAt(tableNode.from)
  if (startLine.number > 1) {
    const prevLine = state.doc.line(startLine.number - 1).text.trim()
    const titleMatch = prevLine.match(/^<!--\s*table:\s*(.*?)\s*-->$/i) || prevLine.match(/^Table:\s*(.+)$/i)
    if (titleMatch) {
      caption = titleMatch[1].trim()
    }
  }

  return { header, rows, alignments, caption }
}
// Escape cell content so it can't break the row's GFM structure: an
// unescaped `|` would split the cell into two columns, and a stray
// newline would terminate the table. A pipe that's already escaped
// (`\|` — e.g. round-tripping content the parser handed us) is left
// alone so serialize is idempotent.
export function escapeCell(text) {
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

  if (model.caption && model.caption.trim()) {
    lines.push(`<!-- table: ${model.caption.trim()} -->`)
  }

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
  const alignments = Array.from(wrap.querySelectorAll('thead th')).map((th) => {
    if (th.style.textAlign === 'center') return 'center'
    if (th.style.textAlign === 'right') return 'right'
    if (th.style.textAlign === 'left') return 'left'
    return ''
  })
  const rows = Array.from(wrap.querySelectorAll('tbody tr')).map((tr) =>
    Array.from(tr.querySelectorAll('td')).map(readCellSource)
  )
  const titleInput = wrap.querySelector('.cm-table-ui-title-input')
  const caption = titleInput ? titleInput.value.trim() : (wrap.dataset.caption || '')
  return { header, rows, alignments, caption }
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
export function readCellSource(cell) {
  if (cell.dataset.raw !== undefined && cell.dataset.raw !== null) {
    return cell.dataset.raw.trim()
  }
  const source = cell.querySelector('.cm-atomic-table-cell-source')
  return (source ? source.textContent : '').trim()
}
export function getCellSource(cell) {
  return cell.querySelector('.cm-atomic-table-cell-source')
}

/**
 * Robustly parses any raw markdown table string into a clean table model.
 */
export function serializeTableOnly(model) {
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

export function parseMarkdownTableText(markdown, defaultCaption = '') {
  const lines = markdown.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0)
  if (lines.length === 0) return null

  let caption = defaultCaption || ''
  let startIdx = 0
  if (lines[0].match(/^<!--\s*table:\s*(.*?)\s*-->$/i) || lines[0].match(/^Table:\s*(.+)$/i)) {
    const m = lines[0].match(/^<!--\s*table:\s*(.*?)\s*-->$/i) || lines[0].match(/^Table:\s*(.+)$/i)
    caption = m[1].trim()
    startIdx = 1
  }

  if (startIdx >= lines.length) return null

  const headerLine = lines[startIdx]
  const header = splitRowCells(headerLine)
  if (header.length === 0) return null

  let alignments = Array(header.length).fill('')
  let delimiterIdx = startIdx + 1
  if (delimiterIdx < lines.length && lines[delimiterIdx].includes('-')) {
    const delimCells = splitRowCells(lines[delimiterIdx])
    alignments = delimCells.map((s) => {
      const t = s.trim()
      if (t.startsWith(':') && t.endsWith(':')) return 'center'
      if (t.endsWith(':')) return 'right'
      if (t.startsWith(':')) return 'left'
      return ''
    })
    while (alignments.length < header.length) alignments.push('')
    startIdx = delimiterIdx + 1
  } else {
    startIdx = startIdx + 1
  }

  const rows = []
  for (let i = startIdx; i < lines.length; i++) {
    if (!lines[i].includes('|')) continue
    const cells = splitRowCells(lines[i])
    while (cells.length < header.length) cells.push('')
    rows.push(cells.slice(0, header.length))
  }

  if (rows.length === 0) {
    rows.push(Array(header.length).fill(''))
  }

  return { header, rows, alignments, caption }
}
