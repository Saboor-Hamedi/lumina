/**
 * ============================================================================
 * Lumina Canvas Utilities
 * ============================================================================
 * Mathematical calculations, port geometry, dynamic edge routing, frontmatter
 * stripping, and defensive node normalization for high-performance canvas cards.
 * ============================================================================
 */

import { CanvasEdgeSide, CanvasNode, CanvasNodeColor, CanvasShapeType } from './types'

/**
 * Standard palette color cycle for sticky notes and canvas cards.
 */
export const COLOR_CYCLE: CanvasNodeColor[] = [
  'default',
  'yellow',
  'purple',
  'cyan',
  'green',
  'orange',
  'red'
]

/**
 * Direct hex color map for canvas node accents and edge markers.
 */
export const CANVAS_NODE_COLOR_HEX: Record<CanvasNodeColor, string> = {
  default: '#38bdf8',
  yellow: '#eab308',
  purple: '#a855f7',
  cyan: '#06b6d4',
  green: '#22c55e',
  orange: '#f97316',
  red: '#ef4444'
}

export interface SnappedPortTarget {
  nodeId: string
  side: CanvasEdgeSide
  x: number
  y: number
  color: CanvasNodeColor
  distance: number
}

/**
 * Safely converts any input value into a finite number, with fallback default.
 * Prevents NaN and null bugs from corrupting SVG paths or CSS coordinate styles.
 */
export function safeNumber(val: any, fallback: number): number {
  const num = Number(val)
  return Number.isFinite(num) ? num : fallback
}

/**
 * Cleanly strips YAML frontmatter metadata (e.g. `--- ... ---`) from note content
 * so frontmatter headers do not clutter the visual canvas preview.
 */
export function stripFrontmatter(content: string): string {
  if (!content) return ''
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim()
}

/**
 * Computes exact normalized percentage offset (0 to 1) for the 4 ports
 * based on the geometric contours of vector shapes, ensuring zero air gap.
 */
export function getShapePortRatio(
  shape: CanvasShapeType | undefined,
  side: CanvasEdgeSide
): { rx: number; ry: number } {
  if (!shape) {
    switch (side) {
      case 'top': return { rx: 0.5, ry: 0 }
      case 'bottom': return { rx: 0.5, ry: 1 }
      case 'left': return { rx: 0, ry: 0.5 }
      case 'right': default: return { rx: 1, ry: 0.5 }
    }
  }

  switch (shape) {
    case 'triangle':
      // Triangle SVG points="50,6 95,94 5,94"
      switch (side) {
        case 'top': return { rx: 0.5, ry: 0.06 }
        case 'bottom': return { rx: 0.5, ry: 0.94 }
        case 'left': return { rx: 0.27, ry: 0.5 }
        case 'right': return { rx: 0.73, ry: 0.5 }
      }
      break

    case 'diamond':
      // Diamond polygon points="50,4 96,50 50,96 4,50"
      switch (side) {
        case 'top': return { rx: 0.5, ry: 0.04 }
        case 'bottom': return { rx: 0.5, ry: 0.96 }
        case 'left': return { rx: 0.04, ry: 0.5 }
        case 'right': return { rx: 0.96, ry: 0.5 }
      }
      break

    case 'circle':
      // Circle ellipse cx=50 cy=50 rx=46 ry=46
      switch (side) {
        case 'top': return { rx: 0.5, ry: 0.04 }
        case 'bottom': return { rx: 0.5, ry: 0.96 }
        case 'left': return { rx: 0.04, ry: 0.5 }
        case 'right': return { rx: 0.96, ry: 0.5 }
      }
      break

    case 'hexagon':
      // Hexagon points="25,4 75,4 96,50 75,96 25,96 4,50"
      switch (side) {
        case 'top': return { rx: 0.5, ry: 0.04 }
        case 'bottom': return { rx: 0.5, ry: 0.96 }
        case 'left': return { rx: 0.04, ry: 0.5 }
        case 'right': return { rx: 0.96, ry: 0.5 }
      }
      break

    case 'cylinder':
      // Cylinder top cap ellipse cy=22 ry=14 (top is at 22-14=8%), bottom arc at 90%
      switch (side) {
        case 'top': return { rx: 0.5, ry: 0.08 }
        case 'bottom': return { rx: 0.5, ry: 0.90 }
        case 'left': return { rx: 0.06, ry: 0.5 }
        case 'right': return { rx: 0.94, ry: 0.5 }
      }
      break

    case 'heart':
      // Heart contour: tip at bottom 88%, cleft at top 16% (or top arc 4%), sides at 6% / 94%
      switch (side) {
        case 'top': return { rx: 0.5, ry: 0.16 }
        case 'bottom': return { rx: 0.5, ry: 0.88 }
        case 'left': return { rx: 0.06, ry: 0.45 }
        case 'right': return { rx: 0.94, ry: 0.45 }
      }
      break

    case 'shield':
      // Shield: top at 4%, bottom tip at 96%, sides at 8% and 92%
      switch (side) {
        case 'top': return { rx: 0.5, ry: 0.04 }
        case 'bottom': return { rx: 0.5, ry: 0.96 }
        case 'left': return { rx: 0.08, ry: 0.45 }
        case 'right': return { rx: 0.92, ry: 0.45 }
      }
      break

    case 'star':
      // Star: top tip at 4%, bottom indent at 75%, sides at 4% and 96%
      switch (side) {
        case 'top': return { rx: 0.5, ry: 0.04 }
        case 'bottom': return { rx: 0.5, ry: 0.75 }
        case 'left': return { rx: 0.12, ry: 0.5 }
        case 'right': return { rx: 0.88, ry: 0.5 }
      }
      break

    case 'cloud':
      switch (side) {
        case 'top': return { rx: 0.5, ry: 0.16 }
        case 'bottom': return { rx: 0.5, ry: 0.74 }
        case 'left': return { rx: 0.07, ry: 0.5 }
        case 'right': return { rx: 0.93, ry: 0.5 }
      }
      break

    case 'speech-bubble':
      // Bubble body ends at 77% height with pointer at bottom
      switch (side) {
        case 'top': return { rx: 0.5, ry: 0.06 }
        case 'bottom': return { rx: 0.5, ry: 0.77 }
        case 'left': return { rx: 0.04, ry: 0.42 }
        case 'right': return { rx: 0.96, ry: 0.42 }
      }
      break

    case 'pill':
      switch (side) {
        case 'top': return { rx: 0.5, ry: 0.12 }
        case 'bottom': return { rx: 0.5, ry: 0.88 }
        case 'left': return { rx: 0.04, ry: 0.5 }
        case 'right': return { rx: 0.96, ry: 0.5 }
      }
      break

    case 'parallelogram':
      // Parallelogram slanted: points="22,5 96,5 78,95 4,95"
      switch (side) {
        case 'top': return { rx: 0.59, ry: 0.05 }
        case 'bottom': return { rx: 0.41, ry: 0.95 }
        case 'left': return { rx: 0.13, ry: 0.5 }
        case 'right': return { rx: 0.87, ry: 0.5 }
      }
      break

    default:
      break
  }

  switch (side) {
    case 'top': return { rx: 0.5, ry: 0 }
    case 'bottom': return { rx: 0.5, ry: 1 }
    case 'left': return { rx: 0, ry: 0.5 }
    case 'right': default: return { rx: 1, ry: 0.5 }
  }
}

