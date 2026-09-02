/**
 * ============================================================================
 * Vanilla DOM ToolTip Engine (`domTooltip.js`)
 * ============================================================================
 * Enables speech-bubble Lumina Tooltips for vanilla DOM elements
 * (e.g. CodeMirror widgets, table sort buttons, custom headers)
 * using `data-tooltip="Label (Shortcut)"` and optional `data-tooltip-pos="top|bottom|left|right"`.
 * ============================================================================
 */

let activeTooltipEl = null
let hoverTimeout = null

function formatTooltipContent(text) {
  if (!text || typeof text !== 'string') return text
  const match = text.match(/^(.*?)(?:\s*\(([^)]+)\))?$/)
  if (match && match[2]) {
    return `<span class="tooltip-content-wrap"><span class="tooltip-label">${match[1]}</span><kbd class="tooltip-kbd">${match[2]}</kbd></span>`
  }
  return `<span class="tooltip-label">${text}</span>`
}

export function showDomTooltip(targetEl, text, position = 'top') {
  hideDomTooltip()

  const tooltipEl = document.createElement('div')
  tooltipEl.className = `tooltip-portal tooltip-${position}`
  tooltipEl.setAttribute('role', 'tooltip')
  tooltipEl.innerHTML = `${formatTooltipContent(text)}<div class="tooltip-arrow"></div>`
  document.body.appendChild(tooltipEl)
  activeTooltipEl = tooltipEl

  const rect = targetEl.getBoundingClientRect()
  const gap = 8
  let top = 0
  let left = 'auto'
  let right = 'auto'

  if (position === 'top') {
    top = rect.top - gap
    left = `${rect.left + rect.width / 2}px`
  } else if (position === 'bottom') {
    top = rect.bottom + gap
    left = `${rect.left + rect.width / 2}px`
  } else if (position === 'bottom-right') {
    top = rect.bottom + gap
    right = `${window.innerWidth - rect.right}px`
  } else if (position === 'left') {
    top = rect.top + rect.height / 2
    left = `${rect.left - gap}px`
  } else if (position === 'right') {
    top = rect.top + rect.height / 2
    left = `${rect.right + gap}px`
  }

  tooltipEl.style.top = `${top}px`
  tooltipEl.style.left = left
  if (right !== 'auto') tooltipEl.style.right = right
}

export function hideDomTooltip() {
  if (activeTooltipEl) {
    activeTooltipEl.remove()
    activeTooltipEl = null
  }
}

/**
 * Initializes global event delegation for any element with `data-tooltip`.
 */
export function initDomTooltips() {
  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-tooltip]')
    if (!target) return

    const text = target.getAttribute('data-tooltip')
    if (!text) return
    const pos = target.getAttribute('data-tooltip-pos') || 'top'

    clearTimeout(hoverTimeout)
    hoverTimeout = setTimeout(() => {
      showDomTooltip(target, text, pos)
    }, 150)
  }, { capture: true })

  document.addEventListener('mouseout', (e) => {
    const target = e.target.closest('[data-tooltip]')
    if (target) {
      clearTimeout(hoverTimeout)
      hideDomTooltip()
    }
  }, { capture: true })

  document.addEventListener('mousedown', () => {
    clearTimeout(hoverTimeout)
    hideDomTooltip()
  }, { capture: true })

  window.addEventListener('blur', () => {
    clearTimeout(hoverTimeout)
    hideDomTooltip()
  })
}
