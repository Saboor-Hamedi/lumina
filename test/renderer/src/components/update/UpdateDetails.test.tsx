import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import UpdateDetails, {
  parseReleaseNotes
} from '../../../../../src/renderer/src/components/update/UpdateDetails'
import { useUpdateStore } from '../../../../../src/renderer/src/core/store/UpdateSetting'

describe('UpdateDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useUpdateStore.setState({
      status: 'idle',
      updateInfo: null,
      progress: null,
      error: null
    })
    ;(global as any).window.api = (global as any).window.api || {}
    ;(global as any).window.api.getVersion = vi.fn().mockResolvedValue('1.0.0')
  })

  it('renders a trigger button that is not open by default', () => {
    const { container } = render(<UpdateDetails />)
    expect(container.querySelector('.update-trigger-btn')).toBeTruthy()
    expect(screen.queryByTestId('update-details')).toBeNull()
  })

  it('opens the dropdown on trigger click', async () => {
    render(<UpdateDetails />)
    fireEvent.click(screen.getByLabelText('Check for updates'))

    expect(screen.getByTestId('update-details')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check for Updates' })).toBeInTheDocument()
  })

  it('renders curated release note categories and items directly', async () => {
    render(<UpdateDetails />)
    fireEvent.click(screen.getByLabelText('Check for updates'))

    expect(screen.getByText('New')).toBeInTheDocument()
    expect(screen.getByText('Improved')).toBeInTheDocument()
    expect(screen.getByText('Fixed')).toBeInTheDocument()
    expect(screen.getByText(/Spatial Infinite Canvas/)).toBeInTheDocument()
    expect(screen.getByText(/Breadcrumbs Long-Title Truncation/)).toBeInTheDocument()
  })

  it('renders default release notes when none provided', () => {
    render(<UpdateDetails />)
    fireEvent.click(screen.getByLabelText('Check for updates'))

    // Default notes include "New" category
    expect(screen.getByText('New')).toBeInTheDocument()
  })

  it('renders changelog link', () => {
    render(<UpdateDetails />)
    fireEvent.click(screen.getByLabelText('Check for updates'))

    expect(screen.getByText('View Full Changelog')).toHaveAttribute(
      'href',
      'https://github.com/Saboor-Hamedi/lumina/releases'
    )
  })

  it('renders Download Update button when status is available and calls download on click', () => {
    const download = vi.fn()
    useUpdateStore.setState({ status: 'available', download })
    render(<UpdateDetails />)
    fireEvent.click(screen.getByLabelText('Check for updates'))
    const downloadBtn = screen.getByRole('button', { name: 'Download' })
    expect(downloadBtn).toBeInTheDocument()
    fireEvent.click(downloadBtn)
    expect(download).toHaveBeenCalled()
  })

  it('closes when clicking outside the dropdown', () => {
    render(<UpdateDetails />)
    fireEvent.click(screen.getByLabelText('Check for updates'))
    expect(screen.getByTestId('update-details')).toBeInTheDocument()

    fireEvent.pointerDown(document.body)
    expect(screen.queryByTestId('update-details')).toBeNull()
  })

  it('fetches current version from window.api.getVersion', async () => {
    ;(global as any).window.api.getVersion = vi.fn().mockResolvedValue('0.9.9')
    render(<UpdateDetails />)
    fireEvent.click(screen.getByLabelText('Check for updates'))

    await vi.waitFor(() => {
      expect(screen.getByText('v0.9.9')).toBeInTheDocument()
    })
  })

  it('closes when pressing Escape', () => {
    render(<UpdateDetails />)
    fireEvent.click(screen.getByLabelText('Check for updates'))
    expect(screen.getByTestId('update-details')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('update-details')).toBeNull()
  })

  it('parses HTML release notes cleanly without raw tags across empty, short, and long inputs', () => {
    expect(parseReleaseNotes('')).toEqual([])
    expect(parseReleaseNotes('   ')).toEqual([])
    expect(parseReleaseNotes(null)).toEqual([])

    const htmlNotes =
      '<h1>Version 91</h1>\n<p>This version has fixed most the critical issue.</p>'
    expect(parseReleaseNotes(htmlNotes)).toEqual([
      {
        title: 'Version 91',
        items: ['This version has fixed most the critical issue.']
      }
    ])

    const headingOnly = '<h2>Version 92</h2>'
    expect(parseReleaseNotes(headingOnly)).toEqual([
      { title: 'Highlights', items: ['Version 92'] }
    ])

    const multiSectionHtml =
      '<h2>New</h2><ul><li>Fast launch</li><li>Clean UI</li></ul><h2>Fixed</h2><p>Resolved &amp; verified</p>'
    expect(parseReleaseNotes(multiSectionHtml)).toEqual([
      { title: 'New', items: ['Fast launch', 'Clean UI'] },
      { title: 'Fixed', items: ['Resolved & verified'] }
    ])
  })
})
