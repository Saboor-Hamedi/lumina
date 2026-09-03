import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../../../../src/renderer/src/features/Graph/InlineGraph', () => ({
  default: () => <div data-testid="inline-graph" />
}))

import { render, screen, fireEvent } from '@testing-library/react'
import EditorMetadata from '../../../../../../src/renderer/src/features/Workspace/components/EditorMetadata'
import { useVaultStore } from '../../../../../../src/renderer/src/core/store/workspaceStore'

describe('EditorMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useVaultStore.setState({
      snippets: [],
      selectedSnippet: null,
      openTabs: [],
      activeTabId: null
    })
    global.ResizeObserver = class {
      constructor() {}
      observe() {}
      disconnect() {}
    }
  })

  const baseProps = {
    snippet: { id: '1', title: 'My Note', code: '', tags: '' },
    title: 'My Note',
    setTitle: vi.fn(),
    setIsDirty: vi.fn(),
    titleRef: { current: null }
  }

  it('renders nothing when no snippet', () => {
    const { container } = render(<EditorMetadata {...baseProps} snippet={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders title input with the title value', () => {
    render(<EditorMetadata {...baseProps} />)
    expect(screen.getByDisplayValue('My Note')).toBeInTheDocument()
  })

  it('calls setTitle and setIsDirty on change', () => {
    render(<EditorMetadata {...baseProps} />)
    fireEvent.change(screen.getByDisplayValue('My Note'), { target: { value: 'New Title' } })
    expect(baseProps.setTitle).toHaveBeenCalledWith('New Title')
    expect(baseProps.setIsDirty).toHaveBeenCalledWith(true)
  })

  it('shows error on empty title Enter and clears on valid title', () => {
    const setTitle = vi.fn()
    const { rerender } = render(<EditorMetadata {...baseProps} title="" setTitle={setTitle} />)

    const input = screen.getByPlaceholderText('Untitled')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText('Title cannot be empty')).toBeInTheDocument()

    // Typing clears the error state
    rerender(<EditorMetadata {...baseProps} title="Valid" setTitle={setTitle} />)
    fireEvent.change(screen.getByPlaceholderText('Untitled'), { target: { value: 'Valid' } })
    fireEvent.keyDown(screen.getByPlaceholderText('Untitled'), { key: 'Enter' })
    expect(screen.queryByText('Title cannot be empty')).toBeNull()
  })

  it('renders Ask AI and Local Graph buttons', () => {
    render(<EditorMetadata {...baseProps} />)
    expect(screen.getByText('Ask AI')).toBeInTheDocument()
    expect(screen.getByText('Local Graph')).toBeInTheDocument()
  })

  it('toggles local graph on click', () => {
    render(<EditorMetadata {...baseProps} />)
    fireEvent.click(screen.getByText('Local Graph'))
    expect(screen.getByTestId('inline-graph')).toBeInTheDocument()
  })

  it('closes local graph on second click', () => {
    render(<EditorMetadata {...baseProps} />)
    fireEvent.click(screen.getByText('Local Graph'))
    expect(screen.getByTestId('inline-graph')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Local Graph'))
    expect(screen.queryByTestId('inline-graph')).toBeNull()
  })
})
