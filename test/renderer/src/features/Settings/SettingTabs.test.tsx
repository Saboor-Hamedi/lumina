import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SettingTabs from '../../../../../src/renderer/src/features/Settings/SettingTabs'

describe('SettingTabs', () => {
  it('renders all the navigation buttons including workspace', () => {
    render(<SettingTabs activeTab="look-and-feel" setActiveTab={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Look & Feel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Shortcuts' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Workspace' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'AI Assistant' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'AI Memory' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Advanced' })).toBeInTheDocument()
  })

  it('marks the active tab with the active class', () => {
    const { container } = render(<SettingTabs activeTab="assistant" setActiveTab={vi.fn()} />)
    const assistantBtn = screen.getByRole('button', { name: 'AI Assistant' })
    expect(assistantBtn.className).toContain('active')
    expect(screen.getByRole('button', { name: 'Look & Feel' }).className).not.toContain('active')
    expect(container.querySelector('.nav-item.active')).toBe(assistantBtn)
  })

  it('calls setActiveTab with the correct tab when a button is clicked', () => {
    const setActiveTab = vi.fn()
    render(<SettingTabs activeTab="look-and-feel" setActiveTab={setActiveTab} />)

    fireEvent.click(screen.getByRole('button', { name: 'AI Assistant' }))
    expect(setActiveTab).toHaveBeenCalledWith('assistant')

    fireEvent.click(screen.getByRole('button', { name: 'Workspace' }))
    expect(setActiveTab).toHaveBeenCalledWith('workspace')

    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }))
    expect(setActiveTab).toHaveBeenCalledWith('advanced')

    fireEvent.click(screen.getByRole('button', { name: 'Look & Feel' }))
    expect(setActiveTab).toHaveBeenCalledWith('look-and-feel')
  })

  it('marks only one tab active at a time', () => {
    const { container } = render(<SettingTabs activeTab="advanced" setActiveTab={vi.fn()} />)
    expect(container.querySelectorAll('.nav-item.active')).toHaveLength(1)
  })
})
