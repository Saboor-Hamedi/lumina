import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SettingDropdown from '../../../../../../src/renderer/src/features/Navigation/components/SettingDropdown'
import { useSettingsStore } from '../../../../../../src/renderer/src/core/store/useSettingsStore'
import { useUpdateStore } from '../../../../../../src/renderer/src/core/store/useUpdateStore'

describe('SettingDropdown', () => {
  const defaultProps = () => ({
    isOpen: true,
    onClose: vi.fn(),
    onSettingsClick: vi.fn(),
    onThemeClick: vi.fn(),
    anchorRef: { current: document.createElement('div') }
  })

  beforeEach(() => {
    vi.clearAllMocks()
    useSettingsStore.setState({
      settings: { ...useSettingsStore.getState().settings, googleUser: null }
    })
    useUpdateStore.setState({ status: 'idle', progress: null })
    global.window.api = {
      ...global.window.api,
      loginWithGoogle: vi.fn()
    }
  })

  it('renders nothing when closed', () => {
    const { container } = render(<SettingDropdown {...defaultProps()} isOpen={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders Settings and Change Theme items when open', () => {
    render(<SettingDropdown {...defaultProps()} />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Change Theme')).toBeInTheDocument()
  })

  it('shows "Not signed in" when no google user', () => {
    render(<SettingDropdown {...defaultProps()} />)
    expect(screen.getByText('Not signed in')).toBeInTheDocument()
    expect(screen.getByText('Sign In to Sync')).toBeInTheDocument()
  })

  it('shows google user name when logged in', () => {
    useSettingsStore.setState({
      settings: {
        ...useSettingsStore.getState().settings,
        googleUser: { name: 'John Doe', email: 'john@example.com', picture: 'http://pic' }
      }
    })

    render(<SettingDropdown {...defaultProps()} />)
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('john@example.com')).toBeInTheDocument()
    expect(screen.getByText('Sign Out')).toBeInTheDocument()
  })

  it('does not show Sign In when logged in', () => {
    useSettingsStore.setState({
      settings: {
        ...useSettingsStore.getState().settings,
        googleUser: { name: 'John Doe', email: 'john@example.com' }
      }
    })

    render(<SettingDropdown {...defaultProps()} />)
    expect(screen.queryByText('Sign In to Sync')).not.toBeInTheDocument()
  })

  it('calls onSettingsClick and onClose when Settings clicked', () => {
    const props = defaultProps()
    render(<SettingDropdown {...props} />)
    fireEvent.click(screen.getByText('Settings'))

    expect(props.onSettingsClick).toHaveBeenCalledTimes(1)
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onThemeClick and onClose when Change Theme clicked', () => {
    const props = defaultProps()
    render(<SettingDropdown {...props} />)
    fireEvent.click(screen.getByText('Change Theme'))

    expect(props.onThemeClick).toHaveBeenCalledTimes(1)
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape key when open', () => {
    const props = defaultProps()
    render(<SettingDropdown {...props} />)
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('closes when clicking outside the dropdown', () => {
    const props = defaultProps()
    render(<SettingDropdown {...props} />)
    fireEvent.mouseDown(document.body)

    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close when clicking inside the dropdown', () => {
    const props = defaultProps()
    render(<SettingDropdown {...props} />)
    fireEvent.mouseDown(screen.getByText('Settings'))

    expect(props.onClose).not.toHaveBeenCalled()
  })

  describe('sign in', () => {
    it('calls loginWithGoogle and saves user on success', async () => {
      const userInfo = { name: 'Google User', email: 'g@example.com' }
      global.window.api.loginWithGoogle.mockResolvedValue(userInfo)
      const props = defaultProps()

      render(<SettingDropdown {...props} />)
      fireEvent.click(screen.getByText('Sign In to Sync'))

      await vi.waitFor(() => {
        expect(global.window.api.loginWithGoogle).toHaveBeenCalled()
      })
      await vi.waitFor(() => {
        expect(useSettingsStore.getState().settings.googleUser).toEqual(userInfo)
      })
      expect(props.onClose).toHaveBeenCalled()
    })

    it('handles login errors without crashing', async () => {
      global.window.api.loginWithGoogle.mockRejectedValue(new Error('denied'))
      const props = defaultProps()

      render(<SettingDropdown {...props} />)
      fireEvent.click(screen.getByText('Sign In to Sync'))

      await vi.waitFor(() => {
        expect(props.onClose).toHaveBeenCalled()
      })
      expect(useSettingsStore.getState().settings.googleUser).toBeNull()
    })
  })

  describe('sign out', () => {
    it('clears googleUser on sign out', async () => {
      useSettingsStore.setState({
        settings: {
          ...useSettingsStore.getState().settings,
          googleUser: { name: 'John', email: 'j@example.com' }
        }
      })
      const props = defaultProps()

      render(<SettingDropdown {...props} />)
      fireEvent.click(screen.getByText('Sign Out'))

      expect(useSettingsStore.getState().settings.googleUser).toBeNull()
      expect(props.onClose).toHaveBeenCalled()
    })
  })

  describe('update status', () => {
    it('shows update available item when update available', () => {
      useUpdateStore.setState({ status: 'available' })
      render(<SettingDropdown {...defaultProps()} />)
      expect(screen.getByText('Update Available')).toBeInTheDocument()
    })

    it('shows download progress when downloading', () => {
      useUpdateStore.setState({ status: 'downloading', progress: { percent: 40 } })
      render(<SettingDropdown {...defaultProps()} />)
      expect(screen.getByText('Downloading... 40%')).toBeInTheDocument()
    })

    it('does not show update item when idle', () => {
      render(<SettingDropdown {...defaultProps()} />)
      expect(screen.queryByText('Update Available')).not.toBeInTheDocument()
    })

    it('calls download when update available item clicked', () => {
      const download = vi.spyOn(useUpdateStore.getState(), 'download').mockResolvedValue()
      useUpdateStore.setState({ status: 'available' })

      render(<SettingDropdown {...defaultProps()} />)
      fireEvent.click(screen.getByText('Update Available'))

      expect(download).toHaveBeenCalled()
      download.mockRestore()
    })

    it('calls install when update ready item clicked', () => {
      const install = vi.spyOn(useUpdateStore.getState(), 'install').mockResolvedValue()
      useUpdateStore.setState({ status: 'ready' })

      render(<SettingDropdown {...defaultProps()} />)
      fireEvent.click(screen.getByText('Update Available'))

      expect(install).toHaveBeenCalled()
      install.mockRestore()
    })
  })
})