/**
 * Computes exact canvas-space coordinates for a specific connection port knob
 * ('top', 'bottom', 'left', 'right') on any given node, accounting for shape geometry.
 */
export function getNodePortCoord(
  node: { x: number; y: number; width?: number; height?: number; type?: string; shape?: CanvasShapeType },
  side: CanvasEdgeSide
): { x: number; y: number } {
  const x = safeNumber(node.x, 0)
  const y = safeNumber(node.y, 0)
  const w = Math.max(safeNumber(node.width, 140), 30)
  const h = Math.max(safeNumber(node.height, 100), 30)

  if (node.type === 'shape' && node.shape) {
    const ratio = getShapePortRatio(node.shape, side)
    return {
      x: x + w * ratio.rx,
      y: y + h * ratio.ry
    }
  }

  switch (side) {
    case 'top':
      return { x: x + w / 2, y }
    case 'bottom':
      return { x: x + w / 2, y: y + h }
    case 'left':
      return { x, y: y + h / 2 }
    case 'right':
    default:
      return { x: x + w, y: y + h / 2 }
  }
}

/**
 * Dynamically resolves the optimal facing ports between two nodes based on
 * their real-time relative positions in 2D space.
 *
 * Prevents connection lines from awkwardly twisting, looping backwards,
 * or cutting underneath cards when one node is dragged across another.
 */
export function getOptimalEdgePorts(
  fromNode: { x: number; y: number; width?: number; height?: number },
  toNode: { x: number; y: number; width?: number; height?: number }
): { fromSide: CanvasEdgeSide; toSide: CanvasEdgeSide } {
  const fw = Math.max(safeNumber(fromNode.width, 140), 30)
  const fh = Math.max(safeNumber(fromNode.height, 100), 30)
  const tw = Math.max(safeNumber(toNode.width, 140), 30)
  const th = Math.max(safeNumber(toNode.height, 100), 30)

  const fcx = safeNumber(fromNode.x, 0) + fw / 2
  const fcy = safeNumber(fromNode.y, 0) + fh / 2
  const tcx = safeNumber(toNode.x, 0) + tw / 2
  const tcy = safeNumber(toNode.y, 0) + th / 2

  const dx = tcx - fcx
  const dy = tcy - fcy

  // Compare angle relative to horizontal / vertical aspect ratios
  if (Math.abs(dx) * fh >= Math.abs(dy) * fw) {
    if (dx >= 0) {
      return { fromSide: 'right', toSide: 'left' }
    } else {
      return { fromSide: 'left', toSide: 'right' }
    }
  } else {
    if (dy >= 0) {
      return { fromSide: 'bottom', toSide: 'top' }
    } else {
      return { fromSide: 'top', toSide: 'bottom' }
    }
  }
}

