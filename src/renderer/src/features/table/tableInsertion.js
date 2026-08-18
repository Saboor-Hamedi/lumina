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
  rowInsertHandle.style.width = '14px'
  rowInsertHandle.style.height = '14px'
  rowInsertHandle.style.borderRadius = '50%'
  rowInsertHandle.style.background = 'var(--text-accent, #2196f3)'
  rowInsertHandle.style.color = '#fff'
  rowInsertHandle.style.cursor = 'pointer'
  rowInsertHandle.style.opacity = '0'
  rowInsertHandle.style.pointerEvents = 'none'
  rowInsertHandle.style.zIndex = '100'
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
  colInsertHandle.style.width = '14px'
  colInsertHandle.style.height = '14px'
  colInsertHandle.style.borderRadius = '50%'
  colInsertHandle.style.background = 'var(--text-accent, #2196f3)'
  colInsertHandle.style.color = '#fff'
  colInsertHandle.style.cursor = 'pointer'
  colInsertHandle.style.opacity = '0'
  colInsertHandle.style.pointerEvents = 'none'
  colInsertHandle.style.zIndex = '100'
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

    let foundRowGap = false
    let foundColGap = false

    // Check Row Gaps
    const rows = Array.from(table.querySelectorAll('tr'))
    for (let i = 0; i <= rows.length; i++) {
      let boundaryY = 0
      let isTopEdge = i === 0
      let isBottomEdge = i === rows.length
      
      if (isTopEdge) {
        boundaryY = rows[0].getBoundingClientRect().top
      } else if (isBottomEdge) {
        boundaryY = rows[rows.length - 1].getBoundingClientRect().bottom
      } else {
        const topRect = rows[i - 1].getBoundingClientRect()
        const botRect = rows[i].getBoundingClientRect()
        boundaryY = (topRect.bottom + botRect.top) / 2
      }

      if (Math.abs(e.clientY - boundaryY) < THRESHOLD) {
        let markerY = boundaryY - wrapRect.top
        // Clamp to prevent marker from spilling outside the top/bottom table boundaries
        if (isTopEdge) markerY += 7
        if (isBottomEdge) markerY -= 7
        
        rowInsertHandle.style.top = `${markerY}px`
        let markerX = e.clientX - wrapRect.left
        // Clamp to table left/right
        markerX = Math.max(markerX, tableRect.left - wrapRect.left + 7)
        markerX = Math.min(markerX, tableRect.right - wrapRect.left - 7)
        rowInsertHandle.style.left = `${markerX}px`
        rowInsertHandle.style.opacity = '1'
        rowInsertHandle.style.pointerEvents = 'auto'
        rowInsertHandle.dataset.index = i.toString()
        foundRowGap = true
        break
      }
    }

    // Check Col Gaps
    const firstRow = rows[0]
    if (firstRow) {
      const cells = Array.from(firstRow.children)
      for (let i = 0; i <= cells.length; i++) {
        let boundaryX = 0
        let isLeftEdge = i === 0
        let isRightEdge = i === cells.length
        
        if (isLeftEdge) {
          boundaryX = cells[0].getBoundingClientRect().left
        } else if (isRightEdge) {
          boundaryX = cells[cells.length - 1].getBoundingClientRect().right
        } else {
          const leftRect = cells[i - 1].getBoundingClientRect()
          const rightRect = cells[i].getBoundingClientRect()
          boundaryX = (leftRect.right + rightRect.left) / 2
        }

        if (Math.abs(e.clientX - boundaryX) < THRESHOLD) {
          let markerX = boundaryX - wrapRect.left
          // Clamp to prevent marker from spilling outside the left/right table boundaries
          if (isLeftEdge) markerX += 7
          if (isRightEdge) markerX -= 7
          
          colInsertHandle.style.left = `${markerX}px`
          let markerY = e.clientY - wrapRect.top
          // Clamp to table top/bottom
          markerY = Math.max(markerY, tableRect.top - wrapRect.top + 7)
          markerY = Math.min(markerY, tableRect.bottom - wrapRect.top - 7)
          colInsertHandle.style.top = `${markerY}px`
          colInsertHandle.style.opacity = '1'
          colInsertHandle.style.pointerEvents = 'auto'
          colInsertHandle.dataset.index = i.toString()
          foundColGap = true
          break
        }
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
      rows: model.rows.map(r => [...r])
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
      rows: model.rows.map(r => [...r])
    }

    nextModel.header.splice(index, 0, '')
    nextModel.alignments.splice(index, 0, 'left')
    nextModel.rows.forEach(r => r.splice(index, 0, ''))

    dispatchModel(view, wrap, nextModel)
  })
}
