import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  buildCanvasSvg,
  getExportThemeColors,
  getCanvasBoundingBox
} from '../../../../../src/renderer/src/features/canvas/utils/canvasExport'
import { CanvasNode, CanvasEdge } from '../../../../../src/renderer/src/features/canvas/types'

describe('canvasExport - Dynamic Theme-Aware SVG Generation', () => {
  const sampleNodes: CanvasNode[] = [
    {
      id: 'n1',
      type: 'text',
      title: 'Brainstorm Idea',
      text: 'Detailed description of project idea',
      x: 100,
      y: 100,
      width: 220,
      height: 120,
      color: 'purple'
    },
    {
      id: 'n2',
      type: 'shape',
      shape: 'diamond',
      text: 'Decision Point',
      x: 400,
      y: 100,
      width: 140,
      height: 100,
      color: 'cyan'
    }
  ]

  const sampleEdges: CanvasEdge[] = [
    {
      id: 'e1',
      fromNode: 'n1',
      toNode: 'n2',
      color: 'purple'
    }
  ]

  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.cssText = ''
  })

  afterEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.cssText = ''
  })

  it('computes accurate bounding box for nodes with padding', () => {
    const bbox = getCanvasBoundingBox(sampleNodes, 40)
    expect(bbox.minX).toBe(100 - 40)
    expect(bbox.minY).toBe(100 - 40)
    expect(bbox.maxX).toBe(540 + 40)
    expect(bbox.maxY).toBe(220 + 40)
    expect(bbox.width).toBe(520)
    expect(bbox.height).toBe(120 + 80)
  })

  it('exports with dark theme defaults when no theme variables are set', () => {
    const { svgString, width, height } = buildCanvasSvg({
      nodes: sampleNodes,
      edges: sampleEdges
    })

    expect(width).toBeGreaterThan(0)
    expect(height).toBeGreaterThan(0)
    expect(svgString).toContain('<svg')
    expect(svgString).toContain('fill="#0c0d10"')
    expect(svgString).toContain('Brainstorm Idea')
    expect(svgString).toContain('Decision Point')
  })

  it('dynamically uses light theme colors (e.g. Rosé Pine Dawn) when active', () => {
    // Simulate Rosé Pine Dawn theme active on documentElement
    document.documentElement.style.setProperty('--bg-app', '#faf4ed')
    document.documentElement.style.setProperty('--bg-card', '#fffaf3')
    document.documentElement.style.setProperty('--text-main', '#575279')
    document.documentElement.style.setProperty('--text-muted', '#797593')
    document.documentElement.style.setProperty('--border-subtle', '#dfdad9')
    document.documentElement.style.setProperty('--border-dim', '#f2e9e1')

    const colors = getExportThemeColors()
    expect(colors.bgApp).toBe('#faf4ed')
    expect(colors.bgCard).toBe('#fffaf3')
    expect(colors.textMain).toBe('#575279')

    const { svgString } = buildCanvasSvg({
      nodes: sampleNodes,
      edges: sampleEdges
    })

    // SVG background should match Rosé Pine Dawn app background
    expect(svgString).toContain('fill="#faf4ed"')
    // Card background should match Rosé Pine Dawn card background
    expect(svgString).toContain('fill="#fffaf3"')
    // Card border should match Rosé Pine Dawn subtle border
    expect(svgString).toContain('stroke="#dfdad9"')
    // Title text and shape text should match Rosé Pine Dawn textMain
    expect(svgString).toContain('fill="#575279"')
    // Content body text should match textMuted
    expect(svgString).toContain('fill="#797593"')
  })

  it('respects persisted lumina_active_theme_colors from localStorage', () => {
    localStorage.setItem(
      'lumina_active_theme_colors',
      JSON.stringify({
        '--bg-app': '#f8f6f2',
        '--bg-card': '#fdfcfa',
        '--text-main': '#2c2a26',
        '--text-muted': '#6b6862',
        '--border-subtle': '#d8d4cc',
        '--border-dim': '#e8e4dc'
      })
    )

    const colors = getExportThemeColors()
    expect(colors.bgApp).toBe('#f8f6f2')
    expect(colors.textMain).toBe('#2c2a26')

    const { svgString } = buildCanvasSvg({
      nodes: sampleNodes,
      edges: sampleEdges
    })

    expect(svgString).toContain('fill="#f8f6f2"')
    expect(svgString).toContain('fill="#2c2a26"')
  })

  it('supports transparent background export when requested', () => {
    const { svgString } = buildCanvasSvg({
      nodes: sampleNodes,
      edges: sampleEdges,
      backgroundColor: 'transparent'
    })

    // Should NOT have a background rect covering the whole SVG
    expect(svgString).not.toMatch(/<rect[^>]+fill="transparent"/)
    expect(svgString).not.toMatch(/<rect[^>]+fill="#0c0d10"/)
  })

  it('supports selection-only export', () => {
    const { svgString } = buildCanvasSvg({
      nodes: sampleNodes,
      edges: sampleEdges,
      selectedNodeIds: ['n1']
    })

    // Should contain n1 but NOT n2
    expect(svgString).toContain('Brainstorm Idea')
    expect(svgString).not.toContain('Decision Point')
  })
})
