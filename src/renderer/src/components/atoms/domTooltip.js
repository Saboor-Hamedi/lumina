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

  const rect = targetEl.getBoundingClientRect()
  const gap = 8

  let isTop = position.startsWith('top')
  let isBottom = position.startsWith('bottom')
  let isLeft = position === 'left'
  let isRight = position === 'right'

  if (!isTop && !isBottom && !isLeft && !isRight) {
    isTop = true
  }

  // Screen boundary detection
  if (isTop && rect.top < 40) {
    isTop = false
    isBottom = true
  } else if (isBottom && rect.bottom > window.innerHeight - 40) {
    isTop = true
    isBottom = false
  }

  let topStyle = 'auto'
  let bottomStyle = 'auto'
  let leftStyle = 'auto'
  let rightStyle = 'auto'
  let transformStyle = 'none'
  let arrowPos = {}

  if (isTop) {
    bottomStyle = `${Math.round(window.innerHeight - rect.top + gap)}px`
    arrowPos.bottom = '-3px'
  } else if (isBottom) {
    topStyle = `${Math.round(rect.bottom + gap)}px`
    arrowPos.top = '-3px'
  }

  const elemCenterX = rect.left + rect.width / 2

  if (isLeft) {
    topStyle = `${Math.round(rect.top + rect.height / 2)}px`
    rightStyle = `${Math.round(window.innerWidth - rect.left + gap)}px`
    transformStyle = 'translateY(-50%)'
    arrowPos = { right: '-3px', top: '50%', marginTop: '-3px' }
  } else if (isRight) {
    topStyle = `${Math.round(rect.top + rect.height / 2)}px`
    leftStyle = `${Math.round(rect.right + gap)}px`
    transformStyle = 'translateY(-50%)'
    arrowPos = { left: '-3px', top: '50%', marginTop: '-3px' }
  } else {
    if (elemCenterX > window.innerWidth - 45) {
      rightStyle = '8px'
      transformStyle = 'none'
      const knobRight = Math.max(8, Math.min(24, Math.round(window.innerWidth - elemCenterX - 8)))
      arrowPos.right = `${knobRight}px`
    } else if (elemCenterX < 45) {
      leftStyle = '8px'
      transformStyle = 'none'
      const knobLeft = Math.max(8, Math.min(24, Math.round(elemCenterX - 8)))
      arrowPos.left = `${knobLeft}px`
    } else {
      leftStyle = `${Math.round(elemCenterX)}px`
      transformStyle = 'translateX(-50%)'
      arrowPos.left = '50%'
      arrowPos.marginLeft = '-3px'
    }
  }

  const tooltipEl = document.createElement('div')
  tooltipEl.className = `tooltip-portal ${isTop ? 'tooltip-pos-top' : isBottom ? 'tooltip-pos-bottom' : isLeft ? 'tooltip-pos-left' : 'tooltip-pos-right'}`
  tooltipEl.setAttribute('role', 'tooltip')
  tooltipEl.style.top = topStyle
  tooltipEl.style.bottom = bottomStyle
  tooltipEl.style.left = leftStyle
  tooltipEl.style.right = rightStyle
  tooltipEl.style.transform = transformStyle

  const arrow = document.createElement('div')
  arrow.className = 'tooltip-arrow'
  Object.assign(arrow.style, arrowPos)

  tooltipEl.innerHTML = formatTooltipContent(text)
  tooltipEl.appendChild(arrow)

  document.body.appendChild(tooltipEl)
  activeTooltipEl = tooltipEl
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
