import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  compileCanvasDiagramSpec,
  MAX_AI_CANVAS_EDGES,
  MAX_AI_CANVAS_NODES
} from '../canvasDiagramCompiler'
import type { CanvasNode } from '../../types'

function boxesOverlap(a: CanvasNode, b: CanvasNode): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

describe('Lumina Native Canvas AI Diagram Compiler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('compiles a TB flowchart into native CanvasData with zero overlapping shapes and smart edges', () => {
    const data = compileCanvasDiagramSpec({
      title: 'RAG Pipeline',
      layout: 'flowchart',
      direction: 'TB',
      nodes: [
        { id: 'q', label: 'User Query', shape: 'pill', color: 'blue' },
        { id: 'fts', label: 'SQLite FTS5', shape: 'cylinder', color: 'cyan' },
        { id: 'vec', label: 'MiniLM Vectors', shape: 'server', color: 'purple' },
        { id: 'rrf', label: 'RRF Fusion', shape: 'diamond', color: 'orange' },
        { id: 'ans', label: 'Page-Cited Answer', shape: 'rounded-rectangle', color: 'green' }
      ],
      edges: [
        { from: 'q', to: 'fts', label: 'keywords' },
        { from: 'q', to: 'vec', label: 'embedding' },
        { from: 'fts', to: 'rrf' },
        { from: 'vec', to: 'rrf' },
        { from: 'rrf', to: 'ans', label: 'top chunks' }
      ]
    })

    // 1 title + 5 shapes
    expect(data.nodes).toHaveLength(6)
    expect(data.edges).toHaveLength(5)
    expect(data.strokes).toEqual([])
    expect(data.viewport?.zoom).toBeGreaterThanOrEqual(0.45)
    expect(data.viewport?.zoom).toBeLessThanOrEqual(1)

    // Title node uses frameless 22px native typography
    const titleNode = data.nodes[0]
    expect(titleNode.type).toBe('text')
    expect(titleNode.fontSize).toBe(22)
    expect(titleNode.text).toBe('RAG Pipeline')

    // All diagram shapes are non-overlapping and have integer coordinates
    const shapeNodes = data.nodes.slice(1)
    for (let i = 0; i < shapeNodes.length; i++) {
      expect(Number.isInteger(shapeNodes[i].x)).toBe(true)
      expect(Number.isInteger(shapeNodes[i].y)).toBe(true)
      for (let j = i + 1; j < shapeNodes.length; j++) {
        expect(boxesOverlap(shapeNodes[i], shapeNodes[j])).toBe(false)
      }
    }

    // All edges use native smart routing and point to real canvas node IDs
    const idSet = new Set(data.nodes.map((n) => n.id))
    for (const edge of data.edges) {
      expect(edge.routing).toBe('smart')
      expect(edge.toEnd).toBe('arrow')
      expect(idSet.has(edge.fromNode)).toBe(true)
      expect(idSet.has(edge.toNode)).toBe(true)
    }
  })

  it('auto-sizes flat frame groups behind member nodes in LR architecture diagrams', () => {
    const data = compileCanvasDiagramSpec({
      layout: 'architecture',
      direction: 'LR',
      groups: [
        { id: 'g1', label: 'Storage Layer', color: 'cyan', nodeIds: ['db', 'cache'] }
      ],
      nodes: [
        { id: 'api', label: 'API Gateway', shape: 'server' },
        { id: 'db', label: 'SQLite', shape: 'cylinder' },
        { id: 'cache', label: 'LRU Cache', shape: 'hexagon' }
      ],
      edges: [
        { from: 'api', to: 'db' },
        { from: 'api', to: 'cache', strokeDash: 'dashed' }
      ]
    })

    const frame = data.nodes.find((n) => n.shape === 'frame')
    expect(frame).toBeDefined()
    expect(frame!.text).toBe('Storage Layer')
    // Frame appears before its member nodes in DOM order so it stays behind them while remaining selectable
    expect(data.nodes.indexOf(frame!)).toBeLessThan(
      data.nodes.findIndex((n) => n.text === 'SQLite')
    )

    const db = data.nodes.find((n) => n.text === 'SQLite')!
    const cache = data.nodes.find((n) => n.text === 'LRU Cache')!
    expect(frame!.x).toBeLessThan(db.x)
    expect(frame!.y).toBeLessThan(Math.min(db.y, cache.y))
    expect(frame!.x + frame!.width).toBeGreaterThan(Math.max(db.x + db.width, cache.x + cache.width))
    expect(frame!.y + frame!.height).toBeGreaterThan(Math.max(db.y + db.height, cache.y + cache.height))

    // Architecture defaults to 'step' lineStyle
    expect(data.edges[0].lineStyle).toBe('step')
    expect(data.edges[1].strokeDash).toBe('dashed')
  })

  it('sanitizes invalid shapes/colors and enforces performance node & edge caps', () => {
    const manyNodes = Array.from({ length: 85 }, (_, i) => ({
      id: `n${i}`,
      label: `Node ${i}`,
      shape: 'nonexistent-shape' as any,
      color: 'neon-ultraviolet' as any
    }))
    const manyEdges = Array.from({ length: 140 }, (_, i) => ({
      from: `n${i % 50}`,
      to: `n${(i + 1) % 50}`
    }))

    const data = compileCanvasDiagramSpec({
      layout: 'mindmap',
      nodes: manyNodes,
      edges: manyEdges
    })

    expect(data.nodes.length).toBeLessThanOrEqual(MAX_AI_CANVAS_NODES)
    expect(data.edges.length).toBeLessThanOrEqual(MAX_AI_CANVAS_EDGES)
    expect(data.nodes[0].shape).toBe('rounded-rectangle')
    expect(['default', 'red', 'orange', 'yellow', 'green', 'cyan', 'purple', 'blue', 'pink']).toContain(
      data.nodes[0].color
    )
  })
})
