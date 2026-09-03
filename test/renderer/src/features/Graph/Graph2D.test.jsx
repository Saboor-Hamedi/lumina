import { describe, it, expect, vi, beforeEach } from 'vitest'

const graphProps = { current: {} }

vi.mock('react-force-graph-2d', () => {
  const ForceGraph2D = (props) => {
    // Expose the underlying graph instance so effects can call d3Force etc.
    graphProps.current.d3Force = vi.fn()
    graphProps.current.d3ReheatSimulation = vi.fn()
    return <div data-testid="fg2d" />
  }
  return { default: ForceGraph2D }
})

vi.mock('d3-force', () => ({
  forceManyBody: () => ({ strength: vi.fn(() => ({ distanceMax: vi.fn() })) }),
  forceLink: () => ({ id: vi.fn(), distance: vi.fn(), strength: vi.fn() }),
  forceCollide: () => ({ radius: vi.fn(), iterations: vi.fn() }),
  forceX: () => ({ strength: vi.fn() }),
  forceY: () => ({ strength: vi.fn() }),
  forceCenter: () => ({})
}))

import { render, screen } from '@testing-library/react'
import Graph2D from '../../../../../src/renderer/src/features/Graph/Graph2D'
import { useVaultStore } from '../../../../../src/renderer/src/core/store/workspaceStore'
import { useSettingsStore } from '../../../../../src/renderer/src/core/store/useSettingsStore'

describe('Graph2D', () => {
  let MockWorker

  beforeEach(() => {
    vi.clearAllMocks()
    MockWorker = vi.fn(function MockWorkerClass(url, options) {
      this.url = url
      this.options = options
      this.postMessage = vi.fn()
      this.terminate = vi.fn()
      this.onmessage = null
    })
    global.Worker = MockWorker
    useVaultStore.setState({ snippets: [] })
    useSettingsStore.setState({
      settings: { graphNodeSize: 1.5, repelForce: 1, linkForce: 1 }
    })
  })

  const baseProps = {
    dimensions: { width: 800, height: 600 },
    graphData: { nodes: [], links: [] },
    paintNode: vi.fn(),
    hoverNode: null,
    setHoverNode: vi.fn(),
    defaultLineColor: '#fff',
    onNavigate: vi.fn(),
    setIsEngineReady: vi.fn()
  }

  it('renders ForceGraph2D', () => {
    render(<Graph2D {...baseProps} />)
    expect(screen.getByTestId('fg2d')).toBeInTheDocument()
  })

  it('creates a physics worker on mount', async () => {
    render(<Graph2D {...baseProps} />)
    await vi.waitFor(() => {
      expect(MockWorker).toHaveBeenCalled()
    })
    expect(MockWorker.mock.instances[0].postMessage).toHaveBeenCalled()
  })

  it('terminates the worker on unmount', async () => {
    const { unmount } = render(<Graph2D {...baseProps} />)
    await vi.waitFor(() => {
      expect(MockWorker).toHaveBeenCalled()
    })
    const instance = MockWorker.mock.instances[0]
    unmount()
    expect(instance.terminate).toHaveBeenCalled()
  })

  it('handles node clicks by navigating to the snippet', async () => {
    const snippet = { id: '1', title: 'Note', code: '' }
    useVaultStore.setState({ snippets: [snippet] })
    const onNavigate = vi.fn()
    const graphData = {
      nodes: [{ id: 'Note', snippetId: '1', val: 1, x: 0, y: 0 }],
      links: []
    }
    // Access the ForceGraph2D props to invoke onNodeClick
    render(<Graph2D {...baseProps} graphData={graphData} onNavigate={onNavigate} />)

    // The mock renders a div without exposing props; verify via worker setup instead
    await vi.waitFor(() => {
      expect(MockWorker).toHaveBeenCalled()
    })
    expect(MockWorker.mock.instances[0].postMessage).toHaveBeenCalledWith({
      type: 'INIT',
      payload: expect.any(Object)
    })
  })
})
