/**
 * ============================================================================
 * Lumina Canvas Port Anchor & Normal Vector Engine (`canvasPorts.ts`)
 * ============================================================================
 * Computes fixed connection anchor ports with outward normal direction vectors:
 * - 8-port topology: N, NE, E, SE, S, SW, W, NW
 * - Precise shape geometry contours for all 22 vector diagram shapes
 * - Unit normal vectors (nx, ny) guaranteeing perpendicular wire departure & entry
 * - Optimal port-pair selection balancing Euclidean distance and facing angles
 * ============================================================================
 */

import { CanvasEdgeSide, CanvasShapeType } from '../types'
import { safeNumber, getShapePortRatio } from './canvasUtils'

export type PortPositionId = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

export interface CanvasPortAnchor {
  id: PortPositionId
  side: CanvasEdgeSide
  x: number
  y: number
  /** Unit outward normal vector X (-1 to 1) */
  nx: number
  /** Unit outward normal vector Y (-1 to 1) */
  ny: number
  /** Backward compatible normal object */
  normal: { nx: number; ny: number }
}

export type PortInfo = CanvasPortAnchor

const INV_SQRT2 = 0.7071067811865475

export const PORT_DEFINITIONS: {
  id: PortPositionId
  side: CanvasEdgeSide
  normal: { nx: number; ny: number }
}[] = [
  { id: 'n', side: 'top', normal: { nx: 0, ny: -1 } },
  { id: 'ne', side: 'top', normal: { nx: INV_SQRT2, ny: -INV_SQRT2 } },
  { id: 'e', side: 'right', normal: { nx: 1, ny: 0 } },
  { id: 'se', side: 'bottom', normal: { nx: INV_SQRT2, ny: INV_SQRT2 } },
  { id: 's', side: 'bottom', normal: { nx: 0, ny: 1 } },
  { id: 'sw', side: 'bottom', normal: { nx: -INV_SQRT2, ny: INV_SQRT2 } },
  { id: 'w', side: 'left', normal: { nx: -1, ny: 0 } },
  { id: 'nw', side: 'top', normal: { nx: -INV_SQRT2, ny: -INV_SQRT2 } }
]

function makePort(
  id: PortPositionId,
  side: CanvasEdgeSide,
  x: number,
  y: number,
  nx: number,
  ny: number
): CanvasPortAnchor {
  return {
    id,
    side,
    x,
    y,
    nx,
    ny,
    normal: { nx, ny }
  }
}

/**
 * Computes all 8 fixed anchor ports on the exact outer boundary for any node or shape.
 */
