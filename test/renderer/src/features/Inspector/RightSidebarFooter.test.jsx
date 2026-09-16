import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { RightSidebarFooter } from '../../../../../src/renderer/src/features/Inspector/RightSidebarFooter'

vi.mock('../../../../../src/renderer/src/features/AI/tools/lumina', () => ({
  useAIStore: (selector) =>
    selector({
      sendChatMessage: vi.fn(),
      isChatLoading: false,
      cancelChat: vi.fn()
    })
}))

vi.mock('../../../../../src/renderer/src/features/AI/Composer', () => ({
  Composer: ({ isSidebar }) => (
    <div data-testid="mock-composer" data-sidebar={String(isSidebar)}>
      Composer Component
    </div>
  ),
  default: ({ isSidebar }) => (
    <div data-testid="mock-composer" data-sidebar={String(isSidebar)}>
      Composer Component
    </div>
  )
}))

describe('RightSidebarFooter Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Composer inside is-chat-composer container when tab is chat', () => {
    const { container } = render(
      <RightSidebarFooter rightSidebarTab="chat" selectedNote={null} onClose={vi.fn()} />
    )

    const section = container.querySelector('.inspector-footer-section.is-chat-composer')
    expect(section).toBeDefined()
    expect(screen.getByTestId('mock-composer')).toBeDefined()
    expect(screen.getByTestId('mock-composer').getAttribute('data-sidebar')).toBe('true')
  })

  it('renders word count when note has code in details tab', () => {
    const mockNote = {
      id: 'note-1',
      code: 'First second third fourth fifth'
    }

    render(
      <RightSidebarFooter rightSidebarTab="details" selectedNote={mockNote} onClose={vi.fn()} />
    )

    expect(screen.getByText('5 words')).toBeDefined()
  })

  it('handles copying note code to clipboard', () => {
    const writeTextMock = vi.fn()
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    })

    const mockNote = {
      id: 'note-2',
      code: 'console.log("hello world")'
    }

    const { container } = render(
      <RightSidebarFooter rightSidebarTab="details" selectedNote={mockNote} onClose={vi.fn()} />
    )

    const copyBtn = container.querySelector('.inspector-footer-btn')
    expect(copyBtn).toBeDefined()
    fireEvent.click(copyBtn)

    expect(writeTextMock).toHaveBeenCalledWith('console.log("hello world")')
  })
})
