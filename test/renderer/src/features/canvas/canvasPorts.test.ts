import { describe, it, expect } from 'vitest'
import {
  getNodePorts,
  getOptimalPortPair,
  PORT_DEFINITIONS
} from '../../../../../src/renderer/src/features/canvas/utils/canvasPorts'
import { CanvasNode } from '../../../../../src/renderer/src/features/canvas/types'

describe('canvasPorts - 8-Port Anchor Topology & Selection', () => {
  it('defines 8 ports with outward normal vectors', () => {
    expect(PORT_DEFINITIONS).toHaveLength(8)
    const portIds = PORT_DEFINITIONS.map((p) => p.id)
    expect(portIds).toEqual(['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'])

    // Check normal vectors are normalized (or near 1 length)
    PORT_DEFINITIONS.forEach((p) => {
      const len = Math.sqrt(p.normal.nx * p.normal.nx + p.normal.ny * p.normal.ny)
      expect(len).toBeCloseTo(1, 4)
    })
  })

  it('computes 8 anchor port coordinates and normals for a rectangle node', () => {
    const node: CanvasNode = {
      id: 'rect-1',
      type: 'text',
      x: 100,
      y: 100,
      width: 200,
      height: 100
    }

    const ports = getNodePorts(node)
    expect(ports).toHaveLength(8)

    // Top port (N)
    const topPort = ports.find((p) => p.side === 'top')!
    expect(topPort.x).toBe(200) // 100 + 100
    expect(topPort.y).toBe(100)
    expect(topPort.normal).toEqual({ nx: 0, ny: -1 })

    // Right port (E)
    const rightPort = ports.find((p) => p.side === 'right')!
    expect(rightPort.x).toBe(300)
    expect(rightPort.y).toBe(150)
    expect(rightPort.normal).toEqual({ nx: 1, ny: 0 })

    // Bottom port (S)
    const bottomPort = ports.find((p) => p.side === 'bottom')!
    expect(bottomPort.x).toBe(200)
    expect(bottomPort.y).toBe(200)
    expect(bottomPort.normal).toEqual({ nx: 0, ny: 1 })

    // Left port (W)
    const leftPort = ports.find((p) => p.side === 'left')!
    expect(leftPort.x).toBe(100)
    expect(leftPort.y).toBe(150)
    expect(leftPort.normal).toEqual({ nx: -1, ny: 0 })
  })

  it('computes geometric contour adjustments for circle shape', () => {
    const circleNode: CanvasNode = {
      id: 'circle-1',
      type: 'shape',
      shapeType: 'circle',
      x: 100,
      y: 100,
      width: 100,
      height: 100
    }

    const ports = getNodePorts(circleNode)
    const nePort = ports.find((p) => p.id === 'ne')!
    // For a circle of r=50 centered at (150, 150), 45deg is at ~150 + 50*cos(45) = 185.35
    expect(nePort.x).toBeCloseTo(150 + 50 * Math.cos(Math.PI / 4), 0)
    expect(nePort.y).toBeCloseTo(150 - 50 * Math.sin(Math.PI / 4), 0)
  })

  it('selects optimal facing port pairs between horizontally separated nodes', () => {
    const nodeA: CanvasNode = {
      id: 'node-a',
      type: 'text',
      x: 0,
      y: 100,
      width: 100,
      height: 100
    }
    const nodeB: CanvasNode = {
      id: 'node-b',
      type: 'text',
      x: 300,
      y: 100,
      width: 100,
      height: 100
    }

    const { fromPort, toPort } = getOptimalPortPair(nodeA, nodeB)
    expect(fromPort.side).toBe('right')
    expect(toPort.side).toBe('left')
  })

  it('selects optimal facing port pairs between vertically separated nodes', () => {
    const nodeA: CanvasNode = {
      id: 'node-a',
      type: 'text',
      x: 100,
      y: 0,
      width: 100,
      height: 100
    }
    const nodeB: CanvasNode = {
      id: 'node-b',
      type: 'text',
      x: 100,
      y: 300,
      width: 100,
      height: 100
    }

    const { fromPort, toPort } = getOptimalPortPair(nodeA, nodeB)
    expect(fromPort.side).toBe('bottom')
    expect(toPort.side).toBe('top')
  })

  it('strictly preserves fixed fromSide and toSide regardless of node positioning', () => {
    const nodeA: CanvasNode = {
      id: 'node-a',
      type: 'text',
      x: 500,
      y: 500,
      width: 100,
      height: 100
    }
    const nodeB: CanvasNode = {
      id: 'node-b',
      type: 'text',
      x: 0,
      y: 0,
      width: 100,
      height: 100
    }

    // Even if nodeA is diagonally below nodeB, user explicitly pinned top -> bottom
    const { fromPort, toPort } = getOptimalPortPair(nodeA, nodeB, 'top', 'bottom')
    expect(fromPort.side).toBe('top')
    expect(toPort.side).toBe('bottom')
    expect(fromPort.x).toBe(550)
    expect(fromPort.y).toBe(500)
    expect(toPort.x).toBe(50)
    expect(toPort.y).toBe(100)
  })

  it('computes aspect-compensated ports for actor shape with round head and centered hands', () => {
    const actorNode: CanvasNode = {
      id: 'actor-1',
      type: 'shape',
      shapeType: 'actor',
      x: 0,
      y: 0,
      width: 120,
      height: 150
    }

    const ports = getNodePorts(actorNode)
    const topPort = ports.find((p) => p.side === 'top' && p.id === 'n')!
    const leftPort = ports.find((p) => p.side === 'left')!
    const rightPort = ports.find((p) => p.side === 'right')!
    const bottomPort = ports.find((p) => p.side === 'bottom' && p.id === 's')!

    // Top port touches the crown of the round head (aspect ratio 120/150 = 0.8, headRy = 10.4, top = 18 - 10.4 = 7.6%)
    expect(topPort.x).toBe(60)
    expect(topPort.y).toBeCloseTo(11.4, 1)

    // Left and right ports land dead-center on the circular hand anchor terminals
    expect(leftPort.x).toBeCloseTo(16.8, 1)
    expect(leftPort.y).toBe(72)
    expect(rightPort.x).toBeCloseTo(103.2, 1)
    expect(rightPort.y).toBe(72)

    // Bottom port is at feet baseline (94%)
    expect(bottomPort.x).toBe(60)
    expect(bottomPort.y).toBe(141)
  })
})
