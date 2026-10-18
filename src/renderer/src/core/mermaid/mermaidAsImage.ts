/**
 * mermaidAsImage.ts
 *
 * Renders an offscreen SVG Mermaid diagram to a raster PNG with a transparent background
 * and copies it to the system clipboard, preserving the colorful diagram shapes and nodes
 * while removing any app or theme background.
 */

export async function copyMermaidAsImage(svgElement: SVGSVGElement | HTMLElement | null): Promise<void> {
  if (!svgElement) throw new Error('SVG element not provided')

  const svg = svgElement as SVGSVGElement
  const viewBox = svg.viewBox?.baseVal
  const rect = svg.getBoundingClientRect()

  let vbX = viewBox && viewBox.width > 0 ? viewBox.x : 0
  let vbY = viewBox && viewBox.height > 0 ? viewBox.y : 0
  let vbWidth = viewBox && viewBox.width > 0 ? viewBox.width : 0
  let vbHeight = viewBox && viewBox.height > 0 ? viewBox.height : 0

  if (vbWidth <= 0 || vbHeight <= 0) {
    const rawVb = svg.getAttribute('viewBox')
    if (rawVb) {
      const parts = rawVb
        .trim()
        .split(/[\s,]+/)
        .map(Number)
      if (parts.length === 4 && parts.every((n) => Number.isFinite(n)) && parts[2] > 0 && parts[3] > 0) {
        ;[vbX, vbY, vbWidth, vbHeight] = parts
      }
    }
  }

  try {
    if (typeof svg.getBBox === 'function') {
      const bbox = svg.getBBox()
      if (bbox && Number.isFinite(bbox.width) && Number.isFinite(bbox.height) && bbox.width > 0 && bbox.height > 0) {
        if (vbWidth <= 0 || vbHeight <= 0) {
          const pad = 8
          vbX = bbox.x - pad
          vbY = bbox.y - pad
          vbWidth = bbox.width + pad * 2
          vbHeight = bbox.height + pad * 2
        } else {
          const minX = Math.min(vbX, bbox.x)
          const minY = Math.min(vbY, bbox.y)
          const maxX = Math.max(vbX + vbWidth, bbox.x + bbox.width)
          const maxY = Math.max(vbY + vbHeight, bbox.y + bbox.height)
          vbX = minX
          vbY = minY
          vbWidth = maxX - minX
          vbHeight = maxY - minY
        }
      }
    }
  } catch {
    // getBBox may fail if element is detached or in test environments
  }

  const attrWidth = parseFloat(svg.getAttribute('width') || '') || 0
  const attrHeight = parseFloat(svg.getAttribute('height') || '') || 0

  const intrinsicWidth = vbWidth > 0 ? vbWidth : attrWidth > 0 ? attrWidth : rect.width || 800
  const intrinsicHeight = vbHeight > 0 ? vbHeight : attrHeight > 0 ? attrHeight : rect.height || 600
  const aspect = intrinsicWidth > 0 && intrinsicHeight > 0 ? intrinsicWidth / intrinsicHeight : 4 / 3

  // Preserve the full real height (never shrink to a scaled-down editor container height,
  // and if rendered larger on screen, keep the larger height with exact aspect ratio)
  const height = Math.max(intrinsicHeight, rect.height || 0) || 600
  const width = Math.round(height * aspect) || Math.max(intrinsicWidth, rect.width || 0) || 800

  const clonedSvg = svg.cloneNode(true) as SVGSVGElement
  if (vbWidth > 0 && vbHeight > 0) {
    clonedSvg.setAttribute('viewBox', `${vbX} ${vbY} ${vbWidth} ${vbHeight}`)
  } else if (!clonedSvg.getAttribute('viewBox')) {
    clonedSvg.setAttribute('viewBox', `0 0 ${intrinsicWidth} ${intrinsicHeight}`)
  }
  clonedSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  clonedSvg.setAttribute('width', String(width))
  clonedSvg.setAttribute('height', String(height))

  // Override any inline fitted width/height styles set by applyMermaidFit or fitCloneToViewport
  clonedSvg.style.setProperty('width', `${width}px`, 'important')
  clonedSvg.style.setProperty('height', `${height}px`, 'important')
  clonedSvg.style.setProperty('max-width', 'none', 'important')
  clonedSvg.style.setProperty('max-height', 'none', 'important')

  // Embed any externally-referenced style block
  const svgId = svg.id || svg.getAttribute('id')
  if (svgId) {
    const headStyle =
      document.getElementById(svgId) ||
      document.getElementById(`style-${svgId}`) ||
      document.querySelector(`style[id*="${svgId}"]`)
    if (headStyle && !clonedSvg.querySelector('style')) {
      clonedSvg.prepend(headStyle.cloneNode(true))
    }
  }

  // Keep only the first style block (Mermaid sometimes injects duplicates)
  const styles = clonedSvg.querySelectorAll('style')
  for (let i = 1; i < styles.length; i++) styles[i].remove()

  clonedSvg.style.setProperty('background', 'transparent', 'important')
  clonedSvg.style.setProperty('background-color', 'transparent', 'important')

  const computed = getComputedStyle(document.documentElement)
  const accent =
    computed.getPropertyValue('--text-accent').trim() ||
    computed.getPropertyValue('--accent-primary').trim() ||
    computed.getPropertyValue('--accent').trim() ||
    '#40bafa'

  const overrideStyle = document.createElement('style')
  overrideStyle.textContent = `
    :root, svg {
      --text-accent: ${accent} !important;
      background: transparent !important;
      background-color: transparent !important;
      width: ${width}px !important;
      height: ${height}px !important;
      max-width: none !important;
      max-height: none !important;
    }
    rect.background, rect[class*="background"], rect[id*="background"] {
      fill: transparent !important;
    }
    text, tspan, .label, .label text, .label span, .label p, .label div,
    .nodeLabel, .nodeLabel span, .nodeLabel p,
    .edgeLabel, .edgeLabel span, .edgeLabel p, .edgeTerminals text,
    foreignObject, foreignObject div, foreignObject span, foreignObject p,
    text.actor, .actor, .messageText, .noteText, .loopText, .taskText,
    .classTitle, .classText, .state-title, .statediagram-state text,
    .commit-label, .branch-label,
    .mindmap-node text, .mindmap-node tspan, .mindmap-node span {
      fill: ${accent} !important;
      color: ${accent} !important;
    }
  `
  clonedSvg.appendChild(overrideStyle)

  let svgString = new XMLSerializer().serializeToString(clonedSvg)
  if (!svgString.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
    svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000\/svg"')
  }
  svgString = svgString.replace(/&nbsp;/g, '&#160;').replace(/<br>/g, '<br/>')

  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })

  const scale = 2
  const canvasWidth = Math.round(width * scale)
  const canvasHeight = Math.round(height * scale)

  // Try the fast path: createImageBitmap + OffscreenCanvas (Chromium/Electron native)
  if (typeof createImageBitmap !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
    try {
      const bitmap = await createImageBitmap(svgBlob, {
        resizeWidth: canvasWidth,
        resizeHeight: canvasHeight,
        resizeQuality: 'high'
      })
      const offscreen = new OffscreenCanvas(canvasWidth, canvasHeight)
      const ctx = offscreen.getContext('2d')!
      ctx.clearRect(0, 0, canvasWidth, canvasHeight)
      ctx.drawImage(bitmap, 0, 0)
      bitmap.close()
      const pngBlob = await offscreen.convertToBlob({ type: 'image/png' })
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })])
      return
    } catch {
      // fall through to canvas fallback
    }
  }

  // Fallback: Image + canvas
  const blobUrl = URL.createObjectURL(svgBlob)
  try {
    const img = new Image()
    await new Promise<void>((res, rej) => {
      img.onload = () => res()
      img.onerror = () => rej(new Error('Failed to load SVG blob'))
      img.src = blobUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = canvasWidth
    canvas.height = canvasHeight
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)
    ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight)
    const pngBlob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
    if (!pngBlob) throw new Error('Canvas export failed')
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })])
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}

export default copyMermaidAsImage
