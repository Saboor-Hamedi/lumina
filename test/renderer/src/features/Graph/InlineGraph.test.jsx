import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react-force-graph-2d', () => {
  const ForceGraph2D = () => <div data-testid="force-graph-2d" />
  return { default: ForceGraph2D }
})

vi.mock('d3-force', () => ({
  forceManyBody: () => ({ strength: vi.fn(() => ({ distanceMax: vi.fn() })) }),
  forceCollide: () => ({ strength: vi.fn() }),
  forceX: () => ({ strength: vi.fn() }),
  forceY: () => ({ strength: vi.fn() }),
  forceCenter: () => ({})
}))

vi.mock('../../../../../src/renderer/src/features/Graph/PerformancePanel', () => ({
  default: () => <div data-testid="perf-panel" />
}))

vi.mock('../../../../../src/renderer/src/features/Graph/GraphMiniMap', () => ({
  default: () => <div data-testid="minimap" />
}))

import { render, screen, act } from '@testing-library/react'
import InlineGraph from '../../../../../src/renderer/src/features/Graph/InlineGraph'
import { useVaultStore } from '../../../../../src/renderer/src/core/store/useVaultStore'
import { useSettingsStore } from '../../../../../src/renderer/src/core/store/useSettingsStore'

describe('InlineGraph', () => {
  let resizeCallback

  beforeEach(() => {
    vi.clearAllMocks()
    resizeCallback = undefined
    global.ResizeObserver = class {
      constructor(cb) {
        resizeCallback = cb
      }
      observe() {}
      disconnect() {}
    }
    useVaultStore.setState({ snippets: [] })
    useSettingsStore.setState({
      settings: { graphTheme: 'default', graphNodeSize: 1.5, graphShowTexts: true }
    })
    global.performance = { now: () => 0 }
  })

  it('renders the graph container', () => {
    const { container } = render(<InlineGraph focusNodeId="1" onNavigate={vi.fn()} />)
    expect(container.querySelector('.inline-graph-container')).toBeInTheDocument()
  })

  it('renders ForceGraph2D once dimensions are set', async () => {
    render(<InlineGraph focusNodeId="1" onNavigate={vi.fn()} />)

    // Simulate ResizeObserver firing with a width
    act(() => {
      resizeCallback?.([{ contentRect: { width: 400 } }])
    })

    expect(screen.getByTestId('force-graph-2d')).toBeInTheDocument()
  })

  it('does not crash with empty snippets', async () => {
    render(<InlineGraph focusNodeId="1" onNavigate={vi.fn()} />)
    act(() => {
      resizeCallback?.([{ contentRect: { width: 400 } }])
    })
    expect(screen.getByTestId('force-graph-2d')).toBeInTheDocument()
  })

  it('renders minimap and performance panel', async () => {
    render(<InlineGraph focusNodeId="1" onNavigate={vi.fn()} />)
    act(() => {
      resizeCallback?.([{ contentRect: { width: 400 } }])
    })
    expect(screen.getByTestId('minimap')).toBeInTheDocument()
    expect(screen.getByTestId('perf-panel')).toBeInTheDocument()
  })
})
