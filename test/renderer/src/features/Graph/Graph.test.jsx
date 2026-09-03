import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react-force-graph-2d', () => {
  const ForceGraph2D = () => <div data-testid="fg2d" />
  return { default: ForceGraph2D }
})

vi.mock('react-force-graph-3d', () => {
  const ForceGraph3D = () => <div data-testid="fg3d" />
  return { default: ForceGraph3D }
})

vi.mock('d3-force', () => ({
  forceRadial: () => ({ strength: vi.fn(), radius: vi.fn() }),
  forceManyBody: () => ({ strength: vi.fn(() => ({ distanceMax: vi.fn() })), distanceMax: vi.fn() }),
  forceCollide: () => ({ strength: vi.fn(), radius: vi.fn() }),
  forceCenter: () => ({}),
  forceX: () => ({ strength: vi.fn() }),
  forceY: () => ({ strength: vi.fn() })
}))

vi.mock('d3-force-3d', () => ({
  forceCollide: () => ({ strength: vi.fn(), radius: vi.fn() })
}))

vi.mock('three', () => {
  class MeshBasicMaterial {
    constructor() {}
  }
  class SphereGeometry {
    constructor() {}
  }
  return {
    MeshBasicMaterial,
    SphereGeometry,
    Mesh: class Mesh {
      constructor() {
        this.scale = { set: vi.fn() }
      }
    }
  }
})

vi.mock('../../../../../src/renderer/src/features/Graph/Graph2D', () => ({
  default: () => <div data-testid="graph-2d" />
}))

vi.mock('../../../../../src/renderer/src/features/Graph/Graph3D', () => ({
  default: () => <div data-testid="graph-3d" />
}))

vi.mock('../../../../../src/renderer/src/features/Graph/GraphSidebar', () => ({
  default: () => <div data-testid="graph-sidebar" />
}))

vi.mock('../../../../../src/renderer/src/features/Graph/GraphMiniMap', () => ({
  default: () => <div data-testid="minimap" />
}))

vi.mock('../../../../../src/renderer/src/features/Graph/PerformancePanel', () => ({
  default: () => <div data-testid="perf-panel" />
}))

vi.mock('../../../../../src/renderer/src/features/Graph/GraphThemeSelector', () => ({
  default: () => <div data-testid="theme-selector" />
}))

vi.mock('../../../../../src/renderer/src/features/Overlays/ModalHeader', () => {
  const ModalHeader = ({ onClose, left, right }) => (
    <div data-testid="modal-header">
      {left}
      {right}
      <button onClick={onClose}>Close</button>
    </div>
  )
  return { default: ModalHeader }
})

import { render, screen } from '@testing-library/react'
import Graph from '../../../../../src/renderer/src/features/Graph/Graph'
import { useVaultStore } from '../../../../../src/renderer/src/core/store/workspaceStore'
import { useSettingsStore } from '../../../../../src/renderer/src/core/store/useSettingsStore'

describe('Graph', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useVaultStore.setState({ snippets: [], selectedSnippet: null, dirtySnippetIds: [] })
    useSettingsStore.setState({
      settings: {
        graphTheme: 'default',
        graphHideTags: false,
        graphHideGhosts: false,
        graphHideOrphans: false,
        graphSidebarOpen: true,
        graph3DMode: false,
        graphNodeSize: 1.5,
        graphNodeColor: '#40bafa',
        graphShowTexts: true,
        graphModalMaximized: false,
        graphAnimate: false
      }
    })
    global.performance = { now: () => 0 }
    global.ResizeObserver = class {
      constructor() {}
      observe() {}
      disconnect() {}
    }
  })

  it('renders nothing when closed and not embedded', () => {
    const { container } = render(<Graph isOpen={false} embedded={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders modal overlay with header when open', async () => {
    render(<Graph isOpen={true} onClose={vi.fn()} onNavigate={vi.fn()} />)
    expect(screen.getByTestId('modal-header')).toBeInTheDocument()
    expect(screen.getByTestId('graph-sidebar')).toBeInTheDocument()
  })

  it('renders 2D graph by default', async () => {
    render(<Graph isOpen={true} onClose={vi.fn()} onNavigate={vi.fn()} />)
    expect(screen.getByTestId('graph-2d')).toBeInTheDocument()
  })

  it('renders 3D graph when 3D mode enabled', async () => {
    useSettingsStore.setState({ settings: { ...useSettingsStore.getState().settings, graph3DMode: true } })
    render(<Graph isOpen={true} onClose={vi.fn()} onNavigate={vi.fn()} />)
    expect(screen.getByTestId('graph-3d')).toBeInTheDocument()
  })

  it('renders embedded graph without overlay', async () => {
    render(<Graph isOpen={true} embedded={true} onNavigate={vi.fn()} />)
    expect(screen.getByTestId('graph-2d')).toBeInTheDocument()
    expect(screen.getByTestId('theme-selector')).toBeInTheDocument()
  })

  it('renders performance panel in modal mode', async () => {
    render(<Graph isOpen={true} onClose={vi.fn()} onNavigate={vi.fn()} />)
    expect(screen.getByTestId('perf-panel')).toBeInTheDocument()
  })

  it('closes via modal header close button', async () => {
    const onClose = vi.fn()
    render(<Graph isOpen={true} onClose={onClose} onNavigate={vi.fn()} />)
    screen.getByText('Close').click()
    expect(onClose).toHaveBeenCalled()
  })
})
