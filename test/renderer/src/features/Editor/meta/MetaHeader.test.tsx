import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../../../../src/renderer/src/features/graph/InlineGraph', () => ({
  default: () => <div data-testid="inline-graph" />
}))

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MetaHeader from '../../../../../../src/renderer/src/features/Editor/meta/MetaHeader'
import { useWorkspaceStore } from '../../../../../../src/renderer/src/core/store/workspaceStore'
import type { Snippet } from '../../../../../../src/renderer/src/core/editor/types'

describe('MetaHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useWorkspaceStore.setState({
      snippets: [],
      selectedSnippet: null,
      openTabs: [],
      activeTabId: null
    } as any)
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any
  })

  const baseProps = {
    snippet: { id: 'note-1', title: 'Header Test Note', code: '', tags: '' } as Snippet,
    title: 'Header Test Note',
    isDirty: false,
    editorMenu: <div data-testid="editor-menu-mock">Dropdown Menu</div>
  }

  it('renders nothing when snippet is not provided', () => {
    const { container } = render(<MetaHeader {...baseProps} snippet={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when showActions is false', () => {
    const { container } = render(<MetaHeader {...baseProps} showActions={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders Ask AI and Local Graph items inside Note Actions menu', () => {
    render(<MetaHeader {...baseProps} />)
    fireEvent.click(screen.getByLabelText('Note Actions'))
    expect(screen.getByText('Ask AI')).toBeInTheDocument()
    expect(screen.getByText('Local Graph')).toBeInTheDocument()
  })

  it('renders editorMenu', () => {
    render(<MetaHeader {...baseProps} />)
    expect(screen.getByTestId('editor-menu-mock')).toBeInTheDocument()
  })

  it('calls onInlineAI callback when clicking Ask AI', () => {
    const onInlineAI = vi.fn()
    render(<MetaHeader {...baseProps} onInlineAI={onInlineAI} />)
    fireEvent.click(screen.getByLabelText('Note Actions'))
    fireEvent.click(screen.getByText('Ask AI'))
    expect(onInlineAI).toHaveBeenCalled()
  })

  it('toggles local graph view on click', async () => {
    render(<MetaHeader {...baseProps} />)
    fireEvent.click(screen.getByLabelText('Note Actions'))
    fireEvent.click(screen.getByText('Local Graph'))
    expect(await screen.findByTestId('inline-graph')).toBeInTheDocument()

    // Clicking Note Actions again closes the open local graph popover
    fireEvent.click(screen.getByLabelText('Note Actions'))
    expect(screen.queryByTestId('inline-graph')).toBeNull()
  })

  it('toggles portaled dropdown on Note Actions click and executes Export', () => {
    const onOpenExportDialog = vi.fn()
    render(<MetaHeader {...baseProps} position="inline" onOpenExportDialog={onOpenExportDialog} />)

    fireEvent.click(screen.getByLabelText('Note Actions'))
    const dropdown = document.body.querySelector('.meta-compact-menu-portal')
    expect(dropdown).toBeInTheDocument()

    fireEvent.click(screen.getByText('Export…'))
    expect(onOpenExportDialog).toHaveBeenCalled()
    expect(document.body.querySelector('.meta-compact-menu-portal')).toBeNull()
  })

  it('positions portaled dropdown cleanly below trigger button', () => {
    render(<MetaHeader {...baseProps} position="top" />)
    fireEvent.click(screen.getByLabelText('Note Actions'))
    const dropdown = document.body.querySelector('.meta-compact-menu-portal') as HTMLElement | null
    expect(dropdown).toBeInTheDocument()
    expect(dropdown?.style.top).toBeTruthy()
  })

  it('dispatches show-toast with success message when copying as plain text', async () => {
    const toastSpy = vi.fn()
    window.addEventListener('show-toast', toastSpy)
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock }
    })

    render(
      <MetaHeader
        {...baseProps}
        snippet={{ id: 'note-1', title: 'Test Note', code: '# Hello World', tags: '' } as Snippet}
      />
    )

    fireEvent.click(screen.getByLabelText('Note Actions'))
    fireEvent.click(screen.getByText('Copy as Plain Text'))

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('# Hello World')
      expect(toastSpy).toHaveBeenCalled()
    })

    expect(toastSpy.mock.calls[0][0].detail).toEqual({
      message: 'Markdown copied to clipboard',
      type: 'success'
    })
    window.removeEventListener('show-toast', toastSpy)
  })

  it('provides accessible menu attributes and roles in the dropdown', () => {
    render(<MetaHeader {...baseProps} />)
    const optionsBtn = screen.getByLabelText('Note Actions')
    expect(optionsBtn).toHaveAttribute('aria-haspopup', 'menu')
    expect(optionsBtn).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(optionsBtn)
    expect(optionsBtn).toHaveAttribute('aria-expanded', 'true')

    const menu = document.body.querySelector('[role="menu"]')
    expect(menu).toBeInTheDocument()

    const menuItems = document.body.querySelectorAll('[role="menuitem"]')
    expect(menuItems.length).toBeGreaterThanOrEqual(4)
  })
})
