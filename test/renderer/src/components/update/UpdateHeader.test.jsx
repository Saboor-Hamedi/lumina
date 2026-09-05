import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import UpdateHeader from '../../../../../src/renderer/src/components/update/UpdateHeader'

describe('UpdateHeader', () => {
  it('shows Stable channel active by default', () => {
    render(<UpdateHeader currentVersion="1.0.0" newVersion="1.2.0" status="available" />)

    const stableBtn = screen.getByRole('button', { name: 'Stable' })
    const betaBtn = screen.getByRole('button', { name: 'Beta' })
    expect(stableBtn.className).toContain('active')
    expect(betaBtn.className).not.toContain('active')
  })

  it('switches to Beta channel', () => {
    render(<UpdateHeader currentVersion="1.0.0" newVersion="1.2.0" status="available" />)

    fireEvent.click(screen.getByRole('button', { name: 'Beta' }))
    expect(screen.getByRole('button', { name: 'Beta' }).className).toContain('active')
    expect(screen.getByRole('button', { name: 'Stable' }).className).not.toContain('active')
  })

  it('switches back to Stable channel', () => {
    render(<UpdateHeader currentVersion="1.0.0" newVersion="1.2.0" status="available" />)

    fireEvent.click(screen.getByRole('button', { name: 'Beta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Stable' }))
    expect(screen.getByRole('button', { name: 'Stable' }).className).toContain('active')
  })

  it('renders Download button when status is available', () => {
    const download = vi.fn()
    render(<UpdateHeader currentVersion="1.0.0" newVersion="1.2.0" status="available" download={download} />)

    const btn = screen.getByRole('button', { name: /Download/ })
    expect(btn).toBeInTheDocument()
    fireEvent.click(btn)
    expect(download).toHaveBeenCalled()
  })

  it('renders Restart & Install button when status is ready', () => {
    const install = vi.fn()
    render(<UpdateHeader currentVersion="1.0.0" newVersion="1.2.0" status="ready" install={install} />)

    const btn = screen.getByRole('button', { name: /Restart & Install/ })
    expect(btn).toBeInTheDocument()
    fireEvent.click(btn)
    expect(install).toHaveBeenCalled()
  })

  it('renders Up to date button when status is not-available', () => {
    render(<UpdateHeader currentVersion="1.0.0" newVersion="1.0.0" status="not-available" />)

    expect(screen.getByRole('button', { name: /Up to date/ })).toBeInTheDocument()
  })
})
