/**
 * ============================================================================
 * Lumina Canvas Edge Routing Engine (`utils/canvasRouting.ts`)
 * ============================================================================
 * Professional diagram wire routing system:
 * - Direction-aware cubic Bézier splines with clamped control point offsets
 * - Orthogonal (Manhattan) routing with 8px rounded corners and 20px grid snapping
 * - Straight vector connections
 * - Boundary-accurate connections with zero gap and zero shape penetration
 * - Parallel edge fanning (perpendicular offsets for multi-edges between same nodes)
 * - Automatic optimal facing port selection from 8-port anchors
 * ============================================================================
 */

import { CanvasEdgeLineStyle, CanvasEdgeSide, CanvasShapeType } from '../types'
import { CanvasPortAnchor, getOptimalPortPair, getNodePortBySide } from './canvasPorts'

export interface EdgePathResult {
  pathD: string
  midX: number
  midY: number
}

export interface RouteEdgeOptions {
  fromNode: { x: number; y: number; width?: number; height?: number; type?: string; shape?: CanvasShapeType }
  fromSide?: CanvasEdgeSide
  toNode: { x: number; y: number; width?: number; height?: number; type?: string; shape?: CanvasShapeType }
  toSide?: CanvasEdgeSide
  lineStyle?: CanvasEdgeLineStyle
  dynamicPortDirection?: boolean
  snapToGrid?: boolean
  parallelIndex?: number
  totalParallel?: number
}

const CORNER_RADIUS = 8

/**
 * Helper to safely extract normal vector regardless of anchor format.
 */
function getPortNormal(port: CanvasPortAnchor): { nx: number; ny: number } {
  const nx = port.nx !== undefined ? port.nx : (port.normal?.nx ?? 0)
  const ny = port.ny !== undefined ? port.ny : (port.normal?.ny ?? 0)
  return { nx, ny }
}

/**
 * Calculates insets outside/along a port's normal vector.
 */
export function applyEndpointInset(
  fromPort: CanvasPortAnchor,
  toPort: CanvasPortAnchor,
  inset: number = 0
): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const fn = getPortNormal(fromPort)
  const tn = getPortNormal(toPort)
  return {
    start: {
      x: fromPort.x + fn.nx * inset,
      y: fromPort.y + fn.ny * inset
    },
    end: {
      x: toPort.x + tn.nx * inset,
      y: toPort.y + tn.ny * inset
    }
  }
}

/**
 * Applies perpendicular fan-out offsets for parallel edges connecting the same pair.
 */
export function applyParallelFanOut(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  index: number,
  total: number,
  gap: number = 12
): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const offset = total > 1 ? (index - (total - 1) / 2) * gap : 0
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const dist = Math.hypot(dx, dy)
  if (dist === 0 || offset === 0) {
    return { start: { ...p1 }, end: { ...p2 } }
  }
  const perpX = (-dy / dist) * offset
  const perpY = (dx / dist) * offset
  return {
    start: { x: p1.x + perpX, y: p1.y + perpY },
    end: { x: p2.x + perpX, y: p2.y + perpY }
  }
}

/**
 * Calculates a smooth direction-aware cubic Bézier spline.
 * Control points are derived strictly from outward port normals.
 * Offsets are clamped to [40, 150] proportional to distance.
 */