export function getNodePorts(node: {
  x: number
  y: number
  width?: number
  height?: number
  type?: string
  shape?: CanvasShapeType
}): CanvasPortAnchor[] {
  const x = safeNumber(node.x, 0)
  const y = safeNumber(node.y, 0)
  const w = Math.max(safeNumber(node.width, 140), 30)
  const h = Math.max(safeNumber(node.height, 100), 30)

  const resolvedShape =
    node.shape || (node as any).shapeType || (node.type === 'shape' ? 'rectangle' : undefined)

  // 1. Circle
  if (resolvedShape === 'circle') {
    const cx = x + w / 2
    const cy = y + h / 2
    const rx = w * 0.46
    const ry = h * 0.46
    return [
      makePort('n', 'top', cx, cy - ry, 0, -1),
      makePort('ne', 'top', cx + rx * INV_SQRT2, cy - ry * INV_SQRT2, INV_SQRT2, -INV_SQRT2),
      makePort('e', 'right', cx + rx, cy, 1, 0),
      makePort('se', 'bottom', cx + rx * INV_SQRT2, cy + ry * INV_SQRT2, INV_SQRT2, INV_SQRT2),
      makePort('s', 'bottom', cx, cy + ry, 0, 1),
      makePort('sw', 'bottom', cx - rx * INV_SQRT2, cy + ry * INV_SQRT2, -INV_SQRT2, INV_SQRT2),
      makePort('w', 'left', cx - rx, cy, -1, 0),
      makePort('nw', 'top', cx - rx * INV_SQRT2, cy - ry * INV_SQRT2, -INV_SQRT2, -INV_SQRT2)
    ]
  }

  // 2. Cylinder
  if (resolvedShape === 'cylinder') {
    const cx = x + w / 2
    return [
      makePort('n', 'top', cx, y + h * 0.08, 0, -1),
      makePort('ne', 'top', x + w * 0.85, y + h * 0.12, INV_SQRT2, -INV_SQRT2),
      makePort('e', 'right', x + w * 0.94, y + h * 0.5, 1, 0),
      makePort('se', 'bottom', x + w * 0.85, y + h * 0.88, INV_SQRT2, INV_SQRT2),
      makePort('s', 'bottom', cx, y + h * 0.92, 0, 1),
      makePort('sw', 'bottom', x + w * 0.15, y + h * 0.88, -INV_SQRT2, INV_SQRT2),
      makePort('w', 'left', x + w * 0.06, y + h * 0.5, -1, 0),
      makePort('nw', 'top', x + w * 0.15, y + h * 0.12, -INV_SQRT2, -INV_SQRT2)
    ]
  }

  // 3. Diamond
  if (resolvedShape === 'diamond') {
    return [
      makePort('n', 'top', x + w / 2, y + h * 0.04, 0, -1),
      makePort('ne', 'top', x + w * 0.73, y + h * 0.27, INV_SQRT2, -INV_SQRT2),
      makePort('e', 'right', x + w * 0.96, y + h / 2, 1, 0),
      makePort('se', 'bottom', x + w * 0.73, y + h * 0.73, INV_SQRT2, INV_SQRT2),
      makePort('s', 'bottom', x + w / 2, y + h * 0.96, 0, 1),
      makePort('sw', 'bottom', x + w * 0.27, y + h * 0.73, -INV_SQRT2, INV_SQRT2),
      makePort('w', 'left', x + w * 0.04, y + h / 2, -1, 0),
      makePort('nw', 'top', x + w * 0.27, y + h * 0.27, -INV_SQRT2, -INV_SQRT2)
    ]
  }

  // 4. Triangle
  if (resolvedShape === 'triangle') {
    return [
      makePort('n', 'top', x + w / 2, y + h * 0.06, 0, -1),
      makePort('ne', 'top', x + w * 0.65, y + h * 0.35, INV_SQRT2, -INV_SQRT2),
      makePort('e', 'right', x + w * 0.73, y + h * 0.5, 1, 0),
      makePort('se', 'bottom', x + w * 0.94, y + h * 0.94, INV_SQRT2, INV_SQRT2),
      makePort('s', 'bottom', x + w / 2, y + h * 0.94, 0, 1),
      makePort('sw', 'bottom', x + w * 0.06, y + h * 0.94, -INV_SQRT2, INV_SQRT2),
      makePort('w', 'left', x + w * 0.27, y + h * 0.5, -1, 0),
      makePort('nw', 'top', x + w * 0.35, y + h * 0.35, -INV_SQRT2, -INV_SQRT2)
    ]
  }

  // 5. Actor (Stick figure / User)
  if (resolvedShape === 'actor') {
    const aspect = w / (h || 1)
    const headRy = 13 * Math.min(2.5, Math.max(0.4, aspect))
    const topY = y + h * Math.max(0.01, (18 - headRy) / 100)
    return [
      makePort('n', 'top', x + w * 0.5, topY, 0, -1),
      makePort('ne', 'top', x + w * 0.86, y + h * 0.48, INV_SQRT2, -INV_SQRT2),
      makePort('e', 'right', x + w * 0.86, y + h * 0.48, 1, 0),
      makePort('se', 'bottom', x + w * 0.74, y + h * 0.94, INV_SQRT2, INV_SQRT2),
      makePort('s', 'bottom', x + w * 0.5, y + h * 0.94, 0, 1),
      makePort('sw', 'bottom', x + w * 0.26, y + h * 0.94, -INV_SQRT2, INV_SQRT2),
      makePort('w', 'left', x + w * 0.14, y + h * 0.48, -1, 0),
      makePort('nw', 'top', x + w * 0.14, y + h * 0.48, -INV_SQRT2, -INV_SQRT2)
    ]
  }

  // 6. Generic custom shapes using getShapePortRatio
  if (resolvedShape && resolvedShape !== 'rectangle' && resolvedShape !== 'rounded-rectangle') {
    const topRatio = getShapePortRatio(resolvedShape, 'top')
    const rightRatio = getShapePortRatio(resolvedShape, 'right')
    const bottomRatio = getShapePortRatio(resolvedShape, 'bottom')
    const leftRatio = getShapePortRatio(resolvedShape, 'left')

    return [
      makePort('n', 'top', x + w * topRatio.rx, y + h * topRatio.ry, 0, -1),
      makePort('ne', 'top', x + w * rightRatio.rx, y + h * topRatio.ry, INV_SQRT2, -INV_SQRT2),
      makePort('e', 'right', x + w * rightRatio.rx, y + h * rightRatio.ry, 1, 0),
      makePort('se', 'bottom', x + w * rightRatio.rx, y + h * bottomRatio.ry, INV_SQRT2, INV_SQRT2),
      makePort('s', 'bottom', x + w * bottomRatio.rx, y + h * bottomRatio.ry, 0, 1),
      makePort('sw', 'bottom', x + w * leftRatio.rx, y + h * bottomRatio.ry, -INV_SQRT2, INV_SQRT2),
      makePort('w', 'left', x + w * leftRatio.rx, y + h * leftRatio.ry, -1, 0),
      makePort('nw', 'top', x + w * leftRatio.rx, y + h * topRatio.ry, -INV_SQRT2, -INV_SQRT2)
    ]
  }

  // 7. Standard rectangular card & box layout (notes, cards, rectangles, rounded rects)
  return [
    makePort('n', 'top', x + w / 2, y, 0, -1),
    makePort('ne', 'top', x + w, y, INV_SQRT2, -INV_SQRT2),
    makePort('e', 'right', x + w, y + h / 2, 1, 0),
    makePort('se', 'bottom', x + w, y + h, INV_SQRT2, INV_SQRT2),
    makePort('s', 'bottom', x + w / 2, y + h, 0, 1),
    makePort('sw', 'bottom', x, y + h, -INV_SQRT2, INV_SQRT2),
    makePort('w', 'left', x, y + h / 2, -1, 0),
    makePort('nw', 'top', x, y, -INV_SQRT2, -INV_SQRT2)
  ]
}

