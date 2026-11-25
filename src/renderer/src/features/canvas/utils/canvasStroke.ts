/**
 * ============================================================================
 * Lumina Canvas Freehand Stroke Geometry Engine (`utils/canvasStroke.ts`)
 * ============================================================================
 * High-performance smooth vector ink utilities for Pencil & Eraser tools:
 * - Quadratic midpoint Bézier smoothing for silky-smooth hand-drawn curves
 * - Distance-based point thinning to keep `.canvas` JSON compact
 * - Fast bounding-box rejection + segment distance hit-testing for eraser
 * ============================================================================
 */

import { CanvasStroke, CanvasStrokePoint } from '../types'

/**
 * Converts a sequence of sampled canvas points into a smooth SVG path `d` string
 * using quadratic midpoint interpolation.
 */
export function buildSmoothStrokePath(points: CanvasStrokePoint[]): string {
  if (!points || points.length === 0) return ''
  if (points.length === 1) {
    const p = points[0]
    return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${(p.x + 0.1).toFixed(1)} ${(p.y + 0.1).toFixed(1)}`
  }
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`
  }

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
  for (let i = 1; i < points.length - 1; i++) {
    const curr = points[i]
    const next = points[i + 1]
    const midX = (curr.x + next.x) / 2
    const midY = (curr.y + next.y) / 2
    d += ` Q ${curr.x.toFixed(1)} ${curr.y.toFixed(1)} ${midX.toFixed(1)} ${midY.toFixed(1)}`
  }

  const last = points[points.length - 1]
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`
  return d
}

/**
 * Simplifies raw pointer points by dropping micro-jitter points closer than `minDist`.
 */
export function simplifyStrokePoints(
  points: CanvasStrokePoint[],
  minDist: number = 1.8
): CanvasStrokePoint[] {
  if (points.length <= 2) return points
  const out: CanvasStrokePoint[] = [points[0]]
  let last = points[0]
  const minDistSq = minDist * minDist

  for (let i = 1; i < points.length - 1; i++) {
    const pt = points[i]
    const dx = pt.x - last.x
    const dy = pt.y - last.y
    if (dx * dx + dy * dy >= minDistSq) {
      out.push({
        x: Math.round(pt.x * 10) / 10,
        y: Math.round(pt.y * 10) / 10,
        ...(pt.pressure !== undefined ? { pressure: Math.round(pt.pressure * 100) / 100 } : {})
      })
      last = pt
    }
  }

  const end = points[points.length - 1]
  out.push({
    x: Math.round(end.x * 10) / 10,
    y: Math.round(end.y * 10) / 10,
    ...(end.pressure !== undefined ? { pressure: Math.round(end.pressure * 100) / 100 } : {})
  })
  return out
}

/**
 * Computes shortest distance squared from point P to line segment AB.
 */
function pointToSegmentDistSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const abx = bx - ax
  const aby = by - ay
  const lenSq = abx * abx + aby * aby
  if (lenSq === 0) {
    const dx = px - ax
    const dy = py - ay
    return dx * dx + dy * dy
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lenSq))
  const projX = ax + t * abx
  const projY = ay + t * aby
  const dx = px - projX
  const dy = py - projY
  return dx * dx + dy * dy
}

/**
 * Checks whether an eraser circle at `(x, y)` with `radius` intersects a stroke.
 */
export function isPointNearStroke(
  stroke: CanvasStroke,
  x: number,
  y: number,
  radius: number = 14
): boolean {
  const pts = stroke.points
  if (!pts || pts.length === 0) return false
  const hitRadius = radius + (stroke.strokeWidth || 3) / 2
  const hitRadiusSq = hitRadius * hitRadius

  if (pts.length === 1) {
    const dx = x - pts[0].x
    const dy = y - pts[0].y
    return dx * dx + dy * dy <= hitRadiusSq
  }

  // Fast AABB rejection
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }

  if (
    x < minX - hitRadius ||
    x > maxX + hitRadius ||
    y < minY - hitRadius ||
    y > maxY + hitRadius
  ) {
    return false
  }

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    if (pointToSegmentDistSq(x, y, a.x, a.y, b.x, b.y) <= hitRadiusSq) {
      return true
    }
  }
  return false
}
