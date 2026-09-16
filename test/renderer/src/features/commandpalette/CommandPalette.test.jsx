import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import CommandPalette from '../../../../../src/renderer/src/features/commandpalette/CommandPalette'

vi.mock('../../../../../src/renderer/src/features/AI/tools/lumina', () => ({
  useAIStore: () => ({
    searchNotes: vi.fn(),
    isModelReady: true,
    modelLoadingProgress: 100,
    aiError: null,
    chatMessages: [],
    isChatLoading: false,
    cancelChat: vi.fn(),
    sendChatMessage: vi.fn(),
    clearChat: vi.fn()
  })
}))

vi.mock('../../../../../src/renderer/src/core/store/workspaceStore', () => ({
  useWorkspaceStore: (selector) =>
    selector({
      dirtySnippetIds: [],
      folders: [],
      selectedSnippet: null
    })
}))

vi.mock('../../../../../src/renderer/src/core/store/useSettingsStore', () => ({
  useSettingsStore: () => ({
    settings: { commandPaletteMode: 'search', commandPaletteSplitRatio: 50 },
    updateSetting: vi.fn()
  })
}))

vi.mock('../../../../../src/renderer/src/core/hooks/useTag', () => ({
  useTag: () => ({ tags: [] })
}))

vi.mock('../../../../../src/renderer/src/core/hooks/useMention', () => ({
  useMention: () => ({ mentions: [] })
}))

describe('CommandPalette Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <CommandPalette isOpen={false} onClose={vi.fn()} items={[]} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders search input when isOpen is true', () => {
    render(
      <CommandPalette isOpen={true} onClose={vi.fn()} items={[]} />
    )
    expect(screen.getByPlaceholderText(/search notes/i)).toBeDefined()
  })

  it('calls onClose when Escape key is pressed in the search input', () => {
    const onClose = vi.fn()
    render(
      <CommandPalette isOpen={true} onClose={onClose} items={[]} />
    )

    const input = screen.getByPlaceholderText(/search notes/i)
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when clicking the backdrop overlay', () => {
    const onClose = vi.fn()
    render(
      <CommandPalette isOpen={true} onClose={onClose} items={[]} />
    )

    const overlay = document.querySelector('.command-palette-overlay')
    expect(overlay).not.toBeNull()
    fireEvent.click(overlay)

    expect(onClose).toHaveBeenCalled()
  })
})