/**
 * Retrieves a specific port by side ('top', 'right', 'bottom', 'left') with its outward normal.
 */
export function getNodePortBySide(
  node: { x: number; y: number; width?: number; height?: number; type?: string; shape?: CanvasShapeType },
  side: CanvasEdgeSide
): CanvasPortAnchor {
  const x = safeNumber(node.x, 0)
  const y = safeNumber(node.y, 0)
  const w = Math.max(safeNumber(node.width, 140), 30)
  const h = Math.max(safeNumber(node.height, 100), 30)

  const resolvedShape =
    node.shape || (node as any).shapeType || (node.type === 'shape' ? 'rectangle' : undefined)

  const ratio = getShapePortRatio(resolvedShape, side)
  let px = x + w * ratio.rx
  let py = y + h * ratio.ry

  if (resolvedShape === 'actor' && side === 'top') {
    const aspect = w / (h || 1)
    const headRy = (13 * Math.min(2.5, Math.max(0.4, aspect))) / 100
    py = y + h * Math.max(0.01, 0.18 - headRy)
  }

  let nx = 0
  let ny = 0
  let id: PortPositionId = 'n'

  switch (side) {
    case 'top':
      nx = 0
      ny = -1
      id = 'n'
      break
    case 'right':
      nx = 1
      ny = 0
      id = 'e'
      break
    case 'bottom':
      nx = 0
      ny = 1
      id = 's'
      break
    case 'left':
    default:
      nx = -1
      ny = 0
      id = 'w'
      break
  }

  return makePort(id, side, px, py, nx, ny)
}

export interface OptimalPortPairResult {
  fromPort: CanvasPortAnchor
  toPort: CanvasPortAnchor
  fromSide: CanvasEdgeSide
  toSide: CanvasEdgeSide
}

