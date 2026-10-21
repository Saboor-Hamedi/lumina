import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../../../../src/renderer/src/features/graph/InlineGraph', () => ({
  default: () => <div data-testid="inline-graph" />
}))

import { render, screen, fireEvent } from '@testing-library/react'
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

  it('renders Ask AI and Local Graph buttons', () => {
    render(<MetaHeader {...baseProps} />)
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
    fireEvent.click(screen.getByText('Ask AI'))
    expect(onInlineAI).toHaveBeenCalled()
  })

  it('toggles local graph view on click', () => {
    render(<MetaHeader {...baseProps} />)
    fireEvent.click(screen.getByText('Local Graph'))
    expect(screen.getByTestId('inline-graph')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Local Graph'))
    expect(screen.queryByTestId('inline-graph')).toBeNull()
  })
})
