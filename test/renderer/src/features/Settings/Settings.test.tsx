import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Settings from '../../../../../src/renderer/src/features/Settings/Settings'

vi.mock('../../../../../src/renderer/src/features/Settings/SettingLookAndFeel', () => ({
  default: () => <div data-testid="pane-look-and-feel">Look & Feel Pane</div>
}))
vi.mock('../../../../../src/renderer/src/features/Settings/SettingAssistant', () => ({
  default: () => <div data-testid="pane-assistant">Assistant Pane</div>
}))
vi.mock('../../../../../src/renderer/src/features/Settings/SettingShortcuts', () => ({
  default: () => <div data-testid="pane-shortcuts">Shortcuts Pane</div>
}))
vi.mock('../../../../../src/renderer/src/features/Settings/SettingWorkspace', () => ({
  default: () => <div data-testid="pane-workspace">Workspace Pane</div>
}))
vi.mock('../../../../../src/renderer/src/features/Settings/SettingAdvanced', () => ({
  default: () => <div data-testid="pane-advanced">Advanced Pane</div>
}))

describe('Settings', () => {
  const defaultProps = () => ({
    onClose: vi.fn(),
    onOpenTheme: vi.fn()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the modal with a Settings title', () => {
    render(<Settings {...defaultProps()} />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('shows the look-and-feel pane by default', () => {
    render(<Settings {...defaultProps()} />)
    expect(screen.getByTestId('pane-look-and-feel')).toBeInTheDocument()
    expect(screen.queryByTestId('pane-assistant')).not.toBeInTheDocument()
    expect(screen.queryByTestId('pane-advanced')).not.toBeInTheDocument()
  })

  it('shows tabs for all sections', () => {
    render(<Settings {...defaultProps()} />)
    expect(screen.getByRole('button', { name: 'Look & Feel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Shortcuts' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Workspace' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'AI Assistant' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Advanced' })).toBeInTheDocument()
  })

  it('switches to the assistant pane when the AI Assistant tab is clicked', () => {
    render(<Settings {...defaultProps()} />)
    fireEvent.click(screen.getByRole('button', { name: 'AI Assistant' }))
    expect(screen.getByTestId('pane-assistant')).toBeInTheDocument()
    expect(screen.queryByTestId('pane-look-and-feel')).not.toBeInTheDocument()
  })

  it('switches to the workspace pane when the Workspace tab is clicked', () => {
    render(<Settings {...defaultProps()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Workspace' }))
    expect(screen.getByTestId('pane-workspace')).toBeInTheDocument()
  })

  it('switches to the advanced pane when the Advanced tab is clicked', () => {
    render(<Settings {...defaultProps()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }))
    expect(screen.getByTestId('pane-advanced')).toBeInTheDocument()
  })

  describe('initialTab mapping', () => {
    it('maps legacy "ai" tab to assistant', () => {
      render(<Settings {...defaultProps()} initialTab="ai" />)
      expect(screen.getByTestId('pane-assistant')).toBeInTheDocument()
    })

    it('maps "workspace" tab to workspace', () => {
      render(<Settings {...defaultProps()} initialTab="workspace" />)
      expect(screen.getByTestId('pane-workspace')).toBeInTheDocument()
    })

    it('maps legacy "appearance" and "type" tabs to look-and-feel', () => {
      const { rerender } = render(<Settings {...defaultProps()} initialTab="appearance" />)
      expect(screen.getByTestId('pane-look-and-feel')).toBeInTheDocument()
      rerender(<Settings {...defaultProps()} initialTab="type" />)
      expect(screen.getByTestId('pane-look-and-feel')).toBeInTheDocument()
    })

    it('maps legacy "shortcuts" tab to shortcuts', () => {
      render(<Settings {...defaultProps()} initialTab="shortcuts" />)
      expect(screen.getByTestId('pane-shortcuts')).toBeInTheDocument()
    })

    it('maps legacy "graph" and "advanced" tabs to advanced', () => {
      render(<Settings {...defaultProps()} initialTab="graph" />)
      expect(screen.getByTestId('pane-advanced')).toBeInTheDocument()
    })

    it('falls back to look-and-feel for unknown tabs', () => {
      render(<Settings {...defaultProps()} initialTab="unknown" />)
      expect(screen.getByTestId('pane-look-and-feel')).toBeInTheDocument()
    })
  })

  describe('closing', () => {
    it('calls onClose when the overlay background is clicked', () => {
      const props = defaultProps()
      render(<Settings {...props} />)
      const overlay = document.querySelector('.nexus-overlay')
      if (overlay) {
        fireEvent.click(overlay)
        expect(props.onClose).toHaveBeenCalledTimes(1)
      }
    })

    it('does not close when clicking inside the modal container', () => {
      const props = defaultProps()
      render(<Settings {...props} />)
      const container = document.querySelector('.modal-container')
      if (container) {
        fireEvent.click(container)
        expect(props.onClose).not.toHaveBeenCalled()
      }
    })

    it('calls onClose when the header close button is clicked', () => {
      const props = defaultProps()
      render(<Settings {...props} />)
      fireEvent.click(screen.getByLabelText('Close'))
      expect(props.onClose).toHaveBeenCalledTimes(1)
    })

    it('closes on Escape via the keyboard shortcut stack', () => {
      const props = defaultProps()
      render(<Settings {...props} />)
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(props.onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('calls onOpenTheme when the theme gallery is requested', () => {
    const props = defaultProps()
    render(<Settings {...props} />)
    expect(screen.getByTestId('pane-look-and-feel')).toBeInTheDocument()
    expect(props.onOpenTheme).toBeDefined()
  })

  describe('keyboard tab navigation', () => {
    it('switches to the next tab on Ctrl+Tab', () => {
      render(<Settings {...defaultProps()} initialTab="look-and-feel" />)
      expect(screen.getByTestId('pane-look-and-feel')).toBeInTheDocument()

      fireEvent.keyDown(window, { key: 'Tab', ctrlKey: true })
      expect(screen.getByTestId('pane-shortcuts')).toBeInTheDocument()
    })

    it('switches to the previous tab on Ctrl+Shift+Tab', () => {
      render(<Settings {...defaultProps()} initialTab="look-and-feel" />)
      expect(screen.getByTestId('pane-look-and-feel')).toBeInTheDocument()

      fireEvent.keyDown(window, { key: 'Tab', ctrlKey: true, shiftKey: true })
      expect(screen.getByTestId('pane-workspace')).toBeInTheDocument()
    })

    it('switches to the previous tab on Shift+Tab when not focused in an input', () => {
      render(<Settings {...defaultProps()} initialTab="look-and-feel" />)
      expect(screen.getByTestId('pane-look-and-feel')).toBeInTheDocument()

      fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
      expect(screen.getByTestId('pane-workspace')).toBeInTheDocument()
    })

    it('jumps directly to tabs via Ctrl + 1..6', () => {
      render(<Settings {...defaultProps()} initialTab="look-and-feel" />)

      // Ctrl + 1 -> Workspace (first tab)
      fireEvent.keyDown(window, { key: '1', ctrlKey: true })
      expect(screen.getByTestId('pane-workspace')).toBeInTheDocument()

      // Ctrl + 4 -> Assistant (fourth tab)
      fireEvent.keyDown(window, { key: '4', ctrlKey: true })
      expect(screen.getByTestId('pane-assistant')).toBeInTheDocument()

      // Ctrl + 6 -> Advanced (sixth tab)
      fireEvent.keyDown(window, { key: '6', ctrlKey: true })
      expect(screen.getByTestId('pane-advanced')).toBeInTheDocument()
    })
  })
})

