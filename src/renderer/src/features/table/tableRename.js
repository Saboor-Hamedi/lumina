import { serializeTable, readModelFromDom } from './tableModel.js'
import { findCurrentTableRange } from './tableWidgetExtension.js'

/**
 * Creates the Table Title display and interactive Rename Dropdown popover.
 * 
 * @param {EditorView} view - CodeMirror EditorView instance
 * @param {HTMLElement} wrap - .cm-atomic-table wrapper DOM node
 * @param {object} model - The parsed table model
 * @returns {HTMLElement} The title trigger container DOM node
 */
export function createTableTitleDOM(view, wrap, model) {
  const container = document.createElement('div')
  container.className = 'cm-table-title-container'

  const titleBtn = document.createElement('button')
  titleBtn.type = 'button'
  titleBtn.className = 'cm-table-title-btn'
  titleBtn.title = 'Click to rename table'

  const currentTitle = model.caption ? model.caption.trim() : ''

  // Icon (Pencil)
  const iconSpan = document.createElement('span')
  iconSpan.className = 'cm-table-title-icon'
  iconSpan.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
    </svg>
  `

  // Label
  const labelSpan = document.createElement('span')
  labelSpan.className = 'cm-table-title-label'
  labelSpan.textContent = currentTitle || 'Table'

  titleBtn.appendChild(iconSpan)
  titleBtn.appendChild(labelSpan)
  container.appendChild(titleBtn)

  let dropdown = null

  const closeDropdown = () => {
    if (dropdown) {
      dropdown.remove()
      dropdown = null
      document.removeEventListener('mousedown', onOutsideClick, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }

  const onOutsideClick = (e) => {
    if (dropdown && !dropdown.contains(e.target) && !titleBtn.contains(e.target)) {
      closeDropdown()
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      closeDropdown()
    }
  }

  const openDropdown = () => {
    if (view.state.readOnly) return
    if (dropdown) {
      closeDropdown()
      return
    }

    // Close any other open table rename dropdowns in document
    document.querySelectorAll('.cm-table-rename-dropdown').forEach((el) => el.remove())

    dropdown = document.createElement('div')
    dropdown.className = 'native-dropdown-menu cm-table-rename-dropdown'
    dropdown.style.position = 'fixed'
    dropdown.style.zIndex = '99999'

    const rect = titleBtn.getBoundingClientRect()
    dropdown.style.top = `${rect.bottom + 4}px`
    dropdown.style.left = `${Math.max(10, Math.min(rect.left, window.innerWidth - 260))}px`

    const titleHeader = document.createElement('div')
    titleHeader.className = 'cm-table-rename-header'
    titleHeader.textContent = 'Rename Table'

    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'cm-table-rename-input'
    input.placeholder = 'Table name...'
    input.value = model.caption || ''

    const btnGroup = document.createElement('div')
    btnGroup.className = 'cm-table-rename-actions'

    const cancelBtn = document.createElement('button')
    cancelBtn.type = 'button'
    cancelBtn.className = 'cm-table-rename-cancel-btn'
    cancelBtn.textContent = 'Cancel'

    const saveBtn = document.createElement('button')
    saveBtn.type = 'button'
    saveBtn.className = 'cm-table-rename-save-btn'
    saveBtn.textContent = 'Save'

    const handleSave = () => {
      const newTitle = input.value.trim()
      labelSpan.textContent = newTitle || 'Table'
      wrap.dataset.caption = newTitle
      model.caption = newTitle

      const range = findCurrentTableRange(view, wrap)
      if (range) {
        const nextText = serializeTable({ ...model, caption: newTitle })
        view.dispatch({ changes: { from: range.from, to: range.to, insert: nextText } })
      }
      closeDropdown()
    }

    input.addEventListener('keydown', (e) => {
      e.stopPropagation()
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSave()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        closeDropdown()
      }
    })

    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      handleSave()
    })

    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      closeDropdown()
    })

    btnGroup.appendChild(cancelBtn)
    btnGroup.appendChild(saveBtn)

    dropdown.appendChild(titleHeader)
    dropdown.appendChild(input)
    dropdown.appendChild(btnGroup)
    document.body.appendChild(dropdown)

    setTimeout(() => {
      input.focus({ preventScroll: true })
      input.select()
    }, 10)

    document.addEventListener('mousedown', onOutsideClick, true)
    document.addEventListener('keydown', onKeyDown, true)
  }

  titleBtn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    openDropdown()
  })

  return container
}
