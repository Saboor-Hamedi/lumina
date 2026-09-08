import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { PDFViewerTab } from '../../../../../src/renderer/src/features/media/PDFViewerTab'

describe('PDFViewerTab Component', () => {
  const originalCreateObjectURL = window.URL.createObjectURL
  const originalRevokeObjectURL = window.URL.revokeObjectURL
  const originalFetch = window.fetch

  beforeEach(() => {
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-pdf-url')
    window.URL.revokeObjectURL = vi.fn()
    window.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['fake-pdf'], { type: 'application/pdf' }))
    })
    window.api = {
      openWorkspaceFolder: vi.fn(),
      openVaultFolder: vi.fn(),
      readAsset: vi.fn()
    }
  })

  afterEach(() => {
    window.URL.createObjectURL = originalCreateObjectURL
    window.URL.revokeObjectURL = originalRevokeObjectURL
    window.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('fetches PDF and renders native blob iframe without external protocol dialog', async () => {
    const snippet = {
      id: 'pdf-123',
      title: 'manual.pdf',
      fileName: 'manual.pdf',
      relativePath: 'manual.pdf',
      type: 'pdf',
      size: 1024
    }

    render(<PDFViewerTab snippet={snippet} />)

    await waitFor(() => {
      const iframe = document.querySelector('iframe.pdf-viewer-frame')
      expect(iframe).toBeInTheDocument()
      expect(iframe).toHaveAttribute('src', 'blob:mock-pdf-url')
    })

    expect(screen.getByText('1 KB')).toBeInTheDocument()
    expect(screen.getByText('PDF')).toBeInTheDocument()
  })

  it('displays error state when snippet has no valid file path', () => {
    const snippet = {
      id: 'pdf-error',
      title: 'invalid',
      type: 'pdf'
    }

    render(<PDFViewerTab snippet={snippet} />)
    expect(screen.getByText(/Invalid file path/i)).toBeInTheDocument()
  })

  it('calls openWorkspaceFolder when toolbar folder button is clicked', () => {
    const openFolderMock = vi.fn()
    window.api.openWorkspaceFolder = openFolderMock

    const snippet = {
      id: 'pdf-folder',
      title: 'document.pdf',
      fileName: 'document.pdf',
      folderId: 'research',
      relativePath: 'research/document.pdf',
      type: 'pdf',
      size: 2048
    }

    render(<PDFViewerTab snippet={snippet} />)

    const folderBtn = screen.getByTitle('Open Containing Folder')
    fireEvent.click(folderBtn)

    expect(openFolderMock).toHaveBeenCalledWith('research')
  })
})
