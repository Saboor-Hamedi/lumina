import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SettingMemory from '../../../../../src/renderer/src/features/Settings/SettingMemory'
import { luminaMemory } from '../../../../../src/renderer/src/core/ai/memory'

vi.mock('../../../../../src/renderer/src/core/ai/memory', () => ({
  luminaMemory: {
    loadMemory: vi.fn(),
    getMemory: vi.fn(),
    persist: vi.fn(),
    saveFact: vi.fn(),
    forgetFact: vi.fn(),
    updateFact: vi.fn(),
    clearAllMemory: vi.fn()
  }
}))

vi.mock('../../../../../src/renderer/src/core/notification', () => ({
  useToast: () => ({
    showToast: vi.fn()
  })
}))

describe('SettingMemory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(luminaMemory.loadMemory).mockResolvedValue({
      user: { name: 'Ada Lovelace', role: 'Mathematician', bio: 'Pioneer of computing' },
      preferences: ['Be concise', 'Prefer Python'],
      facts: ['Built Analytical Engine program']
    })
  })

  it('renders memory profile title and user identity inputs', async () => {
    render(<SettingMemory />)
    expect(screen.getByText('AI Memory Profile')).toBeInTheDocument()
    expect(screen.getByText('User Identity')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByDisplayValue('Ada Lovelace')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Mathematician')).toBeInTheDocument()
    })
  })

  it('displays user preferences and facts', async () => {
    render(<SettingMemory />)

    await waitFor(() => {
      expect(screen.getByText('Be concise')).toBeInTheDocument()
      expect(screen.getByText('Prefer Python')).toBeInTheDocument()
      expect(screen.getByText('Built Analytical Engine program')).toBeInTheDocument()
    })
  })

  it('adds a new preference when submitted', async () => {
    render(<SettingMemory />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Ada Lovelace')).toBeInTheDocument()
    })

    const prefInput = screen.getByPlaceholderText(/Add a preference/i)
    fireEvent.change(prefInput, { target: { value: 'Favor TypeScript' } })

    const addButtons = screen.getAllByRole('button', { name: /Add/i })
    fireEvent.click(addButtons[0])

    expect(luminaMemory.saveFact).toHaveBeenCalledWith({
      fact: 'Favor TypeScript',
      category: 'preferences'
    })
  })
})
