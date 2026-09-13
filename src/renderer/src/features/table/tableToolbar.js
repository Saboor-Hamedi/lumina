import './css/table.css'

export function setupTableFormattingToolbar() {
  if (document.getElementById('table-formatting-toolbar')) return

  const toolbar = document.createElement('div')
  toolbar.id = 'table-formatting-toolbar'
  toolbar.className = 'table-formatting-toolbar'
  toolbar.style.display = 'none'

  const actions = [
    { icon: '<b>B</b>', tag: '**', label: 'Bold' },
    { icon: '<i>I</i>', tag: '_', label: 'Italic' },
    { icon: '<s>S</s>', tag: '~~', label: 'Strikethrough' },
    { icon: '<code>&lt;&gt;</code>', tag: '`', label: 'Code' }
  ]

  actions.forEach(({ icon, tag, label }) => {
    const btn = document.createElement('button')
    btn.innerHTML = icon
    btn.setAttribute('data-tooltip', label)
    btn.type = 'button'
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault() // prevent losing selection
      applyFormatting(tag)
    })
    toolbar.appendChild(btn)
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

  let wrapClass = ''
  if (tag === '**') wrapClass = 'cm-atomic-strong-wrap'
  else if (tag === '_') wrapClass = 'cm-atomic-em-wrap'
  else if (tag === '~~') wrapClass = 'cm-atomic-strike-wrap'
  else if (tag === '`') wrapClass = 'cm-atomic-inline-code-wrap'

  // Check if selection is inside or contains an existing mark wrap of this type
  let wrap = null
  if (wrapClass) {
    let node = range.commonAncestorContainer
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
    wrap = node?.closest('.' + wrapClass)
    if (!wrap && range.cloneContents) {
      const fragment = range.cloneContents()
      if (fragment.querySelector && fragment.querySelector('.' + wrapClass)) {
        wrap = node?.querySelector('.' + wrapClass)
      }
    }
  }

  // If inside a rendered mark wrap, toggle off: replace the whole wrap with its clean inner content
  if (wrap && source.contains(wrap)) {
    // Extract inner content (excluding the mark delimiters or stripping tag if present)
    const innerEl = wrap.querySelector('.cm-atomic-inline-code, .cm-atomic-strong, .cm-atomic-em, .cm-atomic-strike')
    let innerContent = innerEl ? innerEl.textContent : wrap.textContent

    // Ensure leading and trailing tags are cleanly stripped
    while (innerContent.startsWith(tag)) {
      innerContent = innerContent.substring(tag.length)
    }
    while (innerContent.endsWith(tag)) {
      innerContent = innerContent.substring(0, innerContent.length - tag.length)
    }

    const newRange = document.createRange()
    newRange.selectNode(wrap)
    sel.removeAllRanges()
    sel.addRange(newRange)

    document.execCommand('insertText', false, innerContent)
    source.dispatchEvent(new Event('input', { bubbles: true }))
    return
  }

  const text = sel.toString()
  const trimmed = text.trim()

  // Case 1: Plain text selection containing the tag delimiters (e.g. "`word`" or "**word**")
  if (trimmed.startsWith(tag) && trimmed.endsWith(tag) && trimmed.length >= tag.length * 2) {
    const startIdx = text.indexOf(trimmed)
    const endIdx = startIdx + trimmed.length
    const leading = text.substring(0, startIdx)
    const trailing = text.substring(endIdx)
    
    let inner = trimmed
    if (inner.startsWith(tag)) inner = inner.substring(tag.length)
    if (inner.endsWith(tag)) inner = inner.substring(0, inner.length - tag.length)

    document.execCommand('insertText', false, leading + inner + trailing)
    source.dispatchEvent(new Event('input', { bubbles: true }))
    return
  }

  // Case 2: If the selection itself starts with tag or ends with tag (partially selected delimiters)
  if (trimmed.startsWith(tag) || trimmed.endsWith(tag)) {
    let clean = trimmed
    if (clean.startsWith(tag)) clean = clean.substring(tag.length)
    if (clean.endsWith(tag)) clean = clean.substring(0, clean.length - tag.length)
    document.execCommand('insertText', false, clean)
    source.dispatchEvent(new Event('input', { bubbles: true }))
    return
  }

  // Case 3: Normal wrap
  document.execCommand('insertText', false, `${tag}${text}${tag}`)
  source.dispatchEvent(new Event('input', { bubbles: true }))
}
