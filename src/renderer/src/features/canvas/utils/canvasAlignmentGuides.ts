/**
 * ============================================================================
 * Lumina Canvas Live Alignment Guides Engine (`canvasAlignmentGuides.ts`)
 * ============================================================================
 * Detects real-time spatial alignments during node dragging:
 * - Checks 6 axes: left, horizontal center, right, top, vertical center, bottom
 * - Snaps coordinate when within 5px tolerance threshold
 * - Generates guide lines spanning the bounding extents between aligned nodes
 * ============================================================================
 */

import { CanvasNode } from '../types'
import { safeNumber } from './canvasUtils'

export interface AlignmentGuide {
  id: string
  orientation: 'horizontal' | 'vertical'
  coordinate: number
  start: number
  end: number
}

export interface AlignmentSnapResult {
  snappedX: number
  snappedY: number
  guides: AlignmentGuide[]
}

export interface ComputeAlignmentOptions {
  draggingNodeId: string
  dragRect: { x: number; y: number; width: number; height: number }
  otherNodes?: CanvasNode[]
  allNodes?: CanvasNode[]
  snapThreshold?: number
}

const SNAP_TOLERANCE = 5

/**
 * Computes live alignment snaps and guide line coordinates between a dragging node
 * and all other static nodes currently on the canvas.
 * Supports both options object and positional arguments.
 */
