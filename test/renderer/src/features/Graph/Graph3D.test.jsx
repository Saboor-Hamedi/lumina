import { describe, it, expect, vi, beforeEach } from 'vitest'

const graphProps = { current: {} }

vi.mock('react-force-graph-3d', () => {
  const ForceGraph3D = (props) => {
    graphProps.current.d3Force = vi.fn()
    graphProps.current.cameraPosition = vi.fn()
    graphProps.current.centerAt = vi.fn()
    graphProps.current.zoom = vi.fn()
    return <div data-testid="fg3d" />
  }
  return { default: ForceGraph3D }
})

vi.mock('d3-force', () => ({
  forceManyBody: () => ({ strength: vi.fn(() => ({ distanceMax: vi.fn() })) }),
  forceX: () => ({ strength: vi.fn() }),
  forceY: () => ({ strength: vi.fn() }),
  forceCenter: () => ({})
}))

vi.mock('d3-force-3d', () => ({
  forceCollide: () => ({ strength: vi.fn(), radius: vi.fn() })
}))

import { render, screen } from '@testing-library/react'
import Graph3D from '../../../../../src/renderer/src/features/Graph/Graph3D'
import { useSettingsStore } from '../../../../../src/renderer/src/core/store/useSettingsStore'

describe('Graph3D', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSettingsStore.setState({
      settings: { graphNodeSize: 1.5, graphCenterForce: 0.05, graphRepelForce: 0.3, graphLinkForce: 0.05 }
    })
  })

  it('renders ForceGraph3D', () => {
    render(<Graph3D graphData={{ nodes: [], links: [] }} />)
    expect(screen.getByTestId('fg3d')).toBeInTheDocument()
  })

  it('renders with nodes and links without crashing', () => {
    render(
      <Graph3D
        graphData={{
          nodes: [{ id: 'A', val: 1, x: 0, y: 0, z: 0 }],
          links: []
        }}
      />
    )
    expect(screen.getByTestId('fg3d')).toBeInTheDocument()
  })
})
