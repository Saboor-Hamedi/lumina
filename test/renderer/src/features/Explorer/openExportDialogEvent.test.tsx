import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import React, { useState, useEffect } from 'react'

// Mock BatchExportDialog
vi.mock('@renderer/features/export', () => ({
  BatchExportDialog: ({ isOpen, notes, folderName, onClose }: any) => {
    if (!isOpen) return null
    return (
      <div data-testid="batch-export-dialog">
        <span data-testid="export-title">{folderName}</span>
        <span data-testid="export-count">{notes?.length || 0}</span>
        {notes?.map((n: any) => (
          <div key={n.id} data-testid={`export-note-${n.id}`}>
            {n.title}: {n.content}
          </div>
        ))}
        <button data-testid="close-export-btn" onClick={onClose}>
          Close
        </button>
      </div>
    )
  }
}))

describe('open-export-dialog event handling for root and single files', () => {
  it('opens export dialog with note content when open-export-dialog is dispatched', () => {
    function TestComponent() {
      const [batchExportNotes, setBatchExportNotes] = useState<any[] | null>(null)

      useEffect(() => {
        const handleOpenExportDialog = async (e: Event) => {
          const customEvent = e as CustomEvent
          const targetSnippet = customEvent.detail?.snippet
          if (!targetSnippet) return

          const content = targetSnippet.content ?? targetSnippet.code ?? ''
          setBatchExportNotes([
            {
              id: targetSnippet.id,
              title: targetSnippet.title || targetSnippet.fileName || 'Untitled',
              content
            }
          ])
        }

        window.addEventListener('open-export-dialog', handleOpenExportDialog)
        return () => {
          window.removeEventListener('open-export-dialog', handleOpenExportDialog)
        }
      }, [])

      return (
        <div>
          {batchExportNotes && (
            <div data-testid="batch-export-dialog">
              <span data-testid="export-title">
                {batchExportNotes.length === 1 ? batchExportNotes[0].title : 'Combined Export'}
              </span>
              <span data-testid="export-count">{batchExportNotes.length}</span>
              {batchExportNotes.map((n) => (
                <div key={n.id} data-testid={`note-${n.id}`}>
                  {n.title}: {n.content}
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    render(<TestComponent />)
    expect(screen.queryByTestId('batch-export-dialog')).toBeNull()

    act(() => {
      window.dispatchEvent(
        new CustomEvent('open-export-dialog', {
          detail: {
            snippet: {
              id: 'root-file-1',
              title: 'Money%: this is my file name',
              code: '# Expenses\n100% tracked',
              folderId: ''
            }
          }
        })
      )
    })

    expect(screen.getByTestId('batch-export-dialog')).toBeDefined()
    expect(screen.getByTestId('export-title').textContent).toBe('Money%: this is my file name')
    expect(screen.getByTestId('export-count').textContent).toBe('1')
    expect(screen.getByTestId('note-root-file-1').textContent).toContain('Money%: this is my file name: # Expenses\n100% tracked')
  })
})
