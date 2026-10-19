import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { TerminalPanel } from '../../../../../src/renderer/src/features/terminal/TerminalPanel'
import { RightSidebarFooter } from '../../../../../src/renderer/src/features/Inspector/RightSidebarFooter'
import { ActivityBar } from '../../../../../src/renderer/src/features/Navigation/ActivityBar'

vi.mock('../../../../../src/renderer/src/features/AI/tools/lumina', () => ({
  useAIStore: (selector: any) =>
    selector({
      sendChatMessage: vi.fn(),
      isChatLoading: false,
      cancelChat: vi.fn()
    })
}))

vi.mock('../../../../../src/renderer/src/features/AI/Composer', () => ({
  Composer: () => <div data-testid="mock-composer" />,
  default: () => <div data-testid="mock-composer" />
}))

vi.mock('../../../../../src/renderer/src/core/store/SettingStore', () => {
  const state = {
    settings: {
      sidebar: { isLeftOpen: true },
      defaultTerminalShell: 'cmd.exe',
      workspacePath: 'B:\\electron\\lumina'
    },
    updateSettings: vi.fn()
  }
  const hook = (selector?: any) => (selector ? selector(state) : state)
  hook.getState = () => state
  return {
    useSettingStore: hook,
    useSettingsStore: hook
  }
})

vi.mock('../../../../../src/renderer/src/features/Navigation/components/DailyNotes', () => ({
  default: () => <div data-testid="daily-notes-mock" />
}))

vi.mock('../../../../../src/renderer/src/features/Navigation/components/ActivityBarMail', () => ({
  default: () => <div data-testid="mail-mock" />
}))

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    loadAddon = vi.fn()
    open = vi.fn()
    write = vi.fn()
    focus = vi.fn()
    dispose = vi.fn()
    onData = vi.fn(() => ({ dispose: vi.fn() }))
  }
}))

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit = vi.fn()
  }
}))

vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: class {}
}))

describe('Terminal Feature & Navigation Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders TerminalPanel container properly', () => {
    const { container } = render(<TerminalPanel />)
    expect(container.querySelector('.lumina-terminal')).toBeDefined()
  })

  it('suppresses RightSidebarFooter when rightSidebarTab is "chat"', () => {
    const { container } = render(
      <RightSidebarFooter
        rightSidebarTab="chat"
        selectedNote={{ id: '1', code: 'test content' }}
        selectedSnippet={null}
        onClose={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders Terminal button on ActivityBar and triggers toggle callback', () => {
    const onToggleTerminalMock = vi.fn()
    render(<ActivityBar onToggleTerminal={onToggleTerminalMock} />)

    const terminalBtn = screen.getByRole('button', { name: /terminal/i })
    expect(terminalBtn).toBeDefined()

    fireEvent.click(terminalBtn)
    expect(onToggleTerminalMock).toHaveBeenCalledTimes(1)
  })

  it('renders exactly one initial session on the left and no duplicate or reset buttons', () => {
    render(<TerminalPanel />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(1)
    expect(tabs[0].textContent).toMatch(/1:/i)
    expect(screen.queryByTitle(/duplicate/i)).toBeNull()
    expect(screen.queryByTitle(/restart/i)).toBeNull()
  })

  it('keeps at least one terminal open when closing the only active session', () => {
    render(<TerminalPanel />)
    const closeTabBtn = screen.getByRole('button', { name: /close 1:/i })
    fireEvent.click(closeTabBtn)

    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(1)
    expect(tabs[0].textContent).toMatch(/1:/i)
  })
})
