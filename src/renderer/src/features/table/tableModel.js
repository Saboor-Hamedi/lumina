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

  return { header, rows, alignments }
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
export function readCellSource(cell) {
  return (cell.dataset.raw ?? '').trim()
}
export function getCellSource(cell) {
  return cell.querySelector('.cm-atomic-table-cell-source')
}
