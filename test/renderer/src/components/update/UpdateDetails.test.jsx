import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import UpdateDetails from '../../../../../src/renderer/src/components/update/UpdateDetails'
import { useUpdateStore } from '../../../../../src/renderer/src/core/store/useUpdateStore'

describe('UpdateDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useUpdateStore.setState({
      status: 'idle',
      updateInfo: null,
      progress: null,
      error: null
    })
    global.window.api = global.window.api || {}
    global.window.api.getVersion = vi.fn().mockResolvedValue('1.0.0')
  })

  it('renders a trigger button that is not open by default', () => {
    const { container } = render(<UpdateDetails />)
    expect(container.querySelector('.update-trigger-btn')).toBeTruthy()
    expect(screen.queryByTestId('update-details')).toBeNull()
  })

  it('opens the dropdown on trigger click', async () => {
    render(<UpdateDetails />)
    fireEvent.click(screen.getByTitle('Check for updates'))

    expect(screen.getByTestId('update-details')).toBeInTheDocument()
    expect(screen.getByText("You're up to date!")).toBeInTheDocument()
  })

  it('renders parsed release note categories', async () => {
    useUpdateStore.setState({
      status: 'available',
      updateInfo: {
        version: '1.2.0',
        releaseNotes: 'New\n- feature one\n- feature two\n\nFixed\n- bug one'
      }
    })
    render(<UpdateDetails />)
    fireEvent.click(screen.getByTitle('Check for updates'))

    expect(screen.getByText('New')).toBeInTheDocument()
    expect(screen.getByText('feature one')).toBeInTheDocument()
    expect(screen.getByText('feature two')).toBeInTheDocument()
    expect(screen.getByText('Fixed')).toBeInTheDocument()
    expect(screen.getByText('bug one')).toBeInTheDocument()
  })

  it('renders default release notes when none provided', () => {
    render(<UpdateDetails />)
    fireEvent.click(screen.getByTitle('Check for updates'))

    // Default notes include "New" category
    expect(screen.getByText('New')).toBeInTheDocument()
  })

  it('renders changelog link', () => {
    render(<UpdateDetails />)
    fireEvent.click(screen.getByTitle('Check for updates'))

    expect(screen.getByText('View Full Changelog')).toHaveAttribute(
      'href',
      'https://github.com/Saboor-Hamedi/lumina/releases'
    )
  })

  it('calls download automatically when status becomes available', () => {
    const download = vi.fn()
    useUpdateStore.setState({ status: 'available', download })
    render(<UpdateDetails />)
    expect(download).toHaveBeenCalled()
  })

  it('closes when clicking outside the dropdown', () => {
    render(<UpdateDetails />)
    fireEvent.click(screen.getByTitle('Check for updates'))
    expect(screen.getByTestId('update-details')).toBeInTheDocument()

    fireEvent.pointerDown(document.body)
    expect(screen.queryByTestId('update-details')).toBeNull()
  })

  it('fetches current version from window.api.getVersion', async () => {
    global.window.api.getVersion = vi.fn().mockResolvedValue('0.9.9')
    render(<UpdateDetails />)
    fireEvent.click(screen.getByTitle('Check for updates'))

    await vi.waitFor(() => {
      expect(screen.getByText('v0.9.9')).toBeInTheDocument()
    })
  })
})
