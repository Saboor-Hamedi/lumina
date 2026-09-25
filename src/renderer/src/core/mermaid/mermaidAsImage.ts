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
  const width = viewBox && viewBox.width > 0 ? viewBox.width : rect.width || 800
  const height = viewBox && viewBox.height > 0 ? viewBox.height : rect.height || 600

  const clonedSvg = svg.cloneNode(true) as SVGSVGElement
  clonedSvg.setAttribute('width', String(width))
  clonedSvg.setAttribute('height', String(height))

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
    svg { background: transparent !important; background-color: transparent !important; }
    rect.background, rect[class*="background"], rect[id*="background"] { fill: transparent !important; }
    text, tspan, .label text { fill: ${accent} !important; }
  `
  clonedSvg.appendChild(overrideStyle)

  let svgString = new XMLSerializer().serializeToString(clonedSvg)
  if (!svgString.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
    svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"')
  }
  svgString = svgString.replace(/&nbsp;/g, '&#160;').replace(/<br>/g, '<br/>')

  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })

  const scale = 1.5
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
