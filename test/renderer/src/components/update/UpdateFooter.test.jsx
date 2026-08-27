import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import UpdateFooter from '../../../../../src/renderer/src/components/update/UpdateFooter'

describe('UpdateFooter', () => {
  it('shows nothing and keeps footer actions when idle', () => {
    render(<UpdateFooter status="idle" progress={null} install={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByTitle('Update Preferences')).toBeInTheDocument()
    expect(screen.getByText('Last checked: Just now')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Restart & Install Now/ })).toBeNull()
  })

  it('shows download progress when downloading', () => {
    render(<UpdateFooter status="downloading" progress={50} install={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByText(/Downloading\.\.\. 50%/)).toBeInTheDocument()
  })

  it('shows preparing message when available', () => {
    render(<UpdateFooter status="available" progress={null} install={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByText(/Preparing download\.\.\./)).toBeInTheDocument()
  })

  it('shows install button and calls install when ready', () => {
    const install = vi.fn()
    render(<UpdateFooter status="ready" progress={null} install={install} onClose={vi.fn()} />)

    const btn = screen.getByRole('button', { name: /Restart & Install Now/ })
    fireEvent.click(btn)
    expect(install).toHaveBeenCalled()
  })

  it('calls onClose when Remind Me clicked', () => {
    const onClose = vi.fn()
    render(<UpdateFooter status="idle" progress={null} install={vi.fn()} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Remind Me' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when Not Now clicked', () => {
    const onClose = vi.fn()
    render(<UpdateFooter status="idle" progress={null} install={vi.fn()} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Not Now' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('opens settings pane and can go back with Done', () => {
    render(<UpdateFooter status="idle" progress={null} install={vi.fn()} onClose={vi.fn()} />)

    fireEvent.click(screen.getByTitle('Update Preferences'))

    expect(screen.getByText('Download updates automatically')).toBeInTheDocument()
    expect(screen.getByText('Install updates on quit')).toBeInTheDocument()
    expect(screen.getByText('Notify me about pre-releases')).toBeInTheDocument()
    expect(screen.getByText('Update Preferences')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    expect(screen.getByTitle('Update Preferences')).toBeInTheDocument()
    expect(screen.getByText('Last checked: Just now')).toBeInTheDocument()
  })
})
