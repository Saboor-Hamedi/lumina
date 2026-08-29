import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GraphSidebar from '../../../../../src/renderer/src/features/Graph/GraphSidebar'
import { useSettingsStore } from '../../../../../src/renderer/src/core/store/useSettingsStore'

describe('GraphSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    useSettingsStore.setState({
      settings: {
        graphHideTags: false,
        graphHideGhosts: false,
        graphHideOrphans: false,
        graph3DMode: false,
        graphNodeSize: 1.5,
        graphCenterForce: 0.05,
        graphRepelForce: 0.3,
        graphLinkForce: 0.05,
        graphAnimate: true,
        graphTheme: 'default',
        graphLinkHighlightOpacity: 0.6,
        graphLinkDimOpacity: 0.05,
        graphGhostLinkOpacity: 0.3
      }
    })
  })

  const defaultProps = {
    isOpen: true,
    searchQuery: '',
    setSearchQuery: vi.fn(),
    graphTheme: 'default'
  }

  it('renders search input', () => {
    render(<GraphSidebar {...defaultProps} />)
    expect(screen.getByPlaceholderText('Search nodes...')).toBeInTheDocument()
  })

  it('debounces search query updates', () => {
    render(<GraphSidebar {...defaultProps} />)
    fireEvent.change(screen.getByPlaceholderText('Search nodes...'), {
      target: { value: 'hello' }
    })
    expect(defaultProps.setSearchQuery).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(defaultProps.setSearchQuery).toHaveBeenCalledWith('hello')
  })

  it('renders 6 theme color buttons and rotation toggle', () => {
    render(<GraphSidebar {...defaultProps} />)
    const themeButtons = screen.getAllByRole('button')
    expect(themeButtons.length).toBe(7)
  })

  it('updates graphTheme when a theme button is clicked', () => {
    render(<GraphSidebar {...defaultProps} />)
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[3]) // ocean
    expect(useSettingsStore.getState().settings.graphTheme).toBe('ocean')
  })

  it('toggles Show Tags checkbox', () => {
    render(<GraphSidebar {...defaultProps} />)
    const checkbox = screen.getByText('Show Tags').nextElementSibling.querySelector('input')
    fireEvent.click(checkbox)
    expect(useSettingsStore.getState().settings.graphHideTags).toBe(true)
  })

  it('toggles 3D Sphere Mode checkbox', () => {
    render(<GraphSidebar {...defaultProps} />)
    const checkbox = screen.getByText('3D Sphere Mode').nextElementSibling.querySelector('input')
    fireEvent.click(checkbox)
    expect(useSettingsStore.getState().settings.graph3DMode).toBe(true)
  })

  it('updates Node Size slider optimistically and commits on mouseup', () => {
    render(<GraphSidebar {...defaultProps} />)
    const slider = document.querySelector('.graph-slider')
    fireEvent.change(slider, { target: { value: '1.2' } })
    expect(useSettingsStore.getState().settings.graphNodeSize).toBe(1.2)
    fireEvent.mouseUp(slider, { target: { value: '1.2' } })
    expect(useSettingsStore.getState().settings.graphNodeSize).toBe(1.2)
  })

  it('toggles auto rotation', () => {
    render(<GraphSidebar {...defaultProps} />)
    const rotateBtn = screen.getByTitle('Stop Rotation')
    fireEvent.click(rotateBtn)
    expect(useSettingsStore.getState().settings.graphAnimate).toBe(false)
  })

  it('adds closed class when isOpen is false', () => {
    const { container } = render(<GraphSidebar {...defaultProps} isOpen={false} />)
    expect(container.querySelector('.nexus-sidebar').className).toContain('closed')
  })
})