export function getCurvedPath(
  fromPort: CanvasPortAnchor,
  toPort: CanvasPortAnchor,
  parallelOffset: number = 0
): EdgePathResult {
  const p1 = { x: fromPort.x, y: fromPort.y }
  const p2 = { x: toPort.x, y: toPort.y }

  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const rawDist = Math.hypot(dx, dy)
  const cpOffset = Math.max(40, Math.min(rawDist * 0.4, 150))

  const fn = getPortNormal(fromPort)
  const tn = getPortNormal(toPort)

  let cp1x = p1.x + fn.nx * cpOffset
  let cp1y = p1.y + fn.ny * cpOffset
  let cp2x = p2.x + tn.nx * cpOffset
  let cp2y = p2.y + tn.ny * cpOffset

  // If parallel edge fanning is requested, apply perpendicular offset
  if (parallelOffset !== 0 && rawDist > 0) {
    const perpX = -dy / rawDist
    const perpY = dx / rawDist
    cp1x += perpX * parallelOffset
    cp1y += perpY * parallelOffset
    cp2x += perpX * parallelOffset
    cp2y += perpY * parallelOffset
  }

  // Exact Bézier midpoint at t = 0.5
  const midX = 0.125 * p1.x + 0.375 * cp1x + 0.375 * cp2x + 0.125 * p2.x
  const midY = 0.125 * p1.y + 0.375 * cp1y + 0.375 * cp2y + 0.125 * p2.y

  const pathD = `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`

  return { pathD, midX, midY }
}

/**
 * Calculates an orthogonal (Manhattan) path with rounded 8px corners.
 * Respects 20px grid snapping for intermediate runs.
 */
