/**
 * ============================================================================
 * Lumina Canvas Alignment & Distribution Engine (canvasAlignment.ts)
 * ============================================================================
 * Pure mathematical functions for aligning and distributing canvas nodes.
 *
 * Capabilities:
 * - Align Left, Center (Horizontal), Right
 * - Align Top, Middle (Vertical), Bottom
 * - Distribute Horizontally (equal gap between nodes)
 * - Distribute Vertically (equal gap between nodes)
 * ============================================================================
 */

import { CanvasNode } from './types'

export type CanvasAlignmentType =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom'

export type CanvasDistributionType = 'horizontal' | 'vertical'

export interface NodePositionUpdate {
  id: string
  x: number
  y: number
}

/**
 * Aligns selected nodes along a specified edge or center line based on their collective bounding box.
 * Returns updated positions for selected nodes, preserving unselected nodes.
 */
export function computeAlignedNodePositions(
  nodes: CanvasNode[],
  selectedIds: string[],
  alignment: CanvasAlignmentType
): NodePositionUpdate[] {
  if (selectedIds.length < 2) return []

  const selectedSet = new Set(selectedIds)
  const targetNodes = nodes.filter((n) => selectedSet.has(n.id))
  if (targetNodes.length < 2) return []

  // Compute collective bounding box
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const n of targetNodes) {
    if (n.x < minX) minX = n.x
    if (n.x + n.width > maxX) maxX = n.x + n.width
    if (n.y < minY) minY = n.y
    if (n.y + n.height > maxY) maxY = n.y + n.height
  }

  const updates: NodePositionUpdate[] = []

  switch (alignment) {
    case 'left':
      for (const n of targetNodes) {
        if (n.x !== minX) {
          updates.push({ id: n.id, x: minX, y: n.y })
        }
      }
      break

    case 'center': {
      const centerX = (minX + maxX) / 2
      for (const n of targetNodes) {
        const newX = Math.round(centerX - n.width / 2)
        if (n.x !== newX) {
          updates.push({ id: n.id, x: newX, y: n.y })
        }
      }
      break
    }

    case 'right':
      for (const n of targetNodes) {
        const newX = maxX - n.width
        if (n.x !== newX) {
          updates.push({ id: n.id, x: newX, y: n.y })
        }
      }
      break

    case 'top':
      for (const n of targetNodes) {
        if (n.y !== minY) {
          updates.push({ id: n.id, x: n.x, y: minY })
        }
      }
      break

    case 'middle': {
      const centerY = (minY + maxY) / 2
      for (const n of targetNodes) {
        const newY = Math.round(centerY - n.height / 2)
        if (n.y !== newY) {
          updates.push({ id: n.id, x: n.x, y: newY })
        }
      }
      break
    }

    case 'bottom':
      for (const n of targetNodes) {
        const newY = maxY - n.height
        if (n.y !== newY) {
          updates.push({ id: n.id, x: n.x, y: newY })
        }
      }
      break
  }

  return updates
}

/**
 * Distributes nodes evenly along horizontal or vertical axes.
 * Requires at least 3 nodes to distribute spacing between outer-most anchors.
 */
export function computeDistributedNodePositions(
  nodes: CanvasNode[],
  selectedIds: string[],
  direction: CanvasDistributionType
): NodePositionUpdate[] {
  if (selectedIds.length < 3) return []

  const selectedSet = new Set(selectedIds)
  const targetNodes = nodes.filter((n) => selectedSet.has(n.id))
  if (targetNodes.length < 3) return []

  const updates: NodePositionUpdate[] = []

  if (direction === 'horizontal') {
    // Sort nodes by X coordinate left to right
    const sorted = [...targetNodes].sort((a, b) => a.x - b.x)
    const first = sorted[0]
    const last = sorted[sorted.length - 1]

    // Total span available between the start of first and end of last
    const totalSpan = last.x + last.width - first.x
    const totalNodeWidths = sorted.reduce((sum, n) => sum + n.width, 0)
    const totalGaps = sorted.length - 1

    // If total width exceeds span (overlapping), distribute centers evenly instead
    if (totalNodeWidths >= totalSpan) {
      const firstCenter = first.x + first.width / 2
      const lastCenter = last.x + last.width / 2
      const step = (lastCenter - firstCenter) / totalGaps

      for (let i = 1; i < sorted.length - 1; i++) {
        const targetCenter = firstCenter + i * step
        const newX = Math.round(targetCenter - sorted[i].width / 2)
        if (sorted[i].x !== newX) {
          updates.push({ id: sorted[i].id, x: newX, y: sorted[i].y })
        }
      }
    } else {
      const gap = (totalSpan - totalNodeWidths) / totalGaps
      let currentX = first.x + first.width + gap

      for (let i = 1; i < sorted.length - 1; i++) {
        const newX = Math.round(currentX)
        if (sorted[i].x !== newX) {
          updates.push({ id: sorted[i].id, x: newX, y: sorted[i].y })
        }
        currentX += sorted[i].width + gap
      }
    }
  } else {
    // Sort nodes by Y coordinate top to bottom
    const sorted = [...targetNodes].sort((a, b) => a.y - b.y)
    const first = sorted[0]
    const last = sorted[sorted.length - 1]

    const totalSpan = last.y + last.height - first.y
    const totalNodeHeights = sorted.reduce((sum, n) => sum + n.height, 0)
    const totalGaps = sorted.length - 1

    if (totalNodeHeights >= totalSpan) {
      const firstCenter = first.y + first.height / 2
      const lastCenter = last.y + last.height / 2
      const step = (lastCenter - firstCenter) / totalGaps

      for (let i = 1; i < sorted.length - 1; i++) {
        const targetCenter = firstCenter + i * step
        const newY = Math.round(targetCenter - sorted[i].height / 2)
        if (sorted[i].y !== newY) {
          updates.push({ id: sorted[i].id, x: sorted[i].x, y: newY })
        }
      }
    } else {
      const gap = (totalSpan - totalNodeHeights) / totalGaps
      let currentY = first.y + first.height + gap

      for (let i = 1; i < sorted.length - 1; i++) {
        const newY = Math.round(currentY)
        if (sorted[i].y !== newY) {
          updates.push({ id: sorted[i].id, x: sorted[i].x, y: newY })
        }
        currentY += sorted[i].height + gap
      }
    }
  }

  return updates
}

/**
 * Calculates the bounding box containing all selected nodes in canvas coordinates.
 */
export function getSelectionBoundingBox(
  nodes: CanvasNode[],
  selectedIds: string[]
): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } | null {
  if (selectedIds.length === 0) return null
  const selectedSet = new Set(selectedIds)
  const targetNodes = nodes.filter((n) => selectedSet.has(n.id))
  if (targetNodes.length === 0) return null

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const n of targetNodes) {
    if (n.x < minX) minX = n.x
    if (n.x + n.width > maxX) maxX = n.x + n.width
    if (n.y < minY) minY = n.y
    if (n.y + n.height > maxY) maxY = n.y + n.height
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  }
}
