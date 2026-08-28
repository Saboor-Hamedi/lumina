import { dispatchModel } from './tableWidgetExtension.js'
import { readModelFromDom } from './tableModel.js'

export function setupTableInsertion(wrap, view) {
  const plusIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`

  // Row Insert Marker
  const rowInsertHandle = document.createElement('div')
  rowInsertHandle.className = 'cm-table-insert-marker cm-table-insert-marker-row'
  rowInsertHandle.innerHTML = plusIcon
  rowInsertHandle.style.position = 'absolute'
  rowInsertHandle.style.display = 'flex'
  rowInsertHandle.style.alignItems = 'center'
  rowInsertHandle.style.justifyContent = 'center'
  
  rowInsertHandle.style.width = '24px' // hit area
  rowInsertHandle.style.height = '24px' // hit area
  rowInsertHandle.style.boxSizing = 'border-box'
  rowInsertHandle.style.border = '5px solid transparent'
  rowInsertHandle.style.backgroundClip = 'padding-box'
  rowInsertHandle.style.backgroundColor = 'var(--text-accent, #2196f3)'
  
  rowInsertHandle.style.borderRadius = '50%'
  rowInsertHandle.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'
  rowInsertHandle.style.backdropFilter = 'blur(4px)'
  rowInsertHandle.style.color = '#fff'
  rowInsertHandle.style.cursor = 'pointer'
  rowInsertHandle.style.opacity = '0'
  rowInsertHandle.style.pointerEvents = 'none'
  rowInsertHandle.style.zIndex = '999' // high z-index
  rowInsertHandle.style.transform = 'translate(-50%, -50%)'
  rowInsertHandle.style.transition = 'opacity 0.15s ease'

  // Col Insert Marker
  const colInsertHandle = document.createElement('div')
  colInsertHandle.className = 'cm-table-insert-marker cm-table-insert-marker-col'
  colInsertHandle.innerHTML = plusIcon
  colInsertHandle.style.position = 'absolute'
  colInsertHandle.style.display = 'flex'
  colInsertHandle.style.alignItems = 'center'
  colInsertHandle.style.justifyContent = 'center'
  
  colInsertHandle.style.width = '24px' // hit area
  colInsertHandle.style.height = '24px' // hit area
  colInsertHandle.style.boxSizing = 'border-box'
  colInsertHandle.style.border = '5px solid transparent'
  colInsertHandle.style.backgroundClip = 'padding-box'
  colInsertHandle.style.backgroundColor = 'var(--text-accent, #2196f3)'
  
  colInsertHandle.style.borderRadius = '50%'
  colInsertHandle.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'
  colInsertHandle.style.backdropFilter = 'blur(4px)'
  colInsertHandle.style.color = '#fff'
  colInsertHandle.style.cursor = 'pointer'
  colInsertHandle.style.opacity = '0'
  colInsertHandle.style.pointerEvents = 'none'
  colInsertHandle.style.zIndex = '999' // high z-index
  colInsertHandle.style.transform = 'translate(-50%, -50%)'
  colInsertHandle.style.transition = 'opacity 0.15s ease'

  wrap.appendChild(rowInsertHandle)
  wrap.appendChild(colInsertHandle)

  wrap.addEventListener('mousemove', (e) => {
    if (e.target.closest('.cm-table-insert-marker')) return

    const table = wrap.querySelector('table')
    if (!table) return

    const wrapRect = wrap.getBoundingClientRect()
    const tableRect = table.getBoundingClientRect()
    const THRESHOLD = 12

    const targetCell = e.target.closest('th, td')
    if (!targetCell) {
      rowInsertHandle.style.opacity = '0'
      rowInsertHandle.style.pointerEvents = 'none'
      colInsertHandle.style.opacity = '0'
      colInsertHandle.style.pointerEvents = 'none'
      return
    }

    const cellRect = targetCell.getBoundingClientRect()
    const tr = targetCell.parentElement
    const isHeader = targetCell.tagName === 'TH'
    const isFirstCell = Array.from(tr.children).indexOf(targetCell) === 0
    const rowIndex = Array.from(table.querySelectorAll('tr')).indexOf(tr)
    const colIndex = Array.from(tr.children).indexOf(targetCell)

    let foundColGap = false
    let foundRowGap = false

    // Column Insertion (ONLY allowed when hovering a header cell)
    if (isHeader) {
      const distLeft = Math.abs(e.clientX - cellRect.left)
      const distRight = Math.abs(e.clientX - cellRect.right)

      if (distLeft < THRESHOLD || distRight < THRESHOLD) {
        const isLeft = distLeft < distRight
        const insertIndex = isLeft ? colIndex : colIndex + 1

        let markerX = (isLeft ? cellRect.left : cellRect.right) - wrapRect.left + wrap.scrollLeft
        let markerY = cellRect.top + cellRect.height / 2 - wrapRect.top

        // Push slightly inward on absolute edges
        if (insertIndex === 0) markerX += 7
        if (insertIndex === tr.children.length) markerX -= 7

        colInsertHandle.style.left = `${markerX}px`
        colInsertHandle.style.top = `${markerY}px`
        colInsertHandle.style.opacity = '1'
        colInsertHandle.style.pointerEvents = 'auto'
        colInsertHandle.dataset.index = insertIndex.toString()
        foundColGap = true
      }
    }

    // Row Insertion (ONLY allowed when hovering the first cell in any row)
    if (isFirstCell) {
      const distTop = Math.abs(e.clientY - cellRect.top)
      const distBottom = Math.abs(e.clientY - cellRect.bottom)

      if (distTop < THRESHOLD || distBottom < THRESHOLD) {
        const isTop = distTop < distBottom
        const insertIndex = isTop ? rowIndex : rowIndex + 1

        let markerY = (isTop ? cellRect.top : cellRect.bottom) - wrapRect.top
        let markerX = tableRect.left - wrapRect.left + wrap.scrollLeft + 7 // Pinned left

        // Push slightly inward on absolute edges
        if (insertIndex === 0) markerY += 7
        if (insertIndex === table.querySelectorAll('tr').length) markerY -= 7

        rowInsertHandle.style.top = `${markerY}px`
        rowInsertHandle.style.left = `${markerX}px`
        rowInsertHandle.style.opacity = '1'
        rowInsertHandle.style.pointerEvents = 'auto'
        rowInsertHandle.dataset.index = insertIndex.toString()
        foundRowGap = true
      }
    }

    if (!foundRowGap) {
      rowInsertHandle.style.opacity = '0'
      rowInsertHandle.style.pointerEvents = 'none'
    }
    if (!foundColGap) {
      colInsertHandle.style.opacity = '0'
      colInsertHandle.style.pointerEvents = 'none'
    }
  })

  wrap.addEventListener('mouseleave', () => {
    rowInsertHandle.style.opacity = '0'
    colInsertHandle.style.opacity = '0'
    rowInsertHandle.style.pointerEvents = 'none'
    colInsertHandle.style.pointerEvents = 'none'
  })

  rowInsertHandle.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const index = parseInt(rowInsertHandle.dataset.index, 10)
    if (isNaN(index)) return

    const model = readModelFromDom(wrap)
    const nextModel = {
      header: [...model.header],
      alignments: [...(model.alignments || [])],
      rows: model.rows.map((r) => [...r])
    }

    const newRow = Array(nextModel.header.length).fill('')

    if (index === 0) {
      nextModel.rows.unshift([...nextModel.header])
      nextModel.header = newRow
    } else {
      nextModel.rows.splice(index - 1, 0, newRow)
    }

    dispatchModel(view, wrap, nextModel)
  })

  colInsertHandle.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const index = parseInt(colInsertHandle.dataset.index, 10)
    if (isNaN(index)) return

    const model = readModelFromDom(wrap)
    const nextModel = {
      header: [...model.header],
      alignments: [...(model.alignments || [])],
      rows: model.rows.map((r) => [...r])
    }

    nextModel.header.splice(index, 0, '')
    nextModel.alignments.splice(index, 0, 'left')
    nextModel.rows.forEach((r) => r.splice(index, 0, ''))

    dispatchModel(view, wrap, nextModel)
  })
}