export function getOrthogonalPath(
  fromPort: CanvasPortAnchor,
  toPort: CanvasPortAnchor,
  snapToGrid: boolean = false,
  parallelOffset: number = 0
): EdgePathResult {
  const p1 = { x: fromPort.x, y: fromPort.y }
  const p2 = { x: toPort.x, y: toPort.y }

  const fn = getPortNormal(fromPort)
  const tn = getPortNormal(toPort)

  // Exit & entry buffers along port normals
  const exitBuffer = 24
  const exitPt = {
    x: p1.x + fn.nx * exitBuffer,
    y: p1.y + fn.ny * exitBuffer
  }
  const entryPt = {
    x: p2.x + tn.nx * exitBuffer,
    y: p2.y + tn.ny * exitBuffer
  }

  const rawWaypoints: { x: number; y: number }[] = [p1, exitPt]

  const isFromHorizontal = Math.abs(fn.nx) > Math.abs(fn.ny)
  const isToHorizontal = Math.abs(tn.nx) > Math.abs(tn.ny)

  if (isFromHorizontal && isToHorizontal) {
    // Both ports are horizontal (left or right)
    const facingEachOther =
      (fn.nx > 0 && tn.nx < 0 && exitPt.x <= entryPt.x) ||
      (fn.nx < 0 && tn.nx > 0 && exitPt.x >= entryPt.x)

    if (facingEachOther) {
      // Clean S/Z shape between them
      let midX = (exitPt.x + entryPt.x) / 2
      if (parallelOffset !== 0) midX += parallelOffset
      if (snapToGrid) midX = Math.round(midX / 20) * 20

      rawWaypoints.push({ x: midX, y: exitPt.y })
      rawWaypoints.push({ x: midX, y: entryPt.y })
    } else if (fn.nx * tn.nx > 0) {
      // Both face the same direction (e.g. both right or both left) -> U-shaped bypass bracket
      let busX =
        fn.nx > 0
          ? Math.max(exitPt.x, entryPt.x) + 20
          : Math.min(exitPt.x, entryPt.x) - 20
      if (parallelOffset !== 0) busX += parallelOffset
      if (snapToGrid) busX = Math.round(busX / 20) * 20

      rawWaypoints.push({ x: busX, y: exitPt.y })
      rawWaypoints.push({ x: busX, y: entryPt.y })
    } else {
      // Inverted overlap (e.g. fromPort is right, toPort is left, but toNode is left of fromNode)
      // Route around the intermediate corridor to avoid slicing backward through nodes
      const vertGap = Math.abs(exitPt.y - entryPt.y)
      if (vertGap > 70) {
        let midY = (exitPt.y + entryPt.y) / 2
        if (parallelOffset !== 0) midY += parallelOffset
        if (snapToGrid) midY = Math.round(midY / 20) * 20
        rawWaypoints.push({ x: exitPt.x, y: midY })
        rawWaypoints.push({ x: entryPt.x, y: midY })
      } else {
        let bypassY = Math.min(exitPt.y, entryPt.y) - 36
        if (parallelOffset !== 0) bypassY += parallelOffset
        if (snapToGrid) bypassY = Math.round(bypassY / 20) * 20
        rawWaypoints.push({ x: exitPt.x, y: bypassY })
        rawWaypoints.push({ x: entryPt.x, y: bypassY })
      }
    }
  } else if (!isFromHorizontal && !isToHorizontal) {
    // Both ports are vertical (top or bottom)
    const facingEachOther =
      (fn.ny > 0 && tn.ny < 0 && exitPt.y <= entryPt.y) ||
      (fn.ny < 0 && tn.ny > 0 && exitPt.y >= entryPt.y)

    if (facingEachOther) {
      // Clean S/Z shape between them
      let midY = (exitPt.y + entryPt.y) / 2
      if (parallelOffset !== 0) midY += parallelOffset
      if (snapToGrid) midY = Math.round(midY / 20) * 20

      rawWaypoints.push({ x: exitPt.x, y: midY })
      rawWaypoints.push({ x: entryPt.x, y: midY })
    } else if (fn.ny * tn.ny > 0) {
      // Both face the same direction (e.g. both top or both bottom) -> U-shaped bypass bracket
      let busY =
        fn.ny > 0
          ? Math.max(exitPt.y, entryPt.y) + 20
          : Math.min(exitPt.y, entryPt.y) - 20
      if (parallelOffset !== 0) busY += parallelOffset
      if (snapToGrid) busY = Math.round(busY / 20) * 20

      rawWaypoints.push({ x: exitPt.x, y: busY })
      rawWaypoints.push({ x: entryPt.x, y: busY })
    } else {
      // Inverted overlap
      const horizGap = Math.abs(exitPt.x - entryPt.x)
      if (horizGap > 70) {
        let midX = (exitPt.x + entryPt.x) / 2
        if (parallelOffset !== 0) midX += parallelOffset
        if (snapToGrid) midX = Math.round(midX / 20) * 20
        rawWaypoints.push({ x: midX, y: exitPt.y })
        rawWaypoints.push({ x: midX, y: entryPt.y })
      } else {
        let bypassX = Math.max(exitPt.x, entryPt.x) + 36
        if (parallelOffset !== 0) bypassX += parallelOffset
        if (snapToGrid) bypassX = Math.round(bypassX / 20) * 20
        rawWaypoints.push({ x: bypassX, y: exitPt.y })
        rawWaypoints.push({ x: bypassX, y: entryPt.y })
      }
    }
  } else if (isFromHorizontal && !isToHorizontal) {
    // From Horizontal, To Vertical (e.g. Right to Top, or Left to Bottom)
    const dx = entryPt.x - exitPt.x
    const dy = exitPt.y - entryPt.y
    const isNaturalL = dx * fn.nx >= 0 && dy * tn.ny >= 0

    if (isNaturalL) {
      let cornerX = entryPt.x
      let cornerY = exitPt.y
      if (parallelOffset !== 0) {
        cornerX += parallelOffset
        cornerY += parallelOffset
      }
      if (snapToGrid) {
        cornerX = Math.round(cornerX / 20) * 20
        cornerY = Math.round(cornerY / 20) * 20
      }
      rawWaypoints.push({ x: cornerX, y: cornerY })
    } else {
      let turnX = exitPt.x + fn.nx * 20
      if (parallelOffset !== 0) turnX += parallelOffset
      if (snapToGrid) turnX = Math.round(turnX / 20) * 20
      rawWaypoints.push({ x: turnX, y: exitPt.y })
      rawWaypoints.push({ x: turnX, y: entryPt.y })
    }
  } else {
    // From Vertical, To Horizontal (e.g. Bottom to Left, or Top to Right)
    const dy = entryPt.y - exitPt.y
    const dx = exitPt.x - entryPt.x
    const isNaturalL = dy * fn.ny >= 0 && dx * tn.nx >= 0

    if (isNaturalL) {
      let cornerX = exitPt.x
      let cornerY = entryPt.y
      if (parallelOffset !== 0) {
        cornerX += parallelOffset
        cornerY += parallelOffset
      }
      if (snapToGrid) {
        cornerX = Math.round(cornerX / 20) * 20
        cornerY = Math.round(cornerY / 20) * 20
      }
      rawWaypoints.push({ x: cornerX, y: cornerY })
    } else {
      let turnY = exitPt.y + fn.ny * 20
      if (parallelOffset !== 0) turnY += parallelOffset
      if (snapToGrid) turnY = Math.round(turnY / 20) * 20
      rawWaypoints.push({ x: exitPt.x, y: turnY })
      rawWaypoints.push({ x: entryPt.x, y: turnY })
    }
  }

  rawWaypoints.push(entryPt)
  rawWaypoints.push(p2)

  // Collapse consecutive collinear or identical points
  const waypoints: { x: number; y: number }[] = []
  for (let i = 0; i < rawWaypoints.length; i++) {
    const pt = rawWaypoints[i]
    const prev = waypoints[waypoints.length - 1]
    if (prev && Math.abs(prev.x - pt.x) < 1 && Math.abs(prev.y - pt.y) < 1) {
      continue
    }
    if (waypoints.length >= 2) {
      const pPrev = waypoints[waypoints.length - 2]
      const isCollinearX = Math.abs(pPrev.x - prev.x) < 1 && Math.abs(prev.x - pt.x) < 1
      const isCollinearY = Math.abs(pPrev.y - prev.y) < 1 && Math.abs(prev.y - pt.y) < 1
      if (isCollinearX || isCollinearY) {
        waypoints[waypoints.length - 1] = pt
        continue
      }
    }
    waypoints.push(pt)
  }

  // Construct SVG path with rounded 8px corners (fillets)
  let pathD = `M ${waypoints[0].x.toFixed(1)} ${waypoints[0].y.toFixed(1)}`

  for (let i = 1; i < waypoints.length - 1; i++) {
    const pPrev = waypoints[i - 1]
    const pCurr = waypoints[i]
    const pNext = waypoints[i + 1]

    const dPrev = Math.hypot(pCurr.x - pPrev.x, pCurr.y - pPrev.y)
    const dNext = Math.hypot(pNext.x - pCurr.x, pNext.y - pCurr.y)
    const r = Math.min(CORNER_RADIUS, dPrev / 2, dNext / 2)

    if (r > 1.5) {
      const v1x = (pPrev.x - pCurr.x) / dPrev
      const v1y = (pPrev.y - pCurr.y) / dPrev
      const v2x = (pNext.x - pCurr.x) / dNext
      const v2y = (pNext.y - pCurr.y) / dNext

      const cornerStart = { x: pCurr.x + v1x * r, y: pCurr.y + v1y * r }
      const cornerEnd = { x: pCurr.x + v2x * r, y: pCurr.y + v2y * r }

      pathD += ` L ${cornerStart.x.toFixed(1)} ${cornerStart.y.toFixed(1)}`
      pathD += ` Q ${pCurr.x.toFixed(1)} ${pCurr.y.toFixed(1)} ${cornerEnd.x.toFixed(1)} ${cornerEnd.y.toFixed(1)}`
    } else {
      pathD += ` L ${pCurr.x.toFixed(1)} ${pCurr.y.toFixed(1)}`
    }
  }

  const lastPt = waypoints[waypoints.length - 1]
  pathD += ` L ${lastPt.x.toFixed(1)} ${lastPt.y.toFixed(1)}`

  // Midpoint located on the middle segment
  const midIdx = Math.floor(waypoints.length / 2)
  const midA = waypoints[midIdx - 1] || waypoints[0]
  const midB = waypoints[midIdx] || waypoints[waypoints.length - 1]
  const midX = (midA.x + midB.x) / 2
  const midY = (midA.y + midB.y) / 2

  return { pathD, midX, midY }
}

