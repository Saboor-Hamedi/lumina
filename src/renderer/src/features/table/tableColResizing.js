export function setupTableColResizing(wrap, view) {
  const updateResizers = () => {
    const table = wrap.querySelector('table')
    if (!table) return
    const cells = Array.from(table.querySelectorAll('th, td'))

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]
      cell.style.position = 'relative'
      if (!cell.querySelector('.col-resizer')) {
        const resizer = document.createElement('div')
        resizer.className = 'col-resizer'
        cell.appendChild(resizer)

        resizer.addEventListener('mousedown', (e) => {
          if (view.state.readOnly) return
          e.preventDefault()
          e.stopPropagation()

          wrap.classList.add('resizing')

          // Find the TH for this column index
          const tr = cell.parentElement
          const colIndex = Array.from(tr.children).indexOf(cell)
          const th = table.querySelector(`th:nth-child(${colIndex + 1})`)
          if (!th) return

          const startX = e.clientX
          const startWidth = th.offsetWidth

          // Once user resizes, strictly enforce column widths
          table.style.tableLayout = 'fixed'
          table.style.setProperty('width', 'max-content', 'important')

          // Make sure all THs have explicit widths so the table doesn't collapse
          Array.from(table.querySelectorAll('th')).forEach((header) => {
            if (!header.style.width) {
              const w = header.offsetWidth
              header.style.width = w + 'px'
              header.style.minWidth = w + 'px'
              header.style.maxWidth = w + 'px'
            }
          })

          const onMouseMove = (moveEvent) => {
            const newWidth = Math.max(30, startWidth + (moveEvent.clientX - startX))
            th.style.width = newWidth + 'px'
            th.style.minWidth = newWidth + 'px'
            th.style.maxWidth = newWidth + 'px'
            if (view && view.requestMeasure) view.requestMeasure()
          }

          const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove)
            document.removeEventListener('mouseup', onMouseUp)
            wrap.classList.remove('resizing')
          }

          document.addEventListener('mousemove', onMouseMove)
          document.addEventListener('mouseup', onMouseUp)
        })
      }
    }
  }

  updateResizers()
  const observer = new MutationObserver((mutations) => {
    let shouldUpdate = false
    for (const m of mutations) {
      if (
        m.type === 'childList' &&
        Array.from(m.addedNodes).some(
          (n) => n.tagName === 'TH' || n.tagName === 'TD' || n.tagName === 'TR'
        )
      ) {
        shouldUpdate = true
        break
      }
    }
    if (shouldUpdate) updateResizers()
  })

  const table = wrap.querySelector('table')
  if (table) observer.observe(table, { childList: true, subtree: true })
}
