/**
 * ============================================================================
 * Lumina Canvas Image Export & Clipboard Utility
 * ============================================================================
 * Generates high-resolution PNG and clean standalone SVG snapshots of canvas
 * diagrams (both full canvas and selected items):
 * - Seamless vector shape rendering with accurate strokes and fills
 * - Bézier connection wires with directional arrow markers
 * - Clean typography and card layout
 * - Direct copy to clipboard via Electron nativeImage IPC & Web Clipboard API
 * - One-click PNG/SVG download
 * ============================================================================
 */

import { CanvasNode, CanvasEdge, CanvasNodeColor } from '../types'
import {
  CANVAS_NODE_COLOR_HEX,
  safeNumber
} from './canvasUtils'
import { calculateEdgePath } from './canvasRouting'

export interface ExportCanvasOptions {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  selectedNodeIds?: string[]
  padding?: number
  scale?: number // 1 = 1x, 2 = high-dpi retina
  backgroundColor?: string | 'transparent'
  title?: string
}

/**
 * Maps shape types to their SVG markup with coordinates relative to the shape box.
 */
function getShapeSvgMarkup(
  shape: string,
  width: number,
  height: number,
  colorHex: string
): string {
  const stroke = colorHex
  const fill = colorHex
  const fillOpacity = '0.06'
  const strokeWidth = '1.3'

  let shapeContent = ''
  switch (shape) {
    case 'rounded-rectangle':
      shapeContent = `<rect x="4" y="4" width="92" height="92" rx="16" ry="16" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" />`
      break
    case 'circle':
      shapeContent = `<ellipse cx="50" cy="50" rx="46" ry="46" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" />`
      break
    case 'diamond':
      shapeContent = `<polygon points="50,4 96,50 50,96 4,50" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />`
      break
    case 'triangle':
      shapeContent = `<polygon points="50,6 95,94 5,94" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />`
      break
    case 'hexagon':
      shapeContent = `<polygon points="25,4 75,4 96,50 75,96 25,96 4,50" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />`
      break
    case 'cylinder':
      shapeContent = `
        <g stroke="${stroke}" stroke-width="${strokeWidth}">
          <path d="M 6 22 L 6 78 C 6 90, 94 90, 94 78 L 94 22 Z" fill="${fill}" fill-opacity="${fillOpacity}" />
          <ellipse cx="50" cy="22" rx="44" ry="14" fill="${fill}" fill-opacity="${fillOpacity}" />
          <path d="M 6 78 C 6 90, 94 90, 94 78" fill="none" />
        </g>
      `
      break
    case 'cloud':
      shapeContent = `<path d="M 24 74 C 12 74, 5 63, 9 49 C 5 36, 19 23, 33 29 C 41 15, 65 15, 73 29 C 87 24, 96 37, 92 51 C 97 61, 91 74, 77 74 Z" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />`
      break
    case 'star':
      shapeContent = `<polygon points="50,4 62,35 96,38 70,60 78,94 50,75 22,94 30,60 4,38 38,35" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />`
      break
    case 'parallelogram':
      shapeContent = `<polygon points="22,5 96,5 78,95 4,95" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />`
      break
    case 'speech-bubble':
      shapeContent = `<path d="M 12 6 C 6 6, 4 10, 4 17 L 4 66 C 4 73, 10 77, 18 77 L 22 77 L 16 94 L 38 77 L 84 77 C 92 77, 96 73, 96 66 L 96 17 C 96 10, 92 6, 84 6 Z" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />`
      break
    case 'pill':
      shapeContent = `<rect x="4" y="12" width="92" height="76" rx="38" ry="38" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" />`
      break
    case 'document':
      shapeContent = `<path d="M 6 6 L 94 6 L 94 80 C 72 72, 50 94, 6 82 Z" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />`
      break
    case 'step':
      shapeContent = `<polygon points="4,6 74,6 96,50 74,94 4,94 22,50" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />`
      break
    case 'shield':
      shapeContent = `<path d="M 50 4 L 92 18 L 92 56 C 92 78, 50 96, 50 96 C 50 96, 8 78, 8 56 L 8 18 Z" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />`
      break
    case 'heart':
      shapeContent = `<path d="M 50 90 C 25 72, 8 52, 8 33 C 8 16, 22 6, 37 6 C 45 6, 49 14, 50 25 C 51 14, 55 6, 63 6 C 78 6, 92 16, 92 33 C 92 52, 75 72, 50 90 Z" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />`
      break
    case 'octagon':
      shapeContent = `<polygon points="30,4 70,4 96,30 96,70 70,96 30,96 4,70 4,30" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />`
      break
    case 'trapezoid':
      shapeContent = `<polygon points="20,6 80,6 96,94 4,94" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />`
      break
    case 'cross':
      shapeContent = `<polygon points="35,4 65,4 65,35 96,35 96,65 65,65 65,96 35,96 35,65 4,65 4,35 35,35" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />`
      break
    case 'pentagon':
      shapeContent = `<polygon points="50,4 96,38 78,94 22,94 4,38" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />`
      break
    case 'actor': {
      const actorAspect = (width && height) ? (width / height) : 1
      const headRx = 13
      const headRy = headRx * Math.min(2.5, Math.max(0.4, actorAspect))
      const handRx = 2.5
      const handRy = handRx * Math.min(2.5, Math.max(0.4, actorAspect))
      const chinY = 18 + headRy
      shapeContent = `<g stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="50" cy="18" rx="${headRx}" ry="${headRy}" fill="${fill}" fill-opacity="${Math.max(0.12, parseFloat(fillOpacity))}" /><line x1="50" y1="${chinY}" x2="50" y2="65" /><line x1="15" y1="48" x2="50" y2="44" /><line x1="50" y1="44" x2="85" y2="48" /><ellipse cx="14" cy="48" rx="${handRx}" ry="${handRy}" fill="${stroke}" /><ellipse cx="86" cy="48" rx="${handRx}" ry="${handRy}" fill="${stroke}" /><line x1="50" y1="65" x2="26" y2="94" /><line x1="50" y1="65" x2="74" y2="94" /><line x1="26" y1="94" x2="19" y2="94" /><line x1="74" y1="94" x2="81" y2="94" /></g>`
      break
    }
    case 'envelope':
      shapeContent = `<g stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="14" width="92" height="72" rx="6" ry="6" fill="${fill}" fill-opacity="${fillOpacity}" /><path d="M 6 18 L 50 56 L 94 18" fill="none" /><path d="M 6 82 L 38 48" fill="none" opacity="0.6" /><path d="M 94 82 L 62 48" fill="none" opacity="0.6" /></g>`
      break
    case 'rectangle':
    default:
      shapeContent = `<rect x="4" y="4" width="92" height="92" rx="4" ry="4" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" />`
      break
  }

  const aspect = shape === 'circle' ? 'xMidYMid meet' : 'none'
  return `
    <svg x="0" y="0" width="${width}" height="${height}" viewBox="0 0 100 100" preserveAspectRatio="${aspect}">
      ${shapeContent}
    </svg>
  `
}

