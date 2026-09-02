import './table.css'

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

  const text = sel.toString()
  const trimmed = text.trim()

  // Case 1: They highlighted the marks themselves (e.g. "**hello**")
  if (trimmed.startsWith(tag) && trimmed.endsWith(tag) && trimmed.length >= tag.length * 2) {
    const startIdx = text.indexOf(trimmed)
    const endIdx = startIdx + trimmed.length
    const leading = text.substring(0, startIdx)
    const trailing = text.substring(endIdx)
    const inner = trimmed.substring(tag.length, trimmed.length - tag.length)
    document.execCommand('insertText', false, leading + inner + trailing)
    return
  }

  // Case 2: They highlighted text inside an existing mark wrap
  let wrapClass = ''
  if (tag === '**') wrapClass = 'cm-atomic-strong-wrap'
  else if (tag === '_') wrapClass = 'cm-atomic-em-wrap'
  else if (tag === '~~') wrapClass = 'cm-atomic-strike-wrap'
  else if (tag === '`') wrapClass = 'cm-atomic-inline-code-wrap'

  if (wrapClass) {
    let node = range.commonAncestorContainer
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
    const wrap = node.closest('.' + wrapClass)

    if (wrap && source.contains(wrap)) {
      // Select the entire wrap so we replace the delimiters too
      const newRange = document.createRange()
      newRange.selectNode(wrap)
      sel.removeAllRanges()
      sel.addRange(newRange)

      const wrapText = wrap.textContent
      let innerText = wrapText
      if (innerText.startsWith(tag)) innerText = innerText.substring(tag.length)
      if (innerText.endsWith(tag)) innerText = innerText.substring(0, innerText.length - tag.length)
      document.execCommand('insertText', false, innerText)
      return
    }
  }

  // Case 3: Normal wrap
  document.execCommand('insertText', false, `${tag}${text}${tag}`)
}