/**
 * Calculates a direct straight vector line path.
 */
export function getStraightPath(
  fromPort: CanvasPortAnchor,
  toPort: CanvasPortAnchor,
  parallelOffset: number = 0
): EdgePathResult {
  const p1 = { x: fromPort.x, y: fromPort.y }
  const p2 = { x: toPort.x, y: toPort.y }

  let midX = (p1.x + p2.x) / 2
  let midY = (p1.y + p2.y) / 2

  if (parallelOffset !== 0) {
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const dist = Math.hypot(dx, dy)
    if (dist > 0) {
      midX += (-dy / dist) * parallelOffset
      midY += (dx / dist) * parallelOffset
    }
  }

  const pathD = `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} L ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  return { pathD, midX, midY }
}

/**
 * Helper to generate an edge path with generic options.
 */
export function generateEdgePath(options: {
  fromPort: CanvasPortAnchor
  toPort: CanvasPortAnchor
  routingMode?: CanvasEdgeLineStyle | 'curved' | 'orthogonal' | 'straight'
  snapToGrid?: boolean
  parallelIndex?: number
  totalParallel?: number
}): { path: string; centerPoint: { x: number; y: number } } {
  const mode = options.routingMode || 'curved'
  const offset = options.totalParallel && options.totalParallel > 1
    ? ((options.parallelIndex || 0) - (options.totalParallel - 1) / 2) * 12
    : 0

  let res: EdgePathResult
  if (mode === 'straight') {
    res = getStraightPath(options.fromPort, options.toPort, offset)
  } else if (mode === 'orthogonal' || mode === 'step') {
    res = getOrthogonalPath(options.fromPort, options.toPort, options.snapToGrid, offset)
  } else {
    res = getCurvedPath(options.fromPort, options.toPort, offset)
  }

  return {
    path: res.pathD,
    centerPoint: { x: res.midX, y: res.midY }
  }
}

/**
 * Unified calculation function resolving optimal routing for any edge.
 */
export function calculateEdgePath(
  fromNode: { x: number; y: number; width?: number; height?: number; type?: string; shape?: CanvasShapeType },
  fromSide: CanvasEdgeSide | undefined,
  toNode: { x: number; y: number; width?: number; height?: number; type?: string; shape?: CanvasShapeType },
  toSide: CanvasEdgeSide | undefined,
  lineStyle: CanvasEdgeLineStyle = 'curved',
  dynamicPortDirection: boolean = false,
  snapToGrid: boolean = false,
  parallelIndex: number = 0,
  totalParallel: number = 1
): EdgePathResult {
  // If sides are provided, use them! Only be dynamic if sides are omitted
  const effectiveFromSide = (!dynamicPortDirection || fromSide) ? fromSide : undefined
  const effectiveToSide = (!dynamicPortDirection || toSide) ? toSide : undefined

  // Resolve optimal 8-port anchors with outward normal vectors
  const { fromPort, toPort } = getOptimalPortPair(
    fromNode,
    toNode,
    effectiveFromSide,
    effectiveToSide
  )

  // Calculate perpendicular offset if multiple edges share this pair
  const parallelOffset = totalParallel > 1 ? (parallelIndex - (totalParallel - 1) / 2) * 12 : 0

  switch (lineStyle) {
    case 'straight':
      return getStraightPath(fromPort, toPort, parallelOffset)
    case 'step':
      return getOrthogonalPath(fromPort, toPort, snapToGrid, parallelOffset)
    case 'curved':
    default:
      return getCurvedPath(fromPort, toPort, parallelOffset)
  }
}
