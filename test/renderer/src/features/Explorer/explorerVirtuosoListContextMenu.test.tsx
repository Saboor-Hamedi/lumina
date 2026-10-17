import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { ExplorerVirtuosoList } from '../../../../../src/renderer/src/features/Explorer/ExplorerVirtuosoList'

vi.mock('react-virtuoso', () => ({
  Virtuoso: ({ data, itemContent, context }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'virtuoso' },
      data.map((item: any, index: number) =>
        React.createElement(React.Fragment, { key: index }, itemContent(index, item, context))
      )
    )
}))

vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
  useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: () => {}, isDragging: false })
}))

// Mirror the real SortableListItem: memoized while ignoring onContextMenu identity,
// which is exactly what can leave a row holding a stale closure.
vi.mock('@renderer/features/Explorer/components', () => ({
  SortableListItem: React.memo(
    ({ snippet, onContextMenu }: any) =>
      React.createElement('div', {
        'data-testid': `note-${snippet.id}`,
        onContextMenu: (e: any) => onContextMenu?.(snippet, e)
      }),
    (prev: any, next: any) => prev.snippet?.id === next.snippet?.id && prev.isActive === next.isActive
  )
}))

vi.mock('@renderer/features/Explorer/drop', () => ({
  DroppableFolderItem: () => null,
  ExternalDropOverlay: () => null
}))

const flatTree = [
  { type: 'file', snippet: { id: 'note-1', title: 'Note 1' }, depth: 0 },
  { type: 'file', snippet: { id: 'note-2', title: 'Note 2' }, depth: 0 }
]

const renderList = (overrides: Record<string, unknown> = {}) => {
  const handleFolderContextMenu = vi.fn()
  const props: any = {
    virtuosoRef: { current: null },
    flatTree,
    virtuosoContext: {},
    isDragging: false,
    isDraggingExternal: false,
    hoveredFolderId: null,
    selectedNoteIds: new Set(['note-1', 'note-2']),
    selectedNoteIdsRef: { current: new Set(['note-1', 'note-2']) },
    selectedFolderIds: new Set(),
    selectedFolderIdsRef: { current: new Set() },
    selectedSnippetId: 'note-1',
    selectedSnippetIdRef: { current: 'note-1' },
    selectedIndex: 0,
    sidebarFocus: 'multi',
    lastClickedFolder: '',
    totalSelectedCount: 1,
    query: '',
    matchMetaMap: new Map(),
    toggleFolder: vi.fn(),
    handleFolderContextMenu,
    handleNoteClick: vi.fn(),
    handleFolderClick: vi.fn(),
    setSidebarFocus: vi.fn(),
    setLastClickedFolder: vi.fn(),
    setSelectedIndex: vi.fn(),
    handleBackgroundClick: vi.fn(),
    handleExternalDragEnter: vi.fn(),
    handleExternalDragOver: vi.fn(),
    handleExternalDragLeave: vi.fn(),
    handleExternalDrop: vi.fn(),
    ...overrides
  }
  return { handleFolderContextMenu, props }
}

describe('ExplorerVirtuosoList multi-selection context menu', () => {
  beforeEach(() => vi.clearAllMocks())

  it('routes right-click on an already-selected note to the bulk menu even when the row holds a stale selection count', () => {
    const selectedNoteIdsRef: { current: Set<string> } = { current: new Set(['note-1']) }
    const { handleFolderContextMenu, props } = renderList({
      totalSelectedCount: 1,
      selectedNoteIds: new Set(['note-1']),
      selectedNoteIdsRef
    })
    const { rerender, getByTestId } = render(<ExplorerVirtuosoList {...props} />)

    // note-2 is added to the selection, but the memoized note-1 row (unchanged isActive)
    // keeps its old closure and stale render-time values.
    selectedNoteIdsRef.current = new Set(['note-1', 'note-2'])
    rerender(
      <ExplorerVirtuosoList
        {...props}
        selectedNoteIds={new Set(['note-1', 'note-2'])}
        totalSelectedCount={3}
      />
    )

    fireEvent.contextMenu(getByTestId('note-note-1'))

    expect(handleFolderContextMenu).toHaveBeenCalledTimes(1)
    expect(handleFolderContextMenu.mock.calls[0][0]).toBe('note-1')
  })

  it('falls back to the single-item menu for a plain right-click outside a multi-selection', () => {
    const { handleFolderContextMenu, props } = renderList({
      selectedNoteIds: new Set(['note-1']),
      selectedNoteIdsRef: { current: new Set(['note-1']) },
      totalSelectedCount: 1
    })
    const { getByTestId } = render(<ExplorerVirtuosoList {...props} />)

    fireEvent.contextMenu(getByTestId('note-note-1'))

    expect(handleFolderContextMenu).not.toHaveBeenCalled()
  })
})
