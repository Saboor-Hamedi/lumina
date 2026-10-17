import { describe, it, expect } from 'vitest'
import {
  computeMermaidFit,
  getMermaidNaturalSize,
  MERMAID_DEFAULT_MAX_ZOOM
} from '../../../../../src/renderer/src/core/mermaid/mermaidFit'

describe('computeMermaidFit', () => {
  it('returns null for unusable natural dimensions', () => {
    expect(computeMermaidFit(0, 100, 800, 400)).toBeNull()
    expect(computeMermaidFit(100, 0, 800, 400)).toBeNull()
    expect(computeMermaidFit(NaN, 100, 800, 400)).toBeNull()
  })

  it('returns null when the container has no usable width', () => {
    expect(computeMermaidFit(100, 100, 0, 400)).toBeNull()
    expect(computeMermaidFit(100, 100, -10, 400)).toBeNull()
  })

  it('scales a small flowchart up but caps at maxZoom', () => {
    const fit = computeMermaidFit(200, 100, 1000, 800)!
    expect(fit).not.toBeNull()
    // width-limited candidate = 5x, height-limited = 8x, capped at maxZoom
    expect(fit.scale).toBe(MERMAID_DEFAULT_MAX_ZOOM)
    expect(fit.width).toBe(400)
    expect(fit.height).toBe(200)
  })

  it('shrinks a wide flowchart to fit the available width', () => {
    const fit = computeMermaidFit(2000, 200, 800, 1000)!
    expect(fit.width).toBeCloseTo(800, 5)
    expect(fit.height).toBeCloseTo(80, 5)
    expect(fit.scale).toBeCloseTo(0.4, 5)
  })

  it('constrains a tall flowchart by height, not width', () => {
    const fit = computeMermaidFit(200, 2000, 1000, 400)!
    expect(fit.height).toBeCloseTo(400, 5)
    expect(fit.width).toBeCloseTo(40, 5)
    expect(fit.scale).toBeCloseTo(0.2, 5)
  })

  it('constrains a very wide diagram by width, not by the tall container', () => {
    // Wide (aspect 8:1) inside a tall container: width is the limiting axis.
    const fit = computeMermaidFit(1600, 200, 800, 2000)!
    expect(fit.width).toBeCloseTo(800, 5)
    expect(fit.height).toBeCloseTo(100, 5)
    expect(fit.scale).toBeCloseTo(0.5, 5)
  })

  it('preserves aspect ratio across all cases', () => {
    const cases = [
      [200, 100, 1000, 800],
      [2000, 200, 800, 1000],
      [200, 2000, 1000, 400],
      [640, 480, 320, 240],
      [50, 50, 5000, 5000]
    ]
    for (const [nw, nh, aw, ah] of cases) {
      const fit = computeMermaidFit(nw, nh, aw, ah)!
      expect(fit.width / fit.height).toBeCloseTo(nw / nh, 5)
    }
  })

  it('never overflows the available box (except below minZoom)', () => {
    const cases = [
      [200, 100, 1000, 800],
      [2000, 200, 800, 1000],
      [200, 2000, 1000, 400],
      [1200, 900, 1200, 900]
    ]
    for (const [nw, nh, aw, ah] of cases) {
      const fit = computeMermaidFit(nw, nh, aw, ah)!
      expect(fit.width).toBeLessThanOrEqual(aw + 0.001)
      expect(fit.height).toBeLessThanOrEqual(ah + 0.001)
    }
  })

  it('honours an explicit minZoom floor for tiny containers', () => {
    const fit = computeMermaidFit(1000, 1000, 1, 1, 2, 0.1)!
    expect(fit.scale).toBe(0.1)
    expect(fit.width).toBeCloseTo(100, 5)
  })

  it('falls back to a width-only fit when no height is available', () => {
    const fit = computeMermaidFit(400, 200, 800, 0)!
    expect(fit.scale).toBe(2)
    expect(fit.width).toBe(800)
    expect(fit.height).toBe(400)
  })
})

describe('getMermaidNaturalSize', () => {
  it('returns null for a missing element', () => {
    expect(getMermaidNaturalSize(null)).toBeNull()
  })

  it('reads the viewBox when present', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 640 480')
    // jsdom reflects width/height=100% by default and has no baseVal; fall back to attrs
    svg.setAttribute('width', '640')
    svg.setAttribute('height', '480')
    const size = getMermaidNaturalSize(svg as unknown as SVGSVGElement)
    expect(size).toEqual({ width: 640, height: 480 })
  })

  it('falls back to width/height attributes when there is no viewBox', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', '320')
    svg.setAttribute('height', '240')
    const size = getMermaidNaturalSize(svg as unknown as SVGSVGElement)
    expect(size).toEqual({ width: 320, height: 240 })
  })

  it('returns null when neither viewBox nor attributes are usable', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    expect(getMermaidNaturalSize(svg as unknown as SVGSVGElement)).toBeNull()
  })
})
