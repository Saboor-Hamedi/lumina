/**
 * ============================================================================
 * Lumina Canvas Image Export & Clipboard Utility
 * ============================================================================
 * Generates high-resolution PNG and clean standalone SVG snapshots of canvas
 * diagrams (both full canvas and selected items):
 * - Seamless vector shape rendering with accurate strokes and fills
 * - Bézier connection wires with directional arrow markers
 * - Clean typography and card layout
 * - Direct copy to clipboard via native clipboard IPC & Web Clipboard API
 * - One-click PNG/SVG download
 * ============================================================================
 */

import { CanvasNode, CanvasEdge, CanvasStroke, CanvasNodeColor } from '../types'
import {
  CANVAS_NODE_COLOR_HEX,
  safeNumber
} from './canvasUtils'
import { calculateEdgePath } from './canvasRouting'
import { buildSmoothStrokePath } from './canvasStroke'

export interface ExportCanvasOptions {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  strokes?: CanvasStroke[]
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
          <path d="M 6 24 L 6 78 C 6 90, 94 90, 94 78 L 94 24" fill="${fill}" fill-opacity="${fillOpacity}" stroke="none" />
          <ellipse cx="50" cy="78" rx="44" ry="14" fill="${fill}" fill-opacity="${fillOpacity}" stroke="none" />
          <path d="M 6 78 C 6 90, 94 90, 94 78" fill="none" />
          <line x1="6" y1="24" x2="6" y2="78" />
          <line x1="94" y1="24" x2="94" y2="78" />
          <ellipse cx="50" cy="24" rx="44" ry="14" fill="${fill}" fill-opacity="${fillOpacity}" />
        </g>
      `
      break
    case 'cloud':
      shapeContent = `<path d="M 20 76 A 16 16 0 0 1 6 60 A 16 16 0 0 1 24 44 A 18 18 0 0 1 36 34 A 22 22 0 0 1 62 22 A 18 18 0 0 1 78 34 A 16 16 0 0 1 94 50 A 16 16 0 0 1 80 76 Z" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />`
      break
    case 'star':
      shapeContent = `<polygon points="50,4 61,35 94,36 68,56 77,87 50,69 23,87 32,56 6,36 39,35" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />`
      break
    case 'parallelogram':
      shapeContent = `<polygon points="22,5 96,5 78,95 4,95" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />`
      break
    case 'speech-bubble':
      shapeContent = `<path d="M 12 6 C 6 6, 4 10, 4 14 L 4 62 C 4 68, 8 72, 14 72 L 32 72 L 24 94 L 50 72 L 86 72 C 92 72, 96 68, 96 62 L 96 14 C 96 10, 92 6, 86 6 Z" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />`
      break
    case 'pill':
      shapeContent = `<rect x="4" y="12" width="92" height="76" rx="38" ry="38" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" />`
      break
    case 'document':
      shapeContent = `<path d="M 8 4 L 76 4 L 92 20 L 92 96 L 8 96 Z M 76 4 L 76 20 L 92 20" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />`
      break
    case 'step':
      shapeContent = `<polygon points="4,6 76,6 96,50 76,94 4,94 18,50" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />`
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
      shapeContent = `<g stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="50" cy="18" rx="${headRx}" ry="${headRy}" fill="${fill}" fill-opacity="${Math.max(0.12, parseFloat(fillOpacity))}" /><line x1="50" y1="${chinY}" x2="50" y2="65" /><line x1="15" y1="48" x2="50" y2="44" /><line x1="50" y1="44" x2="85" y2="48" /><ellipse cx="14" cy="48" rx="${handRx}" ry="${handRy}" fill="${stroke}" /><ellipse cx="86" cy="48" rx="${handRx}" ry="${handRy}" fill="${stroke}" /><line x1="50" y1="65" x2="28" y2="90" /><line x1="50" y1="65" x2="72" y2="90" /><line x1="28" y1="90" x2="16" y2="94" /><line x1="72" y1="90" x2="84" y2="94" /></g>`
      break
    }
    case 'envelope':
      shapeContent = `<g stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="14" width="92" height="72" rx="6" ry="6" fill="${fill}" fill-opacity="${fillOpacity}" /><path d="M 6 18 L 50 56 L 94 18" fill="none" /><path d="M 6 82 L 38 48" fill="none" opacity="0.35" /><path d="M 94 82 L 62 48" fill="none" opacity="0.35" /></g>`
      break
    case 'predefined-process':
      shapeContent = `<g stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"><rect x="4" y="8" width="92" height="84" rx="4" ry="4" fill="${fill}" fill-opacity="${fillOpacity}" /><line x1="16" y1="8" x2="16" y2="92" /><line x1="84" y1="8" x2="84" y2="92" /></g>`
      break
    case 'delay':
      shapeContent = `<path d="M 6 10 L 62 10 C 84 10, 95 28, 95 50 C 95 72, 84 90, 62 90 L 6 90 Z" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />`
      break
    case 'manual-input':
      shapeContent = `<polygon points="4,24 96,6 96,94 4,94" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />`
      break
    case 'queue':
      shapeContent = `<g stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"><path d="M 18 14 L 82 14 C 92 14, 96 30, 96 50 C 96 70, 92 86, 82 86 L 18 86 C 8 86, 4 70, 4 50 C 4 30, 8 14, 18 14 Z" fill="${fill}" fill-opacity="${fillOpacity}" /><path d="M 82 14 C 72 14, 68 30, 68 50 C 68 70, 72 86, 82 86" fill="none" /></g>`
      break
    case 'cube':
      shapeContent = `<g stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"><polygon points="18,10 92,10 78,24 4,24" fill="${fill}" fill-opacity="0.11" /><polygon points="78,24 92,10 92,76 78,92" fill="${fill}" fill-opacity="0.09" /><rect x="4" y="24" width="74" height="68" fill="${fill}" fill-opacity="${fillOpacity}" /></g>`
      break
    case 'server':
      shapeContent = `<g stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"><rect x="10" y="6" width="80" height="26" rx="4" fill="${fill}" fill-opacity="${fillOpacity}" /><rect x="10" y="37" width="80" height="26" rx="4" fill="${fill}" fill-opacity="${fillOpacity}" /><rect x="10" y="68" width="80" height="26" rx="4" fill="${fill}" fill-opacity="${fillOpacity}" /><circle cx="22" cy="19" r="2.2" fill="${stroke}" /><circle cx="22" cy="50" r="2.2" fill="${stroke}" /><circle cx="22" cy="81" r="2.2" fill="${stroke}" /></g>`
      break
    case 'browser':
      shapeContent = `<g stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"><rect x="4" y="6" width="92" height="88" rx="6" fill="${fill}" fill-opacity="${fillOpacity}" /><line x1="4" y1="22" x2="96" y2="22" /><circle cx="13" cy="14" r="2" fill="${stroke}" opacity="0.7" /><circle cx="21" cy="14" r="2" fill="${stroke}" opacity="0.5" /><circle cx="29" cy="14" r="2" fill="${stroke}" opacity="0.35" /></g>`
      break
    case 'terminal':
      shapeContent = `<g stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="92" height="88" rx="6" fill="${fill}" fill-opacity="${fillOpacity}" /><line x1="4" y1="20" x2="96" y2="20" opacity="0.5" /><path d="M 14 34 L 24 42 L 14 50" fill="none" opacity="0.65" /><line x1="29" y1="50" x2="42" y2="50" opacity="0.55" /></g>`
      break
    case 'note-fold':
      shapeContent = `<g stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"><path d="M 6 6 L 74 6 L 94 26 L 94 94 L 6 94 Z" fill="${fill}" fill-opacity="${fillOpacity}" /><path d="M 74 6 L 74 26 L 94 26 Z" fill="${fill}" fill-opacity="0.14" /></g>`
      break
    case 'arrow-right':
      shapeContent = `<polygon points="4,30 62,30 62,10 96,50 62,90 62,70 4,70" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />`
      break
    case 'arrow-left':
      shapeContent = `<polygon points="96,30 38,30 38,10 4,50 38,90 38,70 96,70" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />`
      break
    case 'frame':
      shapeContent = `<g stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"><rect x="3" y="3" width="94" height="94" rx="6" fill="${fill}" fill-opacity="0.03" stroke-dasharray="4 3" /><path d="M 3 20 L 42 20 L 50 12 L 50 3" fill="none" /></g>`
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


  // Check localStorage cached theme colors
  try {
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem('lumina_active_theme_colors')
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed && (parsed['--bg-app'] || parsed['--text-main'])) {
          const bgApp = parsed['--bg-app'] || '#0c0d10'
          const bgCard = parsed['--bg-card'] || parsed['--bg-panel'] || bgApp
          const textMain = parsed['--text-main'] || '#f8fafc'
          const textMuted = parsed['--text-muted'] || '#cbd5e1'
          const borderSubtle = parsed['--border-subtle'] || 'rgba(255, 255, 255, 0.12)'
          const borderDim = parsed['--border-dim'] || 'rgba(255, 255, 255, 0.08)'

          return {
            bgApp,
            bgCard,
            textMain,
            textMuted,
            borderSubtle,
            borderDim
          }
        }
      }
    }
  } catch {
    // ignore parse error
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
    strokes = [],
    selectedNodeIds,
    padding = 40,
    backgroundColor = themeColors.bgApp
  } = options

  // Filter nodes if exporting selection only
  const isSelection = selectedNodeIds && selectedNodeIds.length > 0
  const targetNodes = isSelection
    ? nodes.filter((n) => selectedNodeIds.includes(n.id))
    : nodes
  const targetStrokes = isSelection ? [] : strokes

  const targetNodeIdSet = new Set(targetNodes.map((n) => n.id))

  // Filter edges where both ends are in targetNodes
  const targetEdges = edges.filter(
    (e) => targetNodeIdSet.has(e.fromNode) && targetNodeIdSet.has(e.toNode)
  )

  const rawBbox = getCanvasBoundingBox(targetNodes, padding)
  let minX = targetNodes.length > 0 ? rawBbox.minX : Infinity
  let minY = targetNodes.length > 0 ? rawBbox.minY : Infinity
  let maxX = targetNodes.length > 0 ? rawBbox.maxX : -Infinity
  let maxY = targetNodes.length > 0 ? rawBbox.maxY : -Infinity

  for (const s of targetStrokes) {
    for (const pt of s.points) {
      if (pt.x - padding < minX) minX = pt.x - padding
      if (pt.y - padding < minY) minY = pt.y - padding
      if (pt.x + padding > maxX) maxX = pt.x + padding
      if (pt.y + padding > maxY) maxY = pt.y + padding
    }
  }

  const bbox =
    Number.isFinite(minX) && Number.isFinite(minY)
      ? {
          minX,
          minY,
          maxX,
          maxY,
          width: Math.max(maxX - minX, 100),
          height: Math.max(maxY - minY, 100)
        }
      : rawBbox
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

      const dashAttr =
        edge.strokeDash === 'dashed'
          ? 'stroke-dasharray="7 5"'
          : edge.strokeDash === 'dotted'
            ? 'stroke-dasharray="2 4"'
            : ''

      return `
      <g>
        <path
          d="${pathD}"
          fill="none"
          stroke="${strokeColor}"
          stroke-width="1.8"
          stroke-linecap="round"
          ${dashAttr}
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

  const strokesSvg = targetStrokes
    .map((stroke) => {
      const d = buildSmoothStrokePath(stroke.points)
      if (!d) return ''
      const colorHex =
        CANVAS_NODE_COLOR_HEX[stroke.color as CanvasNodeColor] || CANVAS_NODE_COLOR_HEX.default
      const opacity = stroke.opacity ?? (stroke.tool === 'highlighter' ? 0.34 : 0.95)
      return `<path d="${d}" fill="none" stroke="${colorHex}" stroke-width="${stroke.strokeWidth || 3}" stroke-opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round" />`
    })
    .join('\n')

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
  <!-- Freehand Strokes Layer -->
  <g class="strokes">
    ${strokesSvg}
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

    // 1. Try native clipboard IPC when available
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

