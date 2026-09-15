import { describe, it, expect } from 'vitest'
import { computeAlignmentGuides } from '../../../../../src/renderer/src/features/canvas/utils/canvasAlignmentGuides'
import { CanvasNode } from '../../../../../src/renderer/src/features/canvas/types'

describe('canvasAlignmentGuides - Live Guides & Magnetic Snapping', () => {
  const staticNode: CanvasNode = {
    id: 'static-node',
    type: 'text',
    x: 200,
    y: 200,
    width: 100,
    height: 100
  }

  it('detects left-edge alignment within 5px tolerance and snaps x', () => {
    // staticNode left is 200
    // dragging node with x: 203 (3px away, within 5px tolerance)
    const result = computeAlignmentGuides({
      draggingNodeId: 'drag-node',
      dragRect: { x: 203, y: 50, width: 100, height: 100 },
      otherNodes: [staticNode],
      snapThreshold: 5
    })

    expect(result.guides.length).toBeGreaterThan(0)
    expect(result.snappedX).toBe(200) // Snapped exactly to staticNode left edge
    const vertGuide = result.guides.find((g) => g.orientation === 'vertical')
    expect(vertGuide).toBeDefined()
    expect(vertGuide!.coordinate).toBe(200)
  })

  it('detects center-Y alignment within 5px tolerance and snaps y', () => {
    // staticNode centerY is 250 (200 + 100/2)
    // dragging node with height 80, so centerY is y + 40
    // If y is 208, centerY is 248 (2px away from 250)
    const result = computeAlignmentGuides({
      draggingNodeId: 'drag-node',
      dragRect: { x: 50, y: 208, width: 100, height: 80 },
      otherNodes: [staticNode],
      snapThreshold: 5
    })

    expect(result.snappedY).toBe(210) // 250 - 40 = 210
    const horizGuide = result.guides.find((g) => g.orientation === 'horizontal')
    expect(horizGuide).toBeDefined()
    expect(horizGuide!.coordinate).toBe(250)
  })

  it('ignores alignments beyond snapThreshold (e.g. 15px)', () => {
    const result = computeAlignmentGuides({
      draggingNodeId: 'drag-node',
      dragRect: { x: 250, y: 50, width: 100, height: 100 },
      otherNodes: [staticNode],
      snapThreshold: 5
    })

    // Neither X nor Y are within 5px of staticNode bounds (200, 250, 300)
    // Note: dragRect centerX = 300, which aligns with staticNode right = 300!
    // Let's test with off-grid values that don't match any axes:
    const offResult = computeAlignmentGuides({
      draggingNodeId: 'drag-node',
      dragRect: { x: 137, y: 137, width: 43, height: 43 },
      otherNodes: [staticNode],
      snapThreshold: 5
    })

    expect(offResult.guides).toHaveLength(0)
    expect(offResult.snappedX).toBe(137)
    expect(offResult.snappedY).toBe(137)
  })
})
