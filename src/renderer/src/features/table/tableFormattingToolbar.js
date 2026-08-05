import './tableFormattingToolbar.css'

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
    btn.title = label
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
    const source = range.startContainer.parentElement?.closest('.cm-atomic-table-cell-source') || 
                   (range.startContainer.nodeType === Node.ELEMENT_NODE && range.startContainer.closest('.cm-atomic-table-cell-source'))
    
    if (!source || !document.activeElement || !source.contains(document.activeElement)) {
      toolbar.style.display = 'none'
      return
    }

    // Don't show toolbar if we are just selecting across multiple nodes in a complex way for now, 
    // or if we're in the middle of a mark
    const rect = range.getBoundingClientRect()
    
    toolbar.style.display = 'flex'
    toolbar.style.top = `${rect.top - toolbar.offsetHeight - 8}px`
    toolbar.style.left = `${rect.left + (rect.width / 2) - (toolbar.offsetWidth / 2)}px`
  })
}

function applyFormatting(tag) {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) return
  
  const range = sel.getRangeAt(0)
  const source = range.startContainer.parentElement?.closest('.cm-atomic-table-cell-source')
  if (!source) return

  // We have a selection inside the cell.
  // We need to wrap it with the tag.
  // However, `execCommand` is deprecated and manipulating DOM ranges directly in contentEditable is tricky.
  // The easiest way for our plain-text-backed contentEditable is to:
  // 1. Get the current textContent of the selection.
  // 2. document.execCommand('insertText', false, `${tag}${selectedText}${tag}`)
  // This will insert it into the DOM, and our `input` listener on the cell will pick it up and re-render.
  
  const text = sel.toString()
  document.execCommand('insertText', false, `${tag}${text}${tag}`)
}