/**
 * Computes a smooth directional cubic Bézier curve SVG path between two port coordinates.
 * Generates control points offset in the direction of the connected port side.
 * Also returns the midpoint (midX, midY) for anchoring hover delete controls.
 */
export function getBezierCurve(
  fromPt: { x: number; y: number },
  fromSide: CanvasEdgeSide,
  toPt: { x: number; y: number },
  toSide: CanvasEdgeSide = 'left'
): { pathD: string; midX: number; midY: number } {
  const rawDist = Math.hypot(toPt.x - fromPt.x, toPt.y - fromPt.y)
  const dist = Math.max(Math.min(rawDist * 0.4, 140), 20)
  let cp1x = fromPt.x
  let cp1y = fromPt.y
  let cp2x = toPt.x
  let cp2y = toPt.y

  if (fromSide === 'right') cp1x += dist
  else if (fromSide === 'left') cp1x -= dist
  else if (fromSide === 'top') cp1y -= dist
  else if (fromSide === 'bottom') cp1y += dist

  if (toSide === 'right') cp2x += dist
  else if (toSide === 'left') cp2x -= dist
  else if (toSide === 'top') cp2y -= dist
  else if (toSide === 'bottom') cp2y += dist

  const midX = (fromPt.x + toPt.x) / 2
  const midY = (fromPt.y + toPt.y) / 2
  const pathD = `M ${fromPt.x} ${fromPt.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${toPt.x} ${toPt.y}`

  return { pathD, midX, midY }
}

/**
 * Computes a smooth directional Bézier curve for freehand wire dragging.
 * Exits the starting port smoothly along fromSide, while arriving straight into
 * the mouse cursor (toPt) without awkward backwards curls, loops, or curved heads.
 */
export function getDragBezierCurve(
  fromPt: { x: number; y: number },
  fromSide: CanvasEdgeSide,
  toPt: { x: number; y: number }
): { pathD: string } {
  const rawDist = Math.hypot(toPt.x - fromPt.x, toPt.y - fromPt.y)
  const dist = Math.max(Math.min(rawDist * 0.35, 120), 20)
  let cp1x = fromPt.x
  let cp1y = fromPt.y

  if (fromSide === 'right') cp1x += dist
  else if (fromSide === 'left') cp1x -= dist
  else if (fromSide === 'top') cp1y -= dist
  else if (fromSide === 'bottom') cp1y += dist

  // cp2 lies along the line between cp1 and toPt, ensuring the curve arrives
  // completely straight at toPt so the arrowhead points cleanly in the direction of motion.
  const cp2x = toPt.x - (toPt.x - cp1x) * 0.25
  const cp2y = toPt.y - (toPt.y - cp1y) * 0.25

  const pathD = `M ${fromPt.x} ${fromPt.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${toPt.x} ${toPt.y}`
  return { pathD }
}

/**
 * Normalizes raw or imported node objects into a well-formed CanvasNode.
 * Enforces valid coordinates, minimum dimensions, and safe fallback values.
 */
export function normalizeNode(raw: Partial<CanvasNode> & { id?: string }): CanvasNode {
  const isShape = raw.type === 'shape'
  const minW = isShape ? 60 : 150
  const minH = isShape ? 40 : 80
  const defW = isShape ? 140 : 240
  const defH = isShape ? 100 : 150

  return {
    id: raw.id || `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: raw.type || 'text',
    shape: raw.shape,
    title: raw.title || '',
    text: raw.text || '',
    x: Math.round(safeNumber(raw.x, 0)),
    y: Math.round(safeNumber(raw.y, 0)),
    width: Math.max(Math.round(safeNumber(raw.width, defW)), minW),
    height: Math.max(Math.round(safeNumber(raw.height, defH)), minH),
    color: raw.color || 'default',
    url: raw.url,
    file: raw.file
  }
}

/**
 * Finds the closest connection port on any node (excluding excludeNodeId)
 * within a given radius threshold (canvas coordinate space).
 * Enables the magnetic "key in hole" pull effect and smooth auto-docking.
 */
export function findClosestPort(
  pos: { x: number; y: number },
  nodes: CanvasNode[],
  excludeNodeId: string,
  threshold: number = 42
): SnappedPortTarget | null {
  let closest: SnappedPortTarget | null = null
  let minDistance = threshold

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (node.id === excludeNodeId) continue

    const sides: CanvasEdgeSide[] = ['top', 'right', 'bottom', 'left']
    for (let j = 0; j < sides.length; j++) {
      const side = sides[j]
      const portPt = getNodePortCoord(node, side)
      const dist = Math.hypot(pos.x - portPt.x, pos.y - portPt.y)

      if (dist < minDistance) {
        minDistance = dist
        closest = {
          nodeId: node.id,
          side,
          x: portPt.x,
          y: portPt.y,
          color: node.color || 'default',
          distance: dist
        }
      }
    }
  }

  return closest
}

