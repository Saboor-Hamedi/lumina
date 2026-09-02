/**
 * =========================================================================================
 * Mermaid Lightbox Module (`mermaidLightbox.js`)
 * =========================================================================================
 * 
 * Purpose:
 * Provides a dedicated, full-screen interactive lightbox modal for Mermaid diagrams.
 * 
 * Key Features:
 * 1. Pan & Zoom Engine:
 *    - Click & drag on the canvas to pan across large architecture/flowchart diagrams.
 *    - Mouse wheel / trackpad pinch to zoom smoothly between 20% and 600%.
 *    - Double-click anywhere on the canvas to reset zoom (100%) and re-center.
 * 2. Bottom Floating Control Panel:
 *    - Zoom Out (-), Live Zoom % indicator, Zoom In (+), Reset View (↺), and 1-Click Copy Image.
 * 3. Modal Geometry & Design:
 *    - Uses a crisp 2px border radius on the modal card, control panel pill, and action buttons.
 *    - Outer rounded card with `overflow: hidden` prevents scrollbars from bleeding over edges.
 *    - Clean event listener teardown on close (Escape key, backdrop click, close button).
 * =========================================================================================
 */

import { copyMermaidAsImage } from './copyMermaidAsImage'

/**
 * Creates the bottom-center floating control panel for zooming, resetting, and exporting.
 * 
 * @param {Object} handlers Control callbacks and state getters
 * @returns {{ element: HTMLElement, updateZoomText: (text: string) => void }}
 */
function createMermaidToolbar({ onZoomIn, onZoomOut, onReset, onCopy, getScaleText }) {
  const toolbar = document.createElement('div')
  toolbar.className = 'mermaid-lightbox-toolbar'

  // Zoom Out Button
  const zoomOutBtn = document.createElement('button')
  zoomOutBtn.className = 'mermaid-toolbar-btn'
  zoomOutBtn.title = 'Zoom Out'
  zoomOutBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`
  zoomOutBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    onZoomOut()
  })

  // Live Zoom Percentage Text Display
  const zoomLabel = document.createElement('span')
  zoomLabel.className = 'mermaid-toolbar-zoom-text'
  zoomLabel.textContent = getScaleText()

  // Zoom In Button
  const zoomInBtn = document.createElement('button')
  zoomInBtn.className = 'mermaid-toolbar-btn'
  zoomInBtn.title = 'Zoom In'
  zoomInBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`
  zoomInBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    onZoomIn()
  })

  // Reset View Button (Centers diagram and resets zoom to 100%)
  const resetBtn = document.createElement('button')
  resetBtn.className = 'mermaid-toolbar-btn'
  resetBtn.title = 'Reset View (100%)'
  resetBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>`
  resetBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    onReset()
  })

  // Copy Diagram Image Button
  const copyBtn = document.createElement('button')
  copyBtn.className = 'mermaid-toolbar-btn'
  copyBtn.title = 'Copy as Image'
  copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`
  copyBtn.addEventListener('click', async (e) => {
    e.stopPropagation()
    await onCopy(copyBtn)
  })

  toolbar.appendChild(zoomOutBtn)
  toolbar.appendChild(zoomLabel)
  toolbar.appendChild(zoomInBtn)
  toolbar.appendChild(resetBtn)
  toolbar.appendChild(copyBtn)

  return {
    element: toolbar,
    updateZoomText: (text) => {
      zoomLabel.textContent = text
    }
  }
}

/**
 * Opens an interactive, maximized lightbox modal for Mermaid diagrams.
 *
 * @param {SVGElement} svgEl The rendered Mermaid SVG element to display in the modal.
 */
