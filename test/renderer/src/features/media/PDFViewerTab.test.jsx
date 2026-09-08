import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { PDFViewerTab } from '../../../../../src/renderer/src/features/media/PDFViewerTab'

describe('PDFViewerTab Component', () => {
  const originalCreateObjectURL = window.URL.createObjectURL
  const originalRevokeObjectURL = window.URL.revokeObjectURL

  beforeEach(() => {
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-pdf-url')
    window.URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    window.URL.createObjectURL = originalCreateObjectURL
    window.URL.revokeObjectURL = originalRevokeObjectURL
    vi.restoreAllMocks()
  })

  it('renders loading state initially and then displays the PDF iframe', async () => {
    const fakeBase64 = btoa('%PDF-1.4 test')
    window.api = {
      readAsset: vi.fn().mockResolvedValue({
        base64: fakeBase64,
        size: 1024,
        mimeType: 'application/pdf'
      }),
      openWorkspaceFolder: vi.fn()
    }

    const snippet = {
      id: 'pdf-123',
      title: 'manual.pdf',
      fileName: 'manual.pdf',
      relativePath: 'manual.pdf',
      type: 'pdf',
      size: 1024
    }

    render(<PDFViewerTab snippet={snippet} />)

    expect(screen.getByText(/Loading PDF/i)).toBeInTheDocument()

    await waitFor(() => {
      const iframe = document.querySelector('iframe.pdf-viewer-frame')
      expect(iframe).toBeInTheDocument()
      expect(iframe).toHaveAttribute('src', 'blob:mock-pdf-url')
    })

    expect(screen.getByText('1 KB')).toBeInTheDocument()
    expect(screen.getByText('PDF')).toBeInTheDocument()
  })

  it('displays error state when asset loading fails', async () => {
    window.api = {
      readAsset: vi.fn().mockRejectedValue(new Error('File not found')),
      openWorkspaceFolder: vi.fn()
    }

    const snippet = {
      id: 'pdf-error',
      title: 'broken.pdf',
      fileName: 'broken.pdf',
      relativePath: 'broken.pdf',
      type: 'pdf'
    }

    render(<PDFViewerTab snippet={snippet} />)

    await waitFor(() => {
      expect(screen.getByText(/Failed to load PDF/i)).toBeInTheDocument()
    })
  })

  it('calls openWorkspaceFolder when toolbar folder button is clicked', async () => {
    const fakeBase64 = btoa('%PDF-1.4 test')
    const openFolderMock = vi.fn()
    window.api = {
      readAsset: vi.fn().mockResolvedValue({
        base64: fakeBase64,
        size: 2048,
        mimeType: 'application/pdf'
      }),
      openWorkspaceFolder: openFolderMock
    }

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