export interface CanvasExportResult {
  saved: boolean
  cancelled?: boolean
  filePath?: string
}

function isTauriRuntime(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__)
  )
}

function dataUrlToByteArray(dataUrl: string): number[] {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
  const binary = atob(base64)
  const bytes = new Array<number>(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Opens native OS save dialog (in Tauri) or triggers browser download of the canvas diagram as a PNG file.
 */
export async function downloadCanvasPng(
  options: ExportCanvasOptions,
  fileName: string = 'canvas-diagram.png'
): Promise<CanvasExportResult> {
  const finalName = fileName.endsWith('.png') ? fileName : `${fileName}.png`
  const { svgString, width, height } = buildCanvasSvg(options)
  const scale = options.scale || 2
  const pngDataUrl = await svgToPngDataUrl(svgString, width, height, scale)

  if (isTauriRuntime()) {
    const { invoke } = await import('@tauri-apps/api/core')
    const filePath = await invoke<string | null>('export_pick_save_path', {
      title: 'Export Canvas as PNG Image',
      defaultName: finalName,
      filterName: 'PNG Image',
      extensions: ['png']
    })
    if (!filePath) {
      return { saved: false, cancelled: true }
    }
    const bytes = dataUrlToByteArray(pngDataUrl)
    await invoke('export_write_file', {
      filePath,
      content: null,
      bytes
    })
    return { saved: true, filePath }
  }

  const a = document.createElement('a')
  a.href = pngDataUrl
  a.download = finalName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  return { saved: true }
}

/**
 * Opens native OS save dialog (in Tauri) or triggers browser download of the canvas diagram as a vector SVG file.
 */
export async function downloadCanvasSvg(
  options: ExportCanvasOptions,
  fileName: string = 'canvas-diagram.svg'
): Promise<CanvasExportResult> {
  const finalName = fileName.endsWith('.svg') ? fileName : `${fileName}.svg`
  const { svgString } = buildCanvasSvg(options)

  if (isTauriRuntime()) {
    const { invoke } = await import('@tauri-apps/api/core')
    const filePath = await invoke<string | null>('export_pick_save_path', {
      title: 'Export Canvas as SVG Vector',
      defaultName: finalName,
      filterName: 'SVG Vector Image',
      extensions: ['svg']
    })
    if (!filePath) {
      return { saved: false, cancelled: true }
    }
    await invoke('export_write_file', {
      filePath,
      content: svgString,
      bytes: null
    })
    return { saved: true, filePath }
  }

  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = finalName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return { saved: true }
}