export function openMermaidLightbox(svgEl) {
  if (!svgEl) return

  // Fullscreen Backdrop Overlay with blur
  const overlay = document.createElement('div')
  overlay.className = 'image-lightbox-overlay mermaid-lightbox-overlay'
  overlay.tabIndex = 0

  // Centered Modal Wrapper
  const wrapper = document.createElement('div')
  wrapper.className = 'image-lightbox-wrapper mermaid-lightbox-wrapper'

  // Modal Container Card (2px border-radius)
  const card = document.createElement('div')
  card.className = 'mermaid-lightbox-card'

  // Viewport Container (Handles pointer panning events)
  const viewport = document.createElement('div')
  viewport.className = 'mermaid-lightbox-viewport'

  // Canvas Container (Receives CSS transform scale + translate)
  const canvas = document.createElement('div')
  canvas.className = 'mermaid-lightbox-canvas'

  // Clone SVG and remove fixed dimension constraints for vector scaling
  const clone = svgEl.cloneNode(true)
  clone.removeAttribute('width')
  clone.removeAttribute('height')
  clone.style.width = '100%'
  clone.style.height = 'auto'
  clone.style.maxWidth = '100%'
  clone.style.display = 'block'
  canvas.appendChild(clone)
  viewport.appendChild(canvas)
  card.appendChild(viewport)

  // Pan & Zoom Coordinate State
  let scale = 1
  let panX = 0
  let panY = 0
  let isDragging = false
  let startX = 0
  let startY = 0

  let toolbarObj = null

  // Applies current pan and zoom coordinates to the canvas
  const updateTransform = () => {
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`
    if (toolbarObj) {
      toolbarObj.updateZoomText(`${Math.round(scale * 100)}%`)
    }
  }

  // --- Mouse Drag-to-Pan Handlers ---
  viewport.addEventListener('mousedown', (e) => {
    // Ignore clicks targeting toolbar buttons or the close button
    if (e.target.closest('.mermaid-lightbox-toolbar') || e.target.closest('.image-lightbox-close'))
      return
    isDragging = true
    startX = e.clientX - panX
    startY = e.clientY - panY
    viewport.classList.add('is-panning')
  })

  const onMouseMove = (e) => {
    if (!isDragging) return
    panX = e.clientX - startX
    panY = e.clientY - startY
    updateTransform()
  }

  const onMouseUp = () => {
    if (isDragging) {
      isDragging = false
      viewport.classList.remove('is-panning')
    }
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)

  // --- Mouse Wheel Zoom Handler ---
  viewport.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      const delta = e.deltaY < 0 ? 1.15 : 0.85
      scale = Math.min(Math.max(0.2, scale * delta), 6) // Clamp zoom between 20% and 600%
      updateTransform()
    },
    { passive: false }
  )

  // --- Double-Click Reset Handler ---
  viewport.addEventListener('dblclick', (e) => {
    if (e.target.closest('.mermaid-lightbox-toolbar')) return
    scale = 1
    panX = 0
    panY = 0
    updateTransform()
  })

  // --- Mount Floating Control Toolbar ---
  toolbarObj = createMermaidToolbar({
    getScaleText: () => `${Math.round(scale * 100)}%`,
    onZoomIn: () => {
      scale = Math.min(6, scale * 1.15)
      updateTransform()
    },
    onZoomOut: () => {
      scale = Math.max(0.2, scale * 0.85)
      updateTransform()
    },
    onReset: () => {
      scale = 1
      panX = 0
      panY = 0
      updateTransform()
    },
    onCopy: async (btn) => {
      try {
        await copyMermaidAsImage(clone)
        btn.style.color = '#4ade80'
        setTimeout(() => (btn.style.color = ''), 1500)
      } catch (err) {
        console.error('Failed to copy mermaid diagram', err)
      }
    }
  })
  card.appendChild(toolbarObj.element)

  // --- Top-Right Close Button (2px border radius) ---
  const closeBtn = document.createElement('div')
  closeBtn.className = 'image-lightbox-close'
  closeBtn.title = 'Close (Esc)'
  closeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`

  // Teardown and unmount cleanly
  const close = () => {
    overlay.classList.remove('show')
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
    window.removeEventListener('keydown', onKeyDown, true)
    window.removeEventListener('close-lightbox', close)
    setTimeout(() => overlay.remove(), 250)
  }

  overlay.addEventListener('click', close)
  card.addEventListener('click', (e) => e.stopPropagation())
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    close()
  })

  // Intercept Escape key globally while modal is active
  const onKeyDown = (k) => {
    if (k.key === 'Escape' || k.key === 'Esc' || k.keyCode === 27) {
      k.preventDefault()
      k.stopPropagation()
      close()
    }
  }
  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('close-lightbox', close)

  wrapper.appendChild(card)
  wrapper.appendChild(closeBtn)
  overlay.appendChild(wrapper)
  document.body.appendChild(overlay)

  overlay.focus()
  requestAnimationFrame(() => {
    overlay.classList.add('show')
  })
}