export function computeAlignmentGuides(
  optionsOrId: string | ComputeAlignmentOptions,
  candidateX?: number,
  candidateY?: number,
  width?: number,
  height?: number,
  allNodes?: CanvasNode[],
  tolerance: number = SNAP_TOLERANCE
): AlignmentSnapResult {
  let draggingNodeId: string
  let cX: number
  let cY: number
  let w: number
  let h: number
  let nodes: CanvasNode[]
  let tol: number

  if (typeof optionsOrId === 'object' && optionsOrId !== null) {
    draggingNodeId = optionsOrId.draggingNodeId
    cX = optionsOrId.dragRect.x
    cY = optionsOrId.dragRect.y
    w = optionsOrId.dragRect.width
    h = optionsOrId.dragRect.height
    nodes = optionsOrId.otherNodes || optionsOrId.allNodes || []
    tol = optionsOrId.snapThreshold ?? SNAP_TOLERANCE
  } else {
    draggingNodeId = optionsOrId
    cX = candidateX ?? 0
    cY = candidateY ?? 0
    w = width ?? 140
    h = height ?? 100
    nodes = allNodes ?? []
    tol = tolerance
  }

  let snappedX = cX
  let snappedY = cY
  const guides: AlignmentGuide[] = []

  const others = nodes.filter((n) => n.id !== draggingNodeId)
  if (others.length === 0) {
    return { snappedX, snappedY, guides }
  }

  // Dragging node candidate points
  const dragLeft = cX
  const dragCenterX = cX + w / 2
  const dragRight = cX + w

  const dragTop = cY
  const dragCenterY = cY + h / 2
  const dragBottom = cY + h

  let minDiffX = tol + 1
  let bestSnapX: number | null = null
  let matchedOtherNodeX: CanvasNode | null = null
  let guideLineX: number | null = null

  let minDiffY = tol + 1
  let bestSnapY: number | null = null
  let matchedOtherNodeY: CanvasNode | null = null
  let guideLineY: number | null = null

  // 1. Scan for horizontal / X alignments (Vertical guide lines)
  for (const other of others) {
    const ox = safeNumber(other.x, 0)
    const ow = Math.max(safeNumber(other.width, 140), 30)
    const otherLeft = ox
    const otherCenterX = ox + ow / 2
    const otherRight = ox + ow

    const checkPairsX = [
      // Left alignment
      { dragPt: dragLeft, otherPt: otherLeft, snapOffset: 0 },
      { dragPt: dragLeft, otherPt: otherCenterX, snapOffset: 0 },
      { dragPt: dragLeft, otherPt: otherRight, snapOffset: 0 },
      // Center alignment
      { dragPt: dragCenterX, otherPt: otherCenterX, snapOffset: -w / 2 },
      { dragPt: dragCenterX, otherPt: otherLeft, snapOffset: -w / 2 },
      { dragPt: dragCenterX, otherPt: otherRight, snapOffset: -w / 2 },
      // Right alignment
      { dragPt: dragRight, otherPt: otherRight, snapOffset: -w },
      { dragPt: dragRight, otherPt: otherLeft, snapOffset: -w },
      { dragPt: dragRight, otherPt: otherCenterX, snapOffset: -w }
    ]

    for (const pair of checkPairsX) {
      const diff = Math.abs(pair.dragPt - pair.otherPt)
      if (diff <= tol && diff < minDiffX) {
        minDiffX = diff
        bestSnapX = pair.otherPt + pair.snapOffset
        guideLineX = pair.otherPt
        matchedOtherNodeX = other
      }
    }
  }

  // 2. Scan for vertical / Y alignments (Horizontal guide lines)
  for (const other of others) {
    const oy = safeNumber(other.y, 0)
    const oh = Math.max(safeNumber(other.height, 100), 30)
    const otherTop = oy
    const otherCenterY = oy + oh / 2
    const otherBottom = oy + oh

    const checkPairsY = [
      // Top alignment
      { dragPt: dragTop, otherPt: otherTop, snapOffset: 0 },
      { dragPt: dragTop, otherPt: otherCenterY, snapOffset: 0 },
      { dragPt: dragTop, otherPt: otherBottom, snapOffset: 0 },
      // Center alignment
      { dragPt: dragCenterY, otherPt: otherCenterY, snapOffset: -h / 2 },
      { dragPt: dragCenterY, otherPt: otherTop, snapOffset: -h / 2 },
      { dragPt: dragCenterY, otherPt: otherBottom, snapOffset: -h / 2 },
      // Bottom alignment
      { dragPt: dragBottom, otherPt: otherBottom, snapOffset: -h },
      { dragPt: dragBottom, otherPt: otherTop, snapOffset: -h },
      { dragPt: dragBottom, otherPt: otherCenterY, snapOffset: -h }
    ]

    for (const pair of checkPairsY) {
      const diff = Math.abs(pair.dragPt - pair.otherPt)
      if (diff <= tol && diff < minDiffY) {
        minDiffY = diff
        bestSnapY = pair.otherPt + pair.snapOffset
        guideLineY = pair.otherPt
        matchedOtherNodeY = other
      }
    }
  }

  // Apply horizontal snap & construct vertical guide line
  if (bestSnapX !== null && guideLineX !== null && matchedOtherNodeX) {
    snappedX = Math.round(bestSnapX)
    const otherY = safeNumber(matchedOtherNodeX.y, 0)
    const otherH = Math.max(safeNumber(matchedOtherNodeX.height, 100), 30)
    const startY = Math.min(cY, otherY) - 20
    const endY = Math.max(cY + h, otherY + otherH) + 20

    guides.push({
      id: `guide-v-${guideLineX}`,
      orientation: 'vertical',
      coordinate: guideLineX,
      start: startY,
      end: endY
    })
  }

  // Apply vertical snap & construct horizontal guide line
  if (bestSnapY !== null && guideLineY !== null && matchedOtherNodeY) {
    snappedY = Math.round(bestSnapY)
    const otherX = safeNumber(matchedOtherNodeY.x, 0)
    const otherW = Math.max(safeNumber(matchedOtherNodeY.width, 140), 30)
    const startX = Math.min(cX, otherX) - 20
    const endX = Math.max(cX + w, otherX + otherW) + 20

    guides.push({
      id: `guide-h-${guideLineY}`,
      orientation: 'horizontal',
      coordinate: guideLineY,
      start: startX,
      end: endX
    })
  }

  return { snappedX, snappedY, guides }
}
