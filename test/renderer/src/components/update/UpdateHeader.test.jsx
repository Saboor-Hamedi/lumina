import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import UpdateHeader from '../../../../../src/renderer/src/components/update/UpdateHeader'

describe('UpdateHeader', () => {
  it('renders current and new version numbers when an update is available', () => {
    render(<UpdateHeader currentVersion="1.0.0" newVersion="1.2.0" status="available" />)

    expect(screen.getByText('Current')).toBeInTheDocument()
    expect(screen.getByText('Latest')).toBeInTheDocument()
    expect(screen.getByText('1.0.0')).toBeInTheDocument()
    expect(screen.getByText('1.2.0')).toBeInTheDocument()
  })

  it('shows Stable channel active by default', () => {
    render(<UpdateHeader currentVersion="1.0.0" newVersion="1.2.0" status="available" />)

    const stableBtn = screen.getByRole('button', { name: 'Stable' })
    const betaBtn = screen.getByRole('button', { name: 'Beta' })
    expect(stableBtn.className).toContain('active')
    expect(betaBtn.className).not.toContain('active')
  })

  it('switches to Beta channel and appends -beta to new version', () => {
    render(<UpdateHeader currentVersion="1.0.0" newVersion="1.2.0" status="available" />)

    fireEvent.click(screen.getByRole('button', { name: 'Beta' }))

    expect(screen.getByText('1.2.0-beta')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Beta' }).className).toContain('active')
  })

  it('switches back to Stable channel', () => {
    render(<UpdateHeader currentVersion="1.0.0" newVersion="1.2.0" status="available" />)

    fireEvent.click(screen.getByRole('button', { name: 'Beta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Stable' }))

    expect(screen.getByText('1.2.0')).toBeInTheDocument()
  })

  it('shows up-to-date message when status is idle', () => {
    render(<UpdateHeader currentVersion="1.0.0" newVersion="1.2.0" status="idle" />)

    expect(screen.getByText("You're up to date!")).toBeInTheDocument()
    expect(screen.getByText('v1.0.0')).toBeInTheDocument()
    expect(screen.queryByText('Current')).toBeNull()
  })

  it('shows up-to-date message when versions match', () => {
    render(<UpdateHeader currentVersion="1.0.0" newVersion="1.0.0" status="available" />)

    expect(screen.getByText("You're up to date!")).toBeInTheDocument()
  })
})
