import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { PDFViewerTab } from '../../../../../src/renderer/src/features/media/PDFViewerTab'
import { useSettingsStore } from '../../../../../src/renderer/src/core/store/SettingStore'
import type { Snippet } from '../../../../../src/renderer/src/core/editor/types'

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
    } as any)
    ;(window as any).api = {
      openWorkspaceFolder: vi.fn(),
      openVaultFolder: vi.fn(),
      readAsset: vi.fn()
    }
    useSettingsStore.setState({
      settings: {
        ...useSettingsStore.getState().settings,
        theme: 'light'
      }
    })
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
    } as unknown as Snippet

    render(<PDFViewerTab snippet={snippet} />)

    await waitFor(() => {
      const iframe = document.querySelector('iframe.pdf-viewer-frame')
      expect(iframe).toBeInTheDocument()
      expect(iframe).toHaveAttribute('src', 'blob:mock-pdf-url')
    })

    expect(screen.getByText(/1(\.0)? KB/)).toBeInTheDocument()
    expect(screen.getByText('PDF')).toBeInTheDocument()
  })

  it('syncs PDF appearance with app theme and allows switching (original, dark, sepia)', async () => {
    const snippet = {
      id: 'pdf-theme-test',
      title: 'document.pdf',
      fileName: 'document.pdf',
      relativePath: 'document.pdf',
      type: 'pdf',
      size: 1024
    } as unknown as Snippet

    render(<PDFViewerTab snippet={snippet} />)

    await waitFor(() => {
      const wrapper = document.querySelector('.pdf-viewer-frame-wrapper')
      expect(wrapper).toBeInTheDocument()
    })

    const wrapper = document.querySelector('.pdf-viewer-frame-wrapper')
    // Starts in original (Light) when app theme is light
    expect(wrapper).toHaveClass('theme-original')

    const darkBtn = screen.getByLabelText('Dark PDF appearance')
    fireEvent.click(darkBtn)
    expect(wrapper).toHaveClass('theme-dark')

    const sepiaBtn = screen.getByLabelText('Parchment PDF appearance')
    fireEvent.click(sepiaBtn)
    expect(wrapper).toHaveClass('theme-sepia')

    const origBtn = screen.getByLabelText('Light PDF appearance')
    fireEvent.click(origBtn)
    expect(wrapper).toHaveClass('theme-original')
  })

  it('displays error state when snippet has no valid file path', () => {
    const snippet = {
      id: 'pdf-error',
      title: 'invalid',
      type: 'pdf'
    } as unknown as Snippet

    render(<PDFViewerTab snippet={snippet} />)
    expect(screen.getByText(/Invalid file path/i)).toBeInTheDocument()
  })

  it('calls openWorkspaceFolder when toolbar folder button is clicked', async () => {
    const openFolderMock = vi.fn()
    ;(window as any).api.openWorkspaceFolder = openFolderMock

    const snippet = {
      id: 'pdf-folder',
      title: 'document.pdf',
      fileName: 'document.pdf',
      folderId: 'research',
      relativePath: 'research/document.pdf',
      type: 'pdf',
      size: 2048
    } as unknown as Snippet

    render(<PDFViewerTab snippet={snippet} />)

    await waitFor(() => {
      expect(document.querySelector('iframe.pdf-viewer-frame')).toBeInTheDocument()
    })

    const folderBtn = screen.getByLabelText('Open Containing Folder')
    fireEvent.click(folderBtn)

    expect(openFolderMock).toHaveBeenCalledWith('research')
  })

  it('toggles toolbar open and close on toggle button click', async () => {
    const snippet = {
      id: 'pdf-toggle',
      title: 'document.pdf',
      fileName: 'document.pdf',
      relativePath: 'document.pdf',
      type: 'pdf',
      size: 1024
    } as unknown as Snippet

    render(<PDFViewerTab snippet={snippet} />)

    await waitFor(() => {
      expect(document.querySelector('iframe.pdf-viewer-frame')).toBeInTheDocument()
    })

    expect(screen.getByText('PDF')).toBeInTheDocument()
    expect(screen.getByLabelText('Open Containing Folder')).toBeInTheDocument()

    const collapseBtn = screen.getByLabelText('Collapse PDF toolbar')
    fireEvent.click(collapseBtn)

    expect(screen.queryByText('PDF')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Open Containing Folder')).not.toBeInTheDocument()

    const expandBtn = screen.getByLabelText('Expand PDF toolbar')
    expect(expandBtn).toBeInTheDocument()

    fireEvent.click(expandBtn)
    expect(screen.getByText('PDF')).toBeInTheDocument()
    expect(screen.getByLabelText('Open Containing Folder')).toBeInTheDocument()
  })
})