function escapeXml(str: string): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Calculates the bounding rectangle of target nodes.
 */
export function getCanvasBoundingBox(
  nodes: CanvasNode[],
  padding: number = 40
): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 400, maxY: 300, width: 400, height: 300 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const n of nodes) {
    const x = safeNumber(n.x, 0)
    const y = safeNumber(n.y, 0)
    const w = safeNumber(n.width, 140)
    const h = safeNumber(n.height, 100)

    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x + w > maxX) maxX = x + w
    if (y + h > maxY) maxY = y + h
  }

  minX -= padding
  minY -= padding
  maxX += padding
  maxY += padding

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(maxX - minX, 100),
    height: Math.max(maxY - minY, 100)
  }
}

export interface CanvasExportThemeColors {
  bgApp: string
  bgCard: string
  textMain: string
  textMuted: string
  borderSubtle: string
  borderDim: string
}

/**
 * Dynamically resolves active theme colors from document computed CSS variables
 * or persisted theme state. Ensures light themes (e.g. Rosé Pine Dawn) and dark
 * themes export with their native palettes.
 */
export function getExportThemeColors(): CanvasExportThemeColors {
  if (typeof document !== 'undefined' && document.documentElement) {
    const rootStyle = getComputedStyle(document.documentElement)
    const bgApp = rootStyle.getPropertyValue('--bg-app').trim()
    const bgCard =
      rootStyle.getPropertyValue('--bg-card').trim() ||
      rootStyle.getPropertyValue('--bg-panel').trim()
    const textMain = rootStyle.getPropertyValue('--text-main').trim()
    const textMuted = rootStyle.getPropertyValue('--text-muted').trim()
    const borderSubtle = rootStyle.getPropertyValue('--border-subtle').trim()
    const borderDim = rootStyle.getPropertyValue('--border-dim').trim()

    if (bgApp) {
      return {
        bgApp,
        bgCard: bgCard || bgApp,
        textMain: textMain || '#f8fafc',
        textMuted: textMuted || '#cbd5e1',
        borderSubtle: borderSubtle || 'rgba(255, 255, 255, 0.12)',
        borderDim: borderDim || 'rgba(255, 255, 255, 0.08)'
      }
    }
  }

  // Fallback to persisted theme colors if DOM is not ready
  try {
    if (typeof localStorage !== 'undefined') {
      const activeColors = localStorage.getItem('lumina_active_theme_colors')
      if (activeColors) {
        const parsed = JSON.parse(activeColors)
        if (parsed['--bg-app']) {
          return {
            bgApp: parsed['--bg-app'],
            bgCard: parsed['--bg-card'] || parsed['--bg-panel'] || parsed['--bg-app'],
            textMain: parsed['--text-main'] || '#f8fafc',
            textMuted: parsed['--text-muted'] || '#cbd5e1',
            borderSubtle: parsed['--border-subtle'] || 'rgba(255, 255, 255, 0.12)',
            borderDim: parsed['--border-dim'] || 'rgba(255, 255, 255, 0.08)'
          }
        }
      }
    }
  } catch (e) {
    // Ignore storage parse errors
  }

  // Fallback dark defaults
  return {
    bgApp: '#0c0d10',
    bgCard: '#18181b',
    textMain: '#f8fafc',
    textMuted: '#cbd5e1',
    borderSubtle: 'rgba(255, 255, 255, 0.12)',
    borderDim: 'rgba(255, 255, 255, 0.08)'
  }
}

