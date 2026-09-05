import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SettingTab from '../../../../../src/renderer/src/features/Settings/SettingTab'

describe('SettingTab', () => {
  it('renders the navigation buttons', () => {
    render(<SettingTab activeTab="look-and-feel" setActiveTab={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Look & Feel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Shortcuts' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lumina AI Assistant' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Advanced' })).toBeInTheDocument()
  })

  it('marks the active tab with the active class', () => {
    const { container } = render(<SettingTab activeTab="assistant" setActiveTab={vi.fn()} />)
    const assistantBtn = screen.getByRole('button', { name: 'Lumina AI Assistant' })
    expect(assistantBtn.className).toContain('active')
    expect(screen.getByRole('button', { name: 'Look & Feel' }).className).not.toContain('active')
    expect(container.querySelector('.nav-item.active')).toBe(assistantBtn)
  })

  it('calls setActiveTab with the correct tab when a button is clicked', () => {
    const setActiveTab = vi.fn()
    render(<SettingTab activeTab="look-and-feel" setActiveTab={setActiveTab} />)

    fireEvent.click(screen.getByRole('button', { name: 'Lumina AI Assistant' }))
    expect(setActiveTab).toHaveBeenCalledWith('assistant')

    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }))
    expect(setActiveTab).toHaveBeenCalledWith('advanced')

    fireEvent.click(screen.getByRole('button', { name: 'Look & Feel' }))
    expect(setActiveTab).toHaveBeenCalledWith('look-and-feel')
  })

  it('marks only one tab active at a time', () => {
    const { container } = render(<SettingTab activeTab="advanced" setActiveTab={vi.fn()} />)
    expect(container.querySelectorAll('.nav-item.active')).toHaveLength(1)
  })
})
