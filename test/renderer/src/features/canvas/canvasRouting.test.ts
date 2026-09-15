import { describe, it, expect } from 'vitest'
import {
  generateEdgePath,
  applyEndpointInset,
  applyParallelFanOut
} from '../../../../../src/renderer/src/features/canvas/utils/canvasRouting'
import { PortInfo } from '../../../../../src/renderer/src/features/canvas/utils/canvasPorts'

describe('canvasRouting - Direction-aware Bézier, Manhattan Orthogonal & Fan-Out', () => {
  const fromPort: PortInfo = {
    side: 'right',
    x: 100,
    y: 100,
    normal: { nx: 1, ny: 0 }
  }

  const toPort: PortInfo = {
    side: 'left',
    x: 300,
    y: 100,
    normal: { nx: -1, ny: 0 }
  }

  it('generates direction-aware cubic bezier curves (M ... C ...)', () => {
    const result = generateEdgePath({
      fromPort,
      toPort,
      routingMode: 'curved'
    })

    expect(result.path).toMatch(/^M\s*[\d.]+\s*[\d.]+\s*C/)
    expect(result.centerPoint).toBeDefined()
    expect(typeof result.centerPoint.x).toBe('number')
    expect(typeof result.centerPoint.y).toBe('number')
  })

  it('generates orthogonal Manhattan paths with rounded fillets and right angles', () => {
    const vFromPort: PortInfo = {
      side: 'bottom',
      x: 100,
      y: 100,
      normal: { nx: 0, ny: 1 }
    }
    const vToPort: PortInfo = {
      side: 'left',
      x: 300,
      y: 200,
      normal: { nx: -1, ny: 0 }
    }

    const result = generateEdgePath({
      fromPort: vFromPort,
      toPort: vToPort,
      routingMode: 'orthogonal',
      snapToGrid: true
    })

    expect(result.path).toContain('M')
    expect(result.path).toContain('L')
    // Check quadratic rounded fillets command 'Q' is used for corners
    expect(result.path).toContain('Q')
  })

  it('generates straight direct paths (M ... L ...)', () => {
    const result = generateEdgePath({
      fromPort,
      toPort,
      routingMode: 'straight'
    })

    expect(result.path).toMatch(/^M\s*[\d.]+\s*[\d.]+\s*L\s*[\d.]+\s*[\d.]+$/)
  })

  it('applies 6px endpoint insets outside node boundary', () => {
    const inset = applyEndpointInset(fromPort, toPort, 6)
    // fromPort moves along normal (1, 0) by 6px -> x becomes 106
    expect(inset.start.x).toBe(106)
    expect(inset.start.y).toBe(100)

    // toPort moves along normal (-1, 0) by 6px -> x becomes 294
    expect(inset.end.x).toBe(294)
    expect(inset.end.y).toBe(100)
  })

  it('applies parallel edge fan-out with perpendicular offsets', () => {
    const p1 = { x: 100, y: 100 }
    const p2 = { x: 300, y: 100 }

    // When totalParallel = 2:
    // edge 0 is offset upward, edge 1 is offset downward
    const fanned0 = applyParallelFanOut(p1, p2, 0, 2, 12)
    const fanned1 = applyParallelFanOut(p1, p2, 1, 2, 12)

    // For horizontal line (100, 100) to (300, 100), perpendicular unit normal is (0, -1)
    expect(fanned0.start.y).not.toEqual(fanned1.start.y)
    expect(Math.abs(fanned0.start.y - fanned1.start.y)).toBeCloseTo(12, 1)
  })
})