/**
 * Builds a standalone, complete SVG XML string representing the canvas diagram.
 */
export function buildCanvasSvg(options: ExportCanvasOptions): { svgString: string; width: number; height: number } {
  const themeColors = getExportThemeColors()

  const {
    nodes,
    edges,
    selectedNodeIds,
    padding = 40,
    backgroundColor = themeColors.bgApp
  } = options

  // Filter nodes if exporting selection only
  const isSelection = selectedNodeIds && selectedNodeIds.length > 0
  const targetNodes = isSelection
    ? nodes.filter((n) => selectedNodeIds.includes(n.id))
    : nodes

  const targetNodeIdSet = new Set(targetNodes.map((n) => n.id))

  // Filter edges where both ends are in targetNodes
  const targetEdges = edges.filter(
    (e) => targetNodeIdSet.has(e.fromNode) && targetNodeIdSet.has(e.toNode)
  )

  const bbox = getCanvasBoundingBox(targetNodes, padding)
  const nodeMap = new Map<string, CanvasNode>()
  targetNodes.forEach((n) => nodeMap.set(n.id, n))

  // Markers definitions for arrows
  const arrowDefs = (Object.keys(CANVAS_NODE_COLOR_HEX) as CanvasNodeColor[])
    .map(
      (cKey) => `
      <marker id="export-arrow-${cKey}" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 2 L 7 5 L 0 8 z" fill="${CANVAS_NODE_COLOR_HEX[cKey]}" />
      </marker>
      <marker id="export-arrow-start-${cKey}" viewBox="0 0 10 10" refX="3" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M 7 2 L 0 5 L 7 8 z" fill="${CANVAS_NODE_COLOR_HEX[cKey]}" />
      </marker>
    `
    )
    .join('\n')

  // Generate edge paths
  const edgesSvg = targetEdges
    .map((edge) => {
      const fromNode = nodeMap.get(edge.fromNode)
      const toNode = nodeMap.get(edge.toNode)
      if (!fromNode || !toNode) return ''

      const { pathD, midX, midY } = calculateEdgePath(
        fromNode,
        edge.fromSide,
        toNode,
        edge.toSide,
        edge.lineStyle || 'curved'
      )

      const targetColor = (edge.color || toNode.color || 'default') as CanvasNodeColor
      const strokeColor = CANVAS_NODE_COLOR_HEX[targetColor] || CANVAS_NODE_COLOR_HEX.default

      const markerStartAttr = edge.fromEnd === 'arrow' ? `marker-start="url(#export-arrow-start-${targetColor})"` : ''
      const markerEndAttr = edge.toEnd === 'none' ? '' : `marker-end="url(#export-arrow-${targetColor})"`

      const labelSvg = edge.label
        ? `
        <g transform="translate(${midX}, ${midY})">
          <rect
            x="${-Math.max(24, edge.label.length * 4.2 + 10)}"
            y="-10"
            width="${Math.max(48, edge.label.length * 8.4 + 20)}"
            height="20"
            rx="10"
            fill="#18181b"
            stroke="${strokeColor}"
            stroke-width="1"
          />
          <text
            x="0"
            y="0"
            text-anchor="middle"
            dominant-baseline="central"
            alignment-baseline="central"
            fill="#f8fafc"
            font-size="10"
            font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            font-weight="500"
          >${escapeXml(edge.label)}</text>
        </g>
      `
        : ''

      return `
      <g>
        <path
          d="${pathD}"
          fill="none"
          stroke="${strokeColor}"
          stroke-width="1.8"
          stroke-linecap="round"
          ${markerStartAttr}
          ${markerEndAttr}
        />
        ${labelSvg}
      </g>
    `
    })
    .join('\n')

  // Generate nodes SVG
  const nodesSvg = targetNodes
    .map((node) => {
      const x = safeNumber(node.x, 0)
      const y = safeNumber(node.y, 0)
      const w = safeNumber(node.width, 140)
      const h = safeNumber(node.height, 100)
      const colorKey = (node.color || 'default') as CanvasNodeColor
      const colorHex = CANVAS_NODE_COLOR_HEX[colorKey] || CANVAS_NODE_COLOR_HEX.default

      if (node.type === 'shape') {
        const shapeType = node.shape || 'rectangle'
        const shapeMarkup = getShapeSvgMarkup(shapeType, w, h, colorHex)
        const cleanText = (node.text || '')
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\*(.*?)\*/g, '$1')
          .replace(/`(.*?)`/g, '$1')
        const text = escapeXml(cleanText)

        return `
        <g transform="translate(${x}, ${y})">
          ${shapeMarkup}
          ${
            text
              ? `
            <text
              x="${w / 2}"
              y="${h / 2}"
              text-anchor="middle"
              dominant-baseline="central"
              fill="${themeColors.textMain}"
              font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              font-size="12"
              font-weight="500"
            >${text}</text>
          `
              : ''
          }
        </g>
      `
      }

      // Default card / sticky note rendering
      const title = escapeXml(node.title || '')
      const text = escapeXml(node.text || '')

      return `
      <g transform="translate(${x}, ${y})">
        <!-- Card Background -->
        <rect
          x="0"
          y="0"
          width="${w}"
          height="${h}"
          rx="8"
          ry="8"
          fill="${themeColors.bgCard}"
          stroke="${themeColors.borderSubtle}"
          stroke-width="1"
        />
        <!-- Top accent line -->
        <path
          d="M 0 8 Q 0 0 8 0 L ${w - 8} 0 Q ${w} 0 ${w} 8 L ${w} 10 L 0 10 Z"
          fill="${colorHex}"
        />
        <!-- Header -->
        <text
          x="12"
          y="26"
          fill="${themeColors.textMain}"
          font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          font-size="11.5"
          font-weight="600"
        >${title || 'Note'}</text>
        <line x1="0" y1="36" x2="${w}" y2="36" stroke="${themeColors.borderDim}" stroke-width="1" />
        <!-- Content text -->
        <text
          x="12"
          y="56"
          fill="${themeColors.textMuted}"
          font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          font-size="11.5"
        >${text}</text>
      </g>
    `
    })
    .join('\n')

  const bgRect =
    backgroundColor && backgroundColor !== 'transparent'
      ? `<rect x="${bbox.minX}" y="${bbox.minY}" width="${bbox.width}" height="${bbox.height}" fill="${backgroundColor}" />`
      : ''

  const svgString = `
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="${bbox.minX} ${bbox.minY} ${bbox.width} ${bbox.height}"
  width="${bbox.width}"
  height="${bbox.height}"
>
  <defs>
    <marker id="export-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 2 L 7 5 L 0 8 z" fill="#38bdf8" />
    </marker>
    ${arrowDefs}
  </defs>
  ${bgRect}
  <!-- Edges Layer -->
  <g class="edges">
    ${edgesSvg}
  </g>
  <!-- Nodes Layer -->
  <g class="nodes">
    ${nodesSvg}
  </g>
</svg>
`.trim()

  return {
    svgString,
    width: bbox.width,
    height: bbox.height
  }
}

