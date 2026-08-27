import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import PerformancePanel from '../../../../../src/renderer/src/features/Graph/PerformancePanel'
import { usePerformanceStore } from '../../../../../src/renderer/src/features/Graph/usePerformanceStore'

describe('PerformancePanel', () => {
  let rafId = 0
  let rafCb

  beforeEach(() => {
    vi.clearAllMocks()
    usePerformanceStore.setState({
      metrics: {
        fps: 60,
        frameTime: 16,
        nodesRenderTime: 5,
        linksRenderTime: 8,
        nodeCount: 100,
        linkCount: 200,
        isDragging: false,
        hoveredNodeId: null
      }
    })
    rafCb = undefined
    global.requestAnimationFrame = vi.fn((cb) => {
      rafId++
      rafCb = cb
      return rafId
    })
    global.cancelAnimationFrame = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Drive one rAF frame so the panel picks up metrics from the store
  function runFrame() {
    act(() => {
      if (rafCb) rafCb(600)
    })
  }

  it('renders nothing when no metrics yet', () => {
    usePerformanceStore.setState({
      metrics: {
        fps: 0,
        frameTime: 0,
        nodesRenderTime: 0,
        linksRenderTime: 0,
        nodeCount: 0,
        linkCount: 0,
        isDragging: false,
        hoveredNodeId: null
      }
    })
    const { container } = render(<PerformancePanel />)
    expect(container.firstChild).toBeNull()
  })

  it('renders compact metrics', () => {
    render(<PerformancePanel compact />)
    runFrame()
    expect(screen.getByText(/FPS: 60\.0/)).toBeInTheDocument()
    expect(screen.getByText(/Frame: 16\.0ms/)).toBeInTheDocument()
    expect(screen.getByText(/N: 100 \| L: 200/)).toBeInTheDocument()
  })

  it('shows GPU indicator in 3D mode', () => {
    render(<PerformancePanel compact is3DMode />)
    runFrame()
    expect(screen.getByText('[GPU]')).toBeInTheDocument()
  })

  it('renders full panel with node/link render times', () => {
    render(<PerformancePanel />)
    runFrame()
    expect(screen.getByText('PERFORMANCE')).toBeInTheDocument()
    expect(screen.getByText(/Links: 8\.0 ms/)).toBeInTheDocument()
    expect(screen.getByText(/Nodes: 5\.0 ms/)).toBeInTheDocument()
    expect(screen.getByText('Nodes: 100')).toBeInTheDocument()
    expect(screen.getByText('Links: 200')).toBeInTheDocument()
  })

  it('shows DRAGGING state when dragging', () => {
    usePerformanceStore.setState({
      metrics: {
        fps: 60,
        frameTime: 16,
        nodesRenderTime: 5,
        linksRenderTime: 8,
        nodeCount: 100,
        linkCount: 200,
        isDragging: true,
        hoveredNodeId: null
      }
    })
    render(<PerformancePanel />)
    runFrame()
    expect(screen.getByText('DRAGGING')).toBeInTheDocument()
  })

  it('shows GPU Accelerated text in 3D full panel', () => {
    render(<PerformancePanel is3DMode />)
    runFrame()
    expect(screen.getByText('GPU Accelerated')).toBeInTheDocument()
  })
})
