import './css/table.css'

const WRAP_CLASSES = {
  '**': 'cm-atomic-strong-wrap',
  '_':  'cm-atomic-em-wrap',
  '~~': 'cm-atomic-strike-wrap',
  '`':  'cm-atomic-inline-code-wrap'
}

// Return the innermost mark-wrap the caret/selection sits in, plus its tag.
function getActiveWrap(source) {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  let node = range.commonAncestorContainer
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
  for (const [tag, cls] of Object.entries(WRAP_CLASSES)) {
    const wrap = node?.closest('.' + cls)
    if (wrap && source.contains(wrap)) return { tag, cls, wrap }
  }
  return null
}

// Find the .cm-atomic-table-cell-source the caret/selection is in.
function getSourceFromSelection() {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  const anchor = range.startContainer
  const el = anchor.nodeType === Node.TEXT_NODE ? anchor.parentElement : anchor
  return el?.closest('.cm-atomic-table-cell-source') ?? null
}

export function setupTableFormattingToolbar() {
  if (document.getElementById('table-formatting-toolbar')) return

  const toolbar = document.createElement('div')
  toolbar.id = 'table-formatting-toolbar'
  toolbar.className = 'table-formatting-toolbar'
  toolbar.style.display = 'none'

  const actions = [
    { icon: '<b>B</b>',             tag: '**', label: 'Bold' },
    { icon: '<i>I</i>',             tag: '_',  label: 'Italic' },
    { icon: '<s>S</s>',             tag: '~~', label: 'Strikethrough' },
    { icon: '<code>&lt;&gt;</code>', tag: '`',  label: 'Code' }
  ]

  const buttons = {}
  actions.forEach(({ icon, tag, label }) => {
    const btn = document.createElement('button')
    btn.innerHTML = icon
    btn.setAttribute('data-tooltip', label)
    btn.setAttribute('data-tag', tag)
    btn.type = 'button'
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault() // keep caret/selection alive
      applyFormatting(tag)
    })
    toolbar.appendChild(btn)
    buttons[tag] = btn
  })

  document.body.appendChild(toolbar)

  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) {
      toolbar.style.display = 'none'
      return
    }

    const range = sel.getRangeAt(0)
    const source =
      range.startContainer.parentElement?.closest('.cm-atomic-table-cell-source') ||
      (range.startContainer.nodeType === Node.ELEMENT_NODE &&
        range.startContainer.closest('.cm-atomic-table-cell-source'))

    if (!source || !document.activeElement || !source.contains(document.activeElement)) {
      toolbar.style.display = 'none'
      return
    }

    // Don't show toolbar if we are just selecting across multiple nodes in a complex way for now,
    // or if we're in the middle of a mark
    const rect = range.getBoundingClientRect()

    toolbar.style.display = 'flex'
    toolbar.style.top = `${rect.top - toolbar.offsetHeight - 8}px`
    toolbar.style.left = `${rect.left + rect.width / 2 - toolbar.offsetWidth / 2}px`
  })
}

function applyFormatting(tag) {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) return

  const range = sel.getRangeAt(0)
  const source =
    range.startContainer.parentElement?.closest('.cm-atomic-table-cell-source') ||
    (range.startContainer.nodeType === Node.ELEMENT_NODE &&
      range.startContainer.closest('.cm-atomic-table-cell-source'))
  if (!source) return

  // ── Toggle-off via rendered mark wrap ─────────────────────────────────────
  // When the selection is inside (or spans) a rendered mark wrap of the same
  // type, replace the whole wrap with the plain inner text.
  const wrapClass =
    tag === '**' ? 'cm-atomic-strong-wrap'
    : tag === '_'  ? 'cm-atomic-em-wrap'
    : tag === '~~' ? 'cm-atomic-strike-wrap'
    : tag === '`'  ? 'cm-atomic-inline-code-wrap'
    : ''

  if (wrapClass) {
    let node = range.commonAncestorContainer
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
    const markWrap = node?.closest('.' + wrapClass)
    if (markWrap && source.contains(markWrap)) {
      // The inner span (.cm-atomic-strong / .cm-atomic-inline-code etc.)
      // holds the visible text without delimiters.
      const innerEl = markWrap.querySelector(
        '.cm-atomic-inline-code, .cm-atomic-strong, .cm-atomic-em, .cm-atomic-strike'
      )
      const innerContent = innerEl ? innerEl.textContent : markWrap.textContent
      const newRange = document.createRange()
      newRange.selectNode(markWrap)
      sel.removeAllRanges()
      sel.addRange(newRange)
      document.execCommand('insertText', false, innerContent)
      source.dispatchEvent(new Event('input', { bubbles: true }))
      const cell = source.closest('th, td')
      if (cell) {
        cell.dataset.raw = source.textContent || ''
      }
      return
    }
  }

  // ── Toggle-off via raw text ───────────────────────────────────────────────
  // Handles the case where the cell is in raw/unrendered mode and the user
  // has selected text that already includes the tag delimiters (e.g. "`hello`").
  const text = sel.toString()
  const trimmed = text.trim()
  if (trimmed.startsWith(tag) && trimmed.endsWith(tag) && trimmed.length >= tag.length * 2 + 1) {
    const inner = trimmed.substring(tag.length, trimmed.length - tag.length)
    const leading = text.substring(0, text.indexOf(trimmed))
    const trailing = text.substring(text.indexOf(trimmed) + trimmed.length)
    document.execCommand('insertText', false, leading + inner + trailing)
    source.dispatchEvent(new Event('input', { bubbles: true }))
    return
  }

  // ── Toggle-off via surrounding context ───────────────────────────────────
  // The source's full raw text lets us check if the selection is surrounded
  // by this tag even when the delimiters are hidden by the CSS.
  const rawText = source.textContent
  const selStr = sel.toString()
  const idx = rawText.indexOf(tag + selStr + tag)
  if (idx !== -1) {
    // Find and select the full wrapped text in the DOM, then replace it
    const fullWrapped = tag + selStr + tag
    // Rebuild a range that covers the full wrap in the source textContent
    const docRange = document.createRange()
    let charCount = 0
    let startNode = null, startOff = 0, endNode = null, endOff = 0
    const walk = (node) => {
      if (startNode && endNode) return
      if (node.nodeType === Node.TEXT_NODE) {
        const len = node.length
        if (!startNode && charCount + len > idx) {
          startNode = node
          startOff = idx - charCount
        }
        if (!endNode && charCount + len >= idx + fullWrapped.length) {
          endNode = node
          endOff = idx + fullWrapped.length - charCount
        }
        charCount += len
      } else {
        for (const child of node.childNodes) walk(child)
      }
    }
    walk(source)
    if (startNode && endNode) {
      docRange.setStart(startNode, startOff)
      docRange.setEnd(endNode, endOff)
      sel.removeAllRanges()
      sel.addRange(docRange)
      document.execCommand('insertText', false, selStr)
      source.dispatchEvent(new Event('input', { bubbles: true }))
      return
    }
  }

  // ── Wrap — add the tag delimiters ────────────────────────────────────────
  document.execCommand('insertText', false, `${tag}${text}${tag}`)
  source.dispatchEvent(new Event('input', { bubbles: true }))
}
