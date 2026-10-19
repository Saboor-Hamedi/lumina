import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import React, { useRef } from 'react'
import Confirm from '../../../../../src/renderer/src/features/modals/Confirm'
import { useExplorerSelection } from '../../../../../src/renderer/src/features/Explorer/hooks/ExplorerSelection'

function TestSelectionWithConfirmModal() {
  const modalRef = useRef<HTMLDivElement>(null)
  const virtuosoRef = useRef<any>(null)
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  const flatTree = [
    { type: 'file', snippet: { id: 'note-1', title: 'Note 1' } },
    { type: 'file', snippet: { id: 'pdf-2', title: 'Doc.pdf' } },
    { type: 'file', snippet: { id: 'img-3', title: 'Photo.png' } }
  ] as any

  const selection = useExplorerSelection({
    isOpen: true,
    modalRef,
    virtuosoRef,
    flatTree,
    query: '',
    selectedSnippetId: null,
    onRequestBulkDelete: () => setConfirmOpen(true)
  })

  return (
    <div>
      <div ref={modalRef} className="explorer-embedded-container">
        <button
          data-testid="select-all-btn"
          onClick={() => selection.selectAll()}
        >
          Select All
        </button>
        <button
          data-testid="trigger-delete-btn"
          onClick={() => setConfirmOpen(true)}
        >
          Trigger Delete
        </button>
        <div data-testid="selected-count">{selection.selectedNoteIds.size}</div>
      </div>

      {confirmOpen && (
        <Confirm
          isOpen={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => setConfirmOpen(false)}
          title="Delete Items?"
          message="Delete confirmation"
        />
      )}
    </div>
  )
}

describe('Explorer Selection & Confirm Modal Focus Protection', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('preserves multi-selection (including pdf, md, image) when Confirm modal appears and focuses', async () => {
    render(<TestSelectionWithConfirmModal />)

    // Select all items (3 items)
    act(() => {
      screen.getByTestId('select-all-btn').click()
    })

    expect(screen.getByTestId('selected-count').textContent).toBe('3')

    // Open Confirm modal
    act(() => {
      screen.getByTestId('trigger-delete-btn').click()
    })

    // Confirm modal is rendered
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Advance timers so Confirm button auto-focus runs
    act(() => {
      vi.advanceTimersByTime(50)
    })

    // Verify selection is STILL 3 (NOT deselected upon modal appear or button focus!)
    expect(screen.getByTestId('selected-count').textContent).toBe('3')
  })
})