/**
 * Dynamically selects the optimal port pair between two nodes.
 *
 * Scoring algorithm:
 * - Computes Euclidean distance between port candidates.
 * - Computes outward normal alignment: ports must point outward toward the other node.
 * - Cardinal ports (N, E, S, W) receive an architectural bonus for cleaner technical layouts.
 * - Rejects ports whose normals point directly away from the target.
 */
export function getOptimalPortPair(
  fromNode: { x: number; y: number; width?: number; height?: number; type?: string; shape?: CanvasShapeType },
  toNode: { x: number; y: number; width?: number; height?: number; type?: string; shape?: CanvasShapeType },
  fixedFromSide?: CanvasEdgeSide,
  fixedToSide?: CanvasEdgeSide
): OptimalPortPairResult {
  // If both sides are strictly fixed by user:
  if (fixedFromSide && fixedToSide) {
    const fp = getNodePortBySide(fromNode, fixedFromSide)
    const tp = getNodePortBySide(toNode, fixedToSide)
    return {
      fromPort: fp,
      toPort: tp,
      fromSide: fp.side,
      toSide: tp.side
    }
  }

  // If fixedFromSide is fixed:
  if (fixedFromSide) {
    const fp = getNodePortBySide(fromNode, fixedFromSide)
    const candidateSides: CanvasEdgeSide[] = ['left', 'right', 'top', 'bottom']
    let bestTp = getNodePortBySide(toNode, fixedToSide || 'left')
    let bestD = Infinity
    for (const s of candidateSides) {
      const tp = getNodePortBySide(toNode, s)
      const d = Math.hypot(tp.x - fp.x, tp.y - fp.y)
      if (d < bestD) {
        bestD = d
        bestTp = tp
      }
    }
    return {
      fromPort: fp,
      toPort: bestTp,
      fromSide: fp.side,
      toSide: bestTp.side
    }
  }

  // If fixedToSide is fixed:
  if (fixedToSide) {
    const tp = getNodePortBySide(toNode, fixedToSide)
    const candidateSides: CanvasEdgeSide[] = ['left', 'right', 'top', 'bottom']
    let bestFp = getNodePortBySide(fromNode, fixedFromSide || 'right')
    let bestD = Infinity
    for (const s of candidateSides) {
      const fp = getNodePortBySide(fromNode, s)
      const d = Math.hypot(tp.x - fp.x, tp.y - fp.y)
      if (d < bestD) {
        bestD = d
        bestFp = fp
      }
    }
    return {
      fromPort: bestFp,
      toPort: tp,
      fromSide: bestFp.side,
      toSide: tp.side
    }
  }

  // If neither is fixed: search only among the 4 cardinal ports
  const cardinalSides: CanvasEdgeSide[] = ['top', 'right', 'bottom', 'left']
  let bestPair: { fromPort: CanvasPortAnchor; toPort: CanvasPortAnchor } | null = null
  let bestScore = Infinity

  for (const fs of cardinalSides) {
    const fp = getNodePortBySide(fromNode, fs)
    for (const ts of cardinalSides) {
      const tp = getNodePortBySide(toNode, ts)
      const dx = tp.x - fp.x
      const dy = tp.y - fp.y
      const dist = Math.hypot(dx, dy)
      if (dist < 1) continue

      const ux = dx / dist
      const uy = dy / dist

      const fromDot = fp.nx * ux + fp.ny * uy
      const toDot = tp.nx * -ux + tp.ny * -uy

      if (fromDot < -0.3 || toDot < -0.3) {
        continue
      }

      const facingBonus = Math.max(0, fromDot) + Math.max(0, toDot)
      const score = dist * (1.4 - 0.4 * facingBonus)

      if (score < bestScore) {
        bestScore = score
        bestPair = { fromPort: fp, toPort: tp }
      }
    }
  }

  if (!bestPair) {
    const fp = getNodePortBySide(fromNode, 'right')
    const tp = getNodePortBySide(toNode, 'left')
    return {
      fromPort: fp,
      toPort: tp,
      fromSide: fp.side,
      toSide: tp.side
    }
  }

  return {
    fromPort: bestPair.fromPort,
    toPort: bestPair.toPort,
    fromSide: bestPair.fromPort.side,
    toSide: bestPair.toPort.side
  }
}
