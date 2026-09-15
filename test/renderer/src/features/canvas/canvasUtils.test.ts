import { describe, it, expect } from 'vitest'
import {
  findClosestPort,
  getNodePortCoord,
  getBezierCurve,
  getDragBezierCurve,
  COLOR_CYCLE,
  CANVAS_NODE_COLOR_HEX
} from '../../../../../src/renderer/src/features/canvas/utils'
import { CanvasNode } from '../../../../../src/renderer/src/features/canvas/types'

describe('canvasUtils - Magnetic Proximity & Colors', () => {
  it('defines hex colors for all node color cycle entries', () => {
    COLOR_CYCLE.forEach((color) => {
      expect(CANVAS_NODE_COLOR_HEX[color]).toBeDefined()
      expect(CANVAS_NODE_COLOR_HEX[color]).toMatch(/^#[0-9a-fA-F]{6}$/)
    })
  })

  it('correctly calculates port coordinates for a node', () => {
    const node: CanvasNode = {
      id: 'node-test',
      type: 'text',
      x: 100,
      y: 100,
      width: 200,
      height: 100
    }

    expect(getNodePortCoord(node, 'top')).toEqual({ x: 200, y: 100 })
    expect(getNodePortCoord(node, 'bottom')).toEqual({ x: 200, y: 200 })
    expect(getNodePortCoord(node, 'left')).toEqual({ x: 100, y: 150 })
    expect(getNodePortCoord(node, 'right')).toEqual({ x: 300, y: 150 })
  })

  it('finds the closest port within magnetic snap threshold', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'node-1',
        type: 'text',
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        color: 'yellow'
      },
      {
        id: 'node-2',
        type: 'text',
        x: 400,
        y: 200,
        width: 200,
        height: 100,
        color: 'purple'
      }
    ]

    // Near node-2's left port (which is at x: 400, y: 250)
    // Distance from (390, 252) to (400, 250) is ~10.2px (well within 42px)
    const snap = findClosestPort({ x: 390, y: 252 }, nodes, 'node-1', 42)

    expect(snap).not.toBeNull()
    expect(snap?.nodeId).toBe('node-2')
    expect(snap?.side).toBe('left')
    expect(snap?.color).toBe('purple')
    expect(snap?.x).toBe(400)
    expect(snap?.y).toBe(250)
  })

  it('ignores ports on the source node (excludeNodeId)', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'node-source',
        type: 'text',
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        color: 'cyan'
      }
    ]

    // Cursor is right on node-source's right port (300, 150)
    const snap = findClosestPort({ x: 300, y: 150 }, nodes, 'node-source', 42)
    expect(snap).toBeNull()
  })

  it('returns null when cursor is beyond magnetic threshold', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'node-target',
        type: 'text',
        x: 500,
        y: 500,
        width: 200,
        height: 100,
        color: 'green'
      }
    ]

    // Distance from (100, 100) to node-target's closest port is > 400px
    const snap = findClosestPort({ x: 100, y: 100 }, nodes, 'node-source', 42)
    expect(snap).toBeNull()
  })

  it('generates valid Bézier curves with direction offsets', () => {
    const curve = getBezierCurve({ x: 100, y: 100 }, 'right', { x: 300, y: 100 }, 'left')
    expect(curve.pathD).toMatch(/^M 100 100 C/)
    expect(curve.midX).toBe(200)
    expect(curve.midY).toBe(100)
  })

  it('generates straight drag curves without curved heads at cursor', () => {
    const dragCurve = getDragBezierCurve({ x: 100, y: 100 }, 'right', { x: 250, y: 180 })
    expect(dragCurve.pathD).toMatch(/^M 100 100 C/)
    expect(dragCurve.pathD).toContain('250 180')
  })
})
