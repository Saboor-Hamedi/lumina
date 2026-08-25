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
  const widths = []
  let delimiterLine = ''
  const cursor = tableNode.cursor()
  if (!cursor.firstChild()) return null
  do {
    if (cursor.name === 'TableHeader') {
      const cells = collectCells(state, cursor.node)
      for (let i = 0; i < cells.length; i++) {
        let text = cells[i]
        const wMatch = text.match(/<!--\s*width:\s*(\d+px)\s*-->/)
        if (wMatch) {
          widths[i] = wMatch[1]
          text = text.replace(/<!--\s*width:\s*\d+px\s*-->/, '').trim()
        } else {
          widths[i] = ''
        }
        header.push(text)
      }
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

  return { header, rows, alignments, widths }
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

  const headerCells = []
  for (let c = 0; c < columnCount; c++) {
    let text = escapeCell(model.header[c] ?? '')
    if (model.widths?.[c]) {
      text += ` <!-- width: ${model.widths[c]} -->`
    }
    headerCells.push(text)
  }
  lines.push('| ' + headerCells.join(' | ') + ' |')

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
  const widths = Array.from(wrap.querySelectorAll('thead th')).map((th) => th.style.width || '')
  const alignments = Array.from(wrap.querySelectorAll('thead th')).map((th) => {
    if (th.style.textAlign === 'center') return 'center'
    if (th.style.textAlign === 'right') return 'right'
    if (th.style.textAlign === 'left') return 'left'
    return ''
  })
  const rows = Array.from(wrap.querySelectorAll('tbody tr')).map((tr) =>
    Array.from(tr.querySelectorAll('td')).map(readCellSource)
  )
  return { header, rows, alignments, widths }
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