/**
 * Converts an SVG string to a raster PNG data URL using offscreen HTMLCanvasElement.
 */
export async function svgToPngDataUrl(
  svgString: string,
  width: number,
  height: number,
  scale: number = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = width * scale
    canvas.height = height * scale

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return reject(new Error('Failed to create canvas 2D context'))
    }

    ctx.scale(scale, scale)

    const img = new Image()
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      try {
        const pngUrl = canvas.toDataURL('image/png')
        resolve(pngUrl)
      } catch (err) {
        reject(err)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load SVG into image for rendering'))
    }

    img.src = url
  })
}

/**
 * Copies the canvas diagram (or selection) as an image to clipboard.
 */
export async function copyCanvasAsImage(options: ExportCanvasOptions): Promise<boolean> {
  try {
    const { svgString, width, height } = buildCanvasSvg(options)
    const scale = options.scale || 2
    const pngDataUrl = await svgToPngDataUrl(svgString, width, height, scale)

    // 1. Try Electron native clipboard IPC (most reliable in Electron desktop apps)
    if ((window as any).api?.writeImageToClipboard) {
      await (window as any).api.writeImageToClipboard(pngDataUrl)
      return true
    }

    // 2. Web Clipboard API fallback
    if (navigator.clipboard && (window as any).ClipboardItem) {
      const res = await fetch(pngDataUrl)
      const blob = await res.blob()
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob
        })
      ])
      return true
    }

    return false
  } catch (err) {
    console.error('[CanvasExport] Failed to copy image to clipboard:', err)
    return false
  }
}

/**
 * Triggers download of the canvas diagram as a PNG file.
 */
export async function downloadCanvasPng(
  options: ExportCanvasOptions,
  fileName: string = 'canvas-diagram.png'
): Promise<void> {
  const { svgString, width, height } = buildCanvasSvg(options)
  const scale = options.scale || 2
  const pngDataUrl = await svgToPngDataUrl(svgString, width, height, scale)

  const a = document.createElement('a')
  a.href = pngDataUrl
  a.download = fileName.endsWith('.png') ? fileName : `${fileName}.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/**
 * Triggers download of the canvas diagram as a vector SVG file.
 */
export function downloadCanvasSvg(
  options: ExportCanvasOptions,
  fileName: string = 'canvas-diagram.svg'
): void {
  const { svgString } = buildCanvasSvg(options)
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = fileName.endsWith('.svg') ? fileName : `${fileName}.svg`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
