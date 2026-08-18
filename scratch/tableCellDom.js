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
              if (m.alignments) m.alignments.splice(col, 1)
              if (m.widths) m.widths.splice(col, 1)
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
          if (m.alignments) m.alignments.splice(col + 1, 0, '')
          if (m.widths) m.widths.splice(col + 1, 0, '')
          for (const r of m.rows) r.splice(col + 1, 0, '')
        } else {
          const row = cellRowIndex(cell)
          m.rows[row][col] = leftText
          m.header.splice(col + 1, 0, '')
          if (m.alignments) m.alignments.splice(col + 1, 0, '')
          if (m.widths) m.widths.splice(col + 1, 0, '')
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
    if (view.state.readOnly) return
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
  source.addEventListener('keydown', (event) => {
    if (view.state.readOnly) return
    if (event.key === 'Tab') {return}
  })
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
