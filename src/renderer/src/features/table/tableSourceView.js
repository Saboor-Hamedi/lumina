import { serializeTableOnly, readModelFromDom, parseMarkdownTableText } from './tableModel.js'
import { findCurrentTableRange, dispatchModel } from './tableExtension.js'

/**
 * Creates the [ Table | Source ] segmented toggle button for the table header.
 * Seamlessly switches between the visual table and the pure Markdown table source.
 * 
 * @param {EditorView} view - CodeMirror EditorView instance
 * @param {HTMLElement} wrap - .cm-atomic-table wrapper DOM element
 * @param {object} model - Parsed table model
 * @returns {HTMLElement} The segmented toggle container DOM element
 */
export function createTableViewModeToggleDOM(view, wrap, model) {
  const container = document.createElement('div')
  container.className = 'cm-table-view-toggle'

  const tableBtn = document.createElement('button')
  tableBtn.type = 'button'
  tableBtn.className = 'palette-header-btn cm-table-view-btn active'
  tableBtn.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"></rect>
      <line x1="3" y1="9" x2="21" y2="9"></line>
      <line x1="3" y1="15" x2="21" y2="15"></line>
      <line x1="9" y1="3" x2="9" y2="21"></line>
      <line x1="15" y1="3" x2="15" y2="21"></line>
    </svg>
    <span>Table</span>
  `
  tableBtn.setAttribute('data-tooltip', 'Visual Table View')

  const sourceBtn = document.createElement('button')
  sourceBtn.type = 'button'
  sourceBtn.className = 'palette-header-btn cm-table-view-btn'
  sourceBtn.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="16 18 22 12 16 6"></polyline>
      <polyline points="8 6 2 12 8 18"></polyline>
    </svg>
    <span>Source</span>
  `
  sourceBtn.setAttribute('data-tooltip', 'Markdown Source View')

  container.appendChild(tableBtn)
  container.appendChild(sourceBtn)

  let sourceContainer = null
  let sourceTextarea = null

  const getOrCreateSourceContainer = () => {
    if (!sourceContainer) {
      sourceContainer = document.createElement('div')
      sourceContainer.className = 'cm-table-source-container'
      sourceContainer.style.display = 'none'

      sourceTextarea = document.createElement('textarea')
      sourceTextarea.className = 'cm-table-source-textarea'
      sourceTextarea.spellcheck = false
      sourceTextarea.placeholder = '| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |'

      const adjustHeight = () => {
        sourceTextarea.style.height = 'auto'
        sourceTextarea.style.height = `${sourceTextarea.scrollHeight}px`
      }

      sourceTextarea.addEventListener('input', () => {
        adjustHeight()
      })

      sourceTextarea.addEventListener('keydown', (e) => {
        e.stopPropagation()
      })

      sourceContainer.appendChild(sourceTextarea)
      wrap.appendChild(sourceContainer)
    }
    return { sourceContainer, sourceTextarea }
  }

  tableBtn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (tableBtn.classList.contains('active')) return

    tableBtn.classList.add('active')
    sourceBtn.classList.remove('active')

    // Commit any edits made in source mode back to the visual model & document
    if (sourceTextarea) {
      const rawText = sourceTextarea.value.trim()
      const titleInput = wrap.querySelector('.cm-table-ui-title-input')
      const currentCaption = titleInput ? titleInput.value.trim() : (wrap.dataset.caption || '')
      if (rawText) {
        const parsed = parseMarkdownTableText(rawText, currentCaption)
        if (parsed) {
          dispatchModel(view, wrap, parsed)
        }
      }
    }

    const scrollContainer = wrap.querySelector('.cm-table-scroll-container')
    if (scrollContainer) scrollContainer.style.display = ''

    if (sourceContainer) sourceContainer.style.display = 'none'
  })

  sourceBtn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (sourceBtn.classList.contains('active')) return

    sourceBtn.classList.add('active')
    tableBtn.classList.remove('active')

    const scrollContainer = wrap.querySelector('.cm-table-scroll-container')
    if (scrollContainer) scrollContainer.style.display = 'none'

    const { sourceContainer: sc, sourceTextarea: st } = getOrCreateSourceContainer()
    sc.style.display = 'block'

    const currentModel = readModelFromDom(wrap)
    st.value = serializeTableOnly(currentModel)
    st.style.height = 'auto'
    st.style.height = `${st.scrollHeight}px`
    st.focus()
  })

  return container
}
