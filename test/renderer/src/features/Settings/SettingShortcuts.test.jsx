import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SettingShortcuts from '../../../../../src/renderer/src/features/Settings/SettingShortcuts'

describe('SettingShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders search input and shortcut categories', () => {
    render(<SettingShortcuts />)
    expect(screen.getByPlaceholderText(/Find a shortcut/i)).toBeInTheDocument()
    expect(screen.getByText('General')).toBeInTheDocument()
  })

  it('filters shortcuts based on search query', () => {
    render(<SettingShortcuts />)
    const searchInput = screen.getByPlaceholderText(/Find a shortcut/i)

    fireEvent.change(searchInput, { target: { value: 'Settings' } })

    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('clears search input when clear button is clicked', () => {
    render(<SettingShortcuts />)
    const searchInput = screen.getByPlaceholderText(/Find a shortcut/i)

    fireEvent.change(searchInput, { target: { value: 'Settings' } })
    expect(searchInput.value).toBe('Settings')

    const clearBtn = screen.getByRole('button')
    fireEvent.click(clearBtn)

    expect(searchInput.value).toBe('')
    expect(screen.getByText('General')).toBeInTheDocument()
  })

  it('renders no results message when query has no matches', () => {
    render(<SettingShortcuts />)
    const searchInput = screen.getByPlaceholderText(/Find a shortcut/i)

    fireEvent.change(searchInput, { target: { value: 'xyznonexistent123' } })

    expect(screen.getByText(/No shortcuts found matching/i)).toBeInTheDocument()
  })
})
