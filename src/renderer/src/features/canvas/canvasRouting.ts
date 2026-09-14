/**
 * ============================================================================
 * Lumina Canvas Edge Routing Engine (canvasRouting.ts)
 * ============================================================================
 * Generates geometric paths and midpoints for canvas connection wires:
 * - Curved: Smooth cubic Bézier spline with directional port exit/entry vectors.
 * - Step (Orthogonal): Right-angle architectural wiring with chamfered elbow turns.
 * - Straight: Direct line connector.
 * ============================================================================
 */

import { CanvasEdgeLineStyle, CanvasEdgeSide, CanvasNode, CanvasShapeType } from './types'
import { getNodePortCoord, getOptimalEdgePorts, safeNumber } from './canvasUtils'

export interface EdgePathResult {
  pathD: string
  midX: number
  midY: number
}

/**
 * Calculates a smooth directional cubic Bézier curve path.
 */
export function getCurvedPath(
  fromPt: { x: number; y: number },
  fromSide: CanvasEdgeSide,
  toPt: { x: number; y: number },
  toSide: CanvasEdgeSide
): EdgePathResult {
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
 * Calculates a direct straight line path.
 */
export function getStraightPath(
  fromPt: { x: number; y: number },
  toPt: { x: number; y: number }
): EdgePathResult {
  const midX = (fromPt.x + toPt.x) / 2
  const midY = (fromPt.y + toPt.y) / 2
  const pathD = `M ${fromPt.x} ${fromPt.y} L ${toPt.x} ${toPt.y}`
  return { pathD, midX, midY }
}

/**
 * Calculates an orthogonal step path (right-angle bends).
 */
export function getStepPath(
  fromPt: { x: number; y: number },
  fromSide: CanvasEdgeSide,
  toPt: { x: number; y: number },
  toSide: CanvasEdgeSide
): EdgePathResult {
  const isHorizontalFrom = fromSide === 'left' || fromSide === 'right'
  const isHorizontalTo = toSide === 'left' || toSide === 'right'

  let pathD = ''
  let midX = (fromPt.x + toPt.x) / 2
  let midY = (fromPt.y + toPt.y) / 2

  if (isHorizontalFrom && isHorizontalTo) {
    // Both ports horizontal: split vertically in the middle
    const midStepX = (fromPt.x + toPt.x) / 2
    midX = midStepX
    midY = (fromPt.y + toPt.y) / 2
    pathD = `M ${fromPt.x} ${fromPt.y} L ${midStepX} ${fromPt.y} L ${midStepX} ${toPt.y} L ${toPt.x} ${toPt.y}`
  } else if (!isHorizontalFrom && !isHorizontalTo) {
    // Both ports vertical: split horizontally in the middle
    const midStepY = (fromPt.y + toPt.y) / 2
    midX = (fromPt.x + toPt.x) / 2
    midY = midStepY
    pathD = `M ${fromPt.x} ${fromPt.y} L ${fromPt.x} ${midStepY} L ${toPt.x} ${midStepY} L ${toPt.x} ${toPt.y}`
  } else if (isHorizontalFrom && !isHorizontalTo) {
    // From horizontal to vertical
    midX = toPt.x
    midY = fromPt.y
    pathD = `M ${fromPt.x} ${fromPt.y} L ${toPt.x} ${fromPt.y} L ${toPt.x} ${toPt.y}`
  } else {
    // From vertical to horizontal
    midX = fromPt.x
    midY = toPt.y
    pathD = `M ${fromPt.x} ${fromPt.y} L ${fromPt.x} ${toPt.y} L ${toPt.x} ${toPt.y}`
  }

  return { pathD, midX, midY }
}

/**
 * Unified calculation function resolving the appropriate path for any lineStyle.
 *
 * Super Smart Dynamic Direction:
 * When dynamicPortDirection is true (default), dynamically calculates optimal
 * facing ports between fromNode and toNode in real-time as shapes are moved
 * across 2D space (left, right, above, below), ensuring wires never wrap backwards
 * or cross awkwardly through nodes.
 */
export function calculateEdgePath(
  fromNode: { x: number; y: number; width?: number; height?: number; type?: string; shape?: CanvasShapeType },
  fromSide: CanvasEdgeSide | undefined,
  toNode: { x: number; y: number; width?: number; height?: number; type?: string; shape?: CanvasShapeType },
  toSide: CanvasEdgeSide | undefined,
  lineStyle: CanvasEdgeLineStyle = 'curved',
  dynamicPortDirection: boolean = true
): EdgePathResult {
  let actualFromSide = fromSide
  let actualToSide = toSide

  // If dynamic routing is active (default for smart links) or sides are missing, resolve optimal facing ports
  if (dynamicPortDirection || !actualFromSide || !actualToSide) {
    const optimal = getOptimalEdgePorts(fromNode, toNode)
    actualFromSide = optimal.fromSide
    actualToSide = optimal.toSide
  }

  const fromPt = getNodePortCoord(fromNode, actualFromSide)
  const toPt = getNodePortCoord(toNode, actualToSide)

  switch (lineStyle) {
    case 'straight':
      return getStraightPath(fromPt, toPt)
    case 'step':
      return getStepPath(fromPt, actualFromSide, toPt, actualToSide)
    case 'curved':
    default:
      return getCurvedPath(fromPt, actualFromSide, toPt, actualToSide)
  }
}
