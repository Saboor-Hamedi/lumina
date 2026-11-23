import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import PerformancePanel from '../../../../../src/renderer/src/features/graph/PerformancePanel'
import { usePerformanceStore } from '../../../../../src/renderer/src/features/graph/usePerformanceStore'

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

  it('renders fps, frame time and counts', () => {
    render(<PerformancePanel />)
    runFrame()
    expect(screen.getByText('FPS: 60.0')).toBeInTheDocument()
    expect(screen.getByText('16.0ms')).toBeInTheDocument()
    expect(screen.getByText('N: 100 | L: 200')).toBeInTheDocument()
  })

  it('shows GPU indicator in 3D mode', () => {
    render(<PerformancePanel is3DMode />)
    runFrame()
    expect(screen.getByText('[GPU]')).toBeInTheDocument()
  })

  it('renders embedded sidebar metrics without recenter button', () => {
    render(<PerformancePanel embedded={true} is3DMode={true} />)
    runFrame()
    expect(screen.getByText('60 FPS')).toBeInTheDocument()
    expect(screen.getByText('GPU')).toBeInTheDocument()
    expect(screen.queryByTitle('Recenter Graph')).toBeNull()
  })

  it('does not render recenter button in floating mode', () => {
    render(<PerformancePanel />)
    runFrame()
    expect(screen.queryByTitle('Recenter Graph')).toBeNull()
  })
})
