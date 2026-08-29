import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GraphMiniMap from '../../../../../src/renderer/src/features/Graph/GraphMiniMap'

describe('GraphMiniMap', () => {
  let rafId = 0

  beforeEach(() => {
    vi.clearAllMocks()
    global.requestAnimationFrame = vi.fn(() => ++rafId)
    global.cancelAnimationFrame = vi.fn()
    global.clearTimeout = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mockCanvas() {
    const ctx = {
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      strokeRect: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1
    }
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx)
    return ctx
  }

  it('renders a canvas and recenter button', () => {
    mockCanvas()
    const graphRef = { current: { zoomToFit: vi.fn() } }
    render(
      <GraphMiniMap
        graphRef={graphRef}
        graphData={{ nodes: [], links: [] }}
        mainWidth={800}
        mainHeight={600}
      />
    )
    expect(document.querySelector('canvas')).toBeInTheDocument()
    expect(screen.getByTitle('Recenter Graph')).toBeInTheDocument()
  })

  it('calls zoomToFit on recenter click', () => {
    mockCanvas()
    const zoomToFit = vi.fn()
    const graphRef = { current: { zoomToFit } }
    render(
      <GraphMiniMap
        graphRef={graphRef}
        graphData={{ nodes: [], links: [] }}
        mainWidth={800}
        mainHeight={600}
      />
    )
    fireEvent.click(screen.getByTitle('Recenter Graph'))
    expect(zoomToFit).toHaveBeenCalledWith(800, 100)
  })

  it('does not crash when graphRef has no current', () => {
    mockCanvas()
    render(
      <GraphMiniMap
        graphRef={{}}
        graphData={{ nodes: [], links: [] }}
        mainWidth={800}
        mainHeight={600}
      />
    )
    expect(document.querySelector('canvas')).toBeInTheDocument()
  })
})
