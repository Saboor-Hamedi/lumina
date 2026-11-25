import { describe, it, expect } from 'vitest'
import {
  buildSmoothStrokePath,
  simplifyStrokePoints,
  isPointNearStroke
} from '../../../../../src/renderer/src/features/canvas/utils/canvasStroke'
import { CanvasStroke } from '../../../../../src/renderer/src/features/canvas/types'

describe('canvasStroke utilities', () => {
  it('returns empty string for empty points and valid SVG path for 1, 2, or many points', () => {
    expect(buildSmoothStrokePath([])).toBe('')
    expect(buildSmoothStrokePath([{ x: 10, y: 20 }])).toContain('M 10.0 20.0')
    expect(buildSmoothStrokePath([{ x: 0, y: 0 }, { x: 10, y: 10 }])).toBe('M 0.0 0.0 L 10.0 10.0')

    const smooth = buildSmoothStrokePath([
      { x: 0, y: 0 },
      { x: 10, y: 20 },
      { x: 30, y: 25 },
      { x: 50, y: 10 }
    ])
    expect(smooth).toContain('M 0.0 0.0')
    expect(smooth).toContain('Q 10.0 20.0')
    expect(smooth).toContain('L 50.0 10.0')
  })

  it('simplifies dense micro-jitter points while preserving start and end', () => {
    const raw = [
      { x: 0, y: 0 },
      { x: 0.3, y: 0.2 },
      { x: 0.6, y: 0.4 },
      { x: 10, y: 10 },
      { x: 10.2, y: 10.1 },
      { x: 25, y: 30 }
    ]
    const simplified = simplifyStrokePoints(raw, 2)
    expect(simplified.length).toBe(3)
    expect(simplified[0]).toEqual({ x: 0, y: 0 })
    expect(simplified[simplified.length - 1]).toEqual({ x: 25, y: 30 })
  })

  it('accurately hit-tests eraser proximity against a stroke', () => {
    const stroke: CanvasStroke = {
      id: 'stroke-1',
      color: 'blue',
      strokeWidth: 4,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      ]
    }
    expect(isPointNearStroke(stroke, 50, 5, 12)).toBe(true)
    expect(isPointNearStroke(stroke, 50, 40, 12)).toBe(false)
    expect(isPointNearStroke(stroke, 150, 0, 12)).toBe(false)
  })
})
