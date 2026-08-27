import { describe, it, expect, vi, beforeEach } from 'vitest'
import { stringToColor, getNodeColor, drawNode } from '../../../../../src/renderer/src/features/Graph/graphs'

describe('graphs utils', () => {
  describe('stringToColor', () => {
    it('returns an hsl color string', () => {
      const color = stringToColor('javascript')
      expect(color).toMatch(/^hsl\(\d+, 70%, 55%\)$/)
    })

    it('returns consistent color for the same string', () => {
      expect(stringToColor('tag')).toBe(stringToColor('tag'))
    })

    it('handles empty string without throwing', () => {
      expect(() => stringToColor('')).not.toThrow()
    })

    it('produces hue in valid range', () => {
      const match = stringToColor('something').match(/^hsl\((\d+)/)
      const hue = parseInt(match[1], 10)
      expect(hue).toBeGreaterThanOrEqual(0)
      expect(hue).toBeLessThan(360)
    })
  })

  describe('getNodeColor', () => {
    it('returns white for selected snippet', () => {
      const node = { snippetId: '1', group: 'note' }
      expect(getNodeColor(node, '1')).toBe('#ffffff')
    })

    it('returns ghost color for ghost group', () => {
      const node = { group: 'ghost' }
      expect(getNodeColor(node, null)).toBe('rgba(150,150,150,0.3)')
    })

    it('returns teal for tag group', () => {
      const node = { group: 'tag' }
      expect(getNodeColor(node, null)).toBe('#14b8a6')
    })

    it('returns pink for mention group', () => {
      const node = { group: 'mention' }
      expect(getNodeColor(node, null)).toBe('#ff79c6')
    })

    it('returns dynamic color for primaryTag', () => {
      const node = { group: 'note', primaryTag: 'react' }
      expect(getNodeColor(node, null)).toBe(stringToColor('react'))
    })

    it('returns default color when no tag', () => {
      const node = { group: 'note' }
      expect(getNodeColor(node, null)).toBe('#40bafa')
      expect(getNodeColor(node, null, '#custom')).toBe('#custom')
    })
  })

  describe('drawNode', () => {
    let ctx

    beforeEach(() => {
      ctx = {
        globalAlpha: 1,
        fillStyle: '',
        font: '',
        textAlign: '',
        textBaseline: '',
        shadowColor: '',
        shadowBlur: 0,
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        fillText: vi.fn()
      }
      global.performance = { now: () => 0 }
      delete window._luminaIsDragging
      delete window._luminaNodesRenderTime
    })

    function drawWithAlphaCapture(args, prop = 'globalAlpha') {
      const seen = []
      const original = Object.getOwnPropertyDescriptor(ctx, prop)
      let value = ctx[prop]
      Object.defineProperty(ctx, prop, {
        get: () => value,
        set: (v) => {
          seen.push(v)
          value = v
        },
        configurable: true
      })
      drawNode(...args)
      if (original) Object.defineProperty(ctx, prop, original)
      return seen
    }

    const node = { id: 'Note', x: 10, y: 20, val: 2 }

    it('draws a circle for the node', () => {
      drawNode(ctx, node, 5, '#fff', false, false, false, false, false, true)
      expect(ctx.beginPath).toHaveBeenCalled()
      expect(ctx.arc).toHaveBeenCalledWith(10, 20, 5, 0, 2 * Math.PI, false)
      expect(ctx.fill).toHaveBeenCalled()
      expect(ctx.fillStyle).toBe('#fff')
    })

    it('dims the node when search-dimmed', () => {
      const seen = drawWithAlphaCapture([ctx, node, 5, '#fff', false, false, true, true, false, true])
      expect(seen).toContain(0.05)
    })

    it('dims the node when neighbor-dimmed', () => {
      // args: active=false, hovered=false, searchMatch=false, searchDimmed=false, neighborDimmed=true
      const seen = drawWithAlphaCapture([ctx, node, 5, '#fff', false, false, false, false, true, true])
      expect(seen).toContain(0.15)
    })

    it('draws label when showText and active', () => {
      drawNode(ctx, node, 5, '#fff', true, false, false, false, true, true, 2)
      expect(ctx.fillText).toHaveBeenCalledWith('Note', 10, 27)
    })

    it('strips quotes and asterisks from label', () => {
      const quoted = { id: "Note*'\"", x: 0, y: 0, val: 1 }
      drawNode(ctx, quoted, 5, '#fff', true, false, false, false, true, true, 2)
      expect(ctx.fillText).toHaveBeenCalledWith('Note', 0, 7)
    })

    it('skips label when showText is false', () => {
      drawNode(ctx, node, 5, '#fff', false, false, false, false, false, true)
      expect(ctx.fillText).not.toHaveBeenCalled()
    })

    it('accumulates render time into window._luminaNodesRenderTime', () => {
      window._luminaNodesRenderTime = 10
      drawNode(ctx, node, 5, '#fff', false, false, false, false, false, true)
      expect(window._luminaNodesRenderTime).toBe(10)
    })
  })
})
