import type { InlineNode } from './inlineTypes'
import { INLINE_COLORS } from './inlineShapes'

function getColorHex(color: string): string {
  const c = INLINE_COLORS.find((item) => item.id === color)
  return c ? c.hex : '#38bdf8'
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '&': return '&amp;'
      case '\'': return '&apos;'
      case '"': return '&quot;'
      default: return c
    }
  })
}

export function buildInlineSvg(nodes: InlineNode[], padding = 40): { svgString: string; width: number; height: number } {
  if (nodes.length === 0) {
    return {
      svgString: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="100%" height="100%" fill="#12131a"/></svg>',
      width: 600,
      height: 400
    }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  nodes.forEach((n) => {
    minX = Math.min(minX, n.x)
    minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x + n.width)
    maxY = Math.max(maxY, n.y + n.height)
  })

  const width = Math.max(200, maxX - minX + padding * 2)
  const height = Math.max(200, maxY - minY + padding * 2)
  const viewBoxX = minX - padding
  const viewBoxY = minY - padding

  const nodesMarkup = nodes
    .map((node) => {
      const colorHex = getColorHex(node.color)
      return `
    <g transform="translate(${node.x}, ${node.y})">
      <rect x="0" y="0" width="${node.width}" height="${node.height}" rx="8" fill="#181920" stroke="${colorHex}" stroke-width="1.5" />
      <text x="${node.width / 2}" y="${node.height / 2 + 5}" fill="#f8fafc" font-size="14" font-weight="500" font-family="system-ui, -apple-system, sans-serif" text-anchor="middle">${escapeXml(node.title || '')}</text>
    </g>`
    })
    .join('')

  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBoxX} ${viewBoxY} ${width} ${height}">
  <rect x="${viewBoxX}" y="${viewBoxY}" width="${width}" height="${height}" fill="#12131a" />
  ${nodesMarkup}
</svg>`

  return { svgString, width, height }
}

export async function copyInlineAsImage(nodes: InlineNode[]): Promise<boolean> {
  try {
    const { svgString, width, height } = buildInlineSvg(nodes)
    const scale = 2
    const canvas = document.createElement('canvas')
    canvas.width = width * scale
    canvas.height = height * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) return false
    ctx.scale(scale, scale)

    const img = new Image()
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    await new Promise((resolve, reject) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height)
        URL.revokeObjectURL(url)
        resolve(null)
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to rasterize SVG'))
      }
      img.src = url
    })

    const pngUrl = canvas.toDataURL('image/png')
    if ((window as any).api?.writeImageToClipboard) {
      await (window as any).api.writeImageToClipboard(pngUrl)
      return true
    }

    if (navigator.clipboard && (window as any).ClipboardItem) {
      const res = await fetch(pngUrl)
      const blob = await res.blob()
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ])
      return true
    }
    return false
  } catch (e) {
    console.error('[InlineDrawing] copy error:', e)
    return false
  }
}

export async function downloadInlinePng(nodes: InlineNode[], fileName = 'drawing.png'): Promise<void> {
  const { svgString, width, height } = buildInlineSvg(nodes)
  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(scale, scale)

  const img = new Image()
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  await new Promise((resolve) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })

  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export function downloadInlineSvg(nodes: InlineNode[], fileName = 'drawing.svg'): void {
  const { svgString } = buildInlineSvg(nodes)
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
