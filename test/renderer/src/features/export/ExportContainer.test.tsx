import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import React from 'react'
import { ExportContainer } from '@renderer/features/export/ExportContainer'
import { BatchExportDialog } from '@renderer/features/export/batch/BatchExportDialog'
import { PreviewFrame } from '@renderer/features/export/previews/PreviewFrame'

describe('ExportContainer', () => {
  const originalApi = (window as any).api

  beforeEach(() => {
    ;(window as any).api = {
      exportPreview: vi.fn().mockResolvedValue({
        html: '<!DOCTYPE html><html><body><article class="doc"><p>Preview OK</p></article></body></html>',
        format: 'pdf',
        truncated: false
      }),
      exportPDF: vi.fn().mockResolvedValue({
        success: true,
        filePath: 'C:\\Exports\\Release Notes.pdf'
      }),
      openPath: vi.fn(),
      showItemInFolder: vi.fn()
    }
  })

  afterEach(() => {
    ;(window as any).api = originalApi
    vi.restoreAllMocks()
  })

  it('renders Formats above Options, shows Plain Text toggles without jumping/clipping, and never spins forever', async () => {
    render(
      <ExportContainer
        isOpen
        title="Release Notes"
        content={'# Release Notes\n\nEverything works smoothly.'}
        onClose={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.queryByText('Generating preview…')).toBeNull()
    })

    const formatsHeading = screen.getByText('Formats')
    const optionsHeading = screen.getByText('Options')
    expect(
      Boolean(formatsHeading.compareDocumentPosition(optionsHeading) & Node.DOCUMENT_POSITION_FOLLOWING)
    ).toBe(true)

    expect(screen.getByLabelText('Include Table of Contents')).toBeInTheDocument()
    expect(screen.getByLabelText('Optimize Images')).toBeInTheDocument()

    // Switch to Plain Text: Formats stay anchored and text options appear cleanly below
    fireEvent.click(screen.getByRole('button', { name: /Plain Text/i }))
    await waitFor(() => {
      expect(screen.queryByText('Generating preview…')).toBeNull()
    })

    expect(screen.getByLabelText('Strip Formatting')).toBeInTheDocument()
    expect(screen.getByLabelText('Include Title')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Copy Text/i })).toBeInTheDocument()

    // Switch back to PDF: PDF options return cleanly while Formats stayed anchored at top
    fireEvent.click(screen.getByRole('button', { name: /PDF Document/i }))
    await waitFor(() => {
      expect(screen.getByLabelText('Include Table of Contents')).toBeInTheDocument()
    })
  })

  it('stops loading spinner and shows error message when preview generation rejects', async () => {
    ;(window as any).api.exportPreview.mockRejectedValueOnce(new Error('Preview engine boom'))

    render(
      <ExportContainer
        isOpen
        title="Broken Preview"
        content={'# Hello'}
        onClose={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.queryByText('Generating preview…')).toBeNull()
    })
    expect(screen.getByText('Preview engine boom')).toBeInTheDocument()
  })

  it('completes PDF export and shows Open file and Open folder actions', async () => {
    render(
      <ExportContainer
        isOpen
        title="Release Notes"
        content={'# Hello'}
        onClose={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.queryByText('Generating preview…')).toBeNull()
    })

    fireEvent.click(screen.getByRole('button', { name: /Export PDF/i }))

    await waitFor(() => {
      expect(screen.getByTestId('export-success')).toBeInTheDocument()
    })
    expect(screen.getByText('C:\\Exports\\Release Notes.pdf')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Open file/i }))
    expect((window as any).api.openPath).toHaveBeenCalledWith('C:\\Exports\\Release Notes.pdf')

    fireEvent.click(screen.getByRole('button', { name: /Open folder/i }))
    expect((window as any).api.showItemInFolder).toHaveBeenCalledWith('C:\\Exports\\Release Notes.pdf')
  })

  it('exports Plain Text, HTML (with theme), and Markdown directly via their file exporters', async () => {
    ;(window as any).api.exportText = vi.fn().mockResolvedValue({
      success: true,
      filePath: 'C:\\Exports\\Release Notes.txt'
    })
    ;(window as any).api.exportHTML = vi.fn().mockResolvedValue({
      success: true,
      filePath: 'C:\\Exports\\Release Notes.html'
    })
    ;(window as any).api.exportMarkdown = vi.fn().mockResolvedValue({
      success: true,
      filePath: 'C:\\Exports\\Release Notes.md'
    })
    ;(window as any).api.exportBatch = vi.fn()

    render(
      <ExportContainer
        isOpen
        title="Release Notes"
        content={'# Hello\n\nBody'}
        onClose={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.queryByText('Generating preview…')).toBeNull()
    })

    // Plain Text
    fireEvent.click(screen.getByRole('button', { name: /Plain Text/i }))
    await waitFor(() => expect(screen.queryByText('Generating preview…')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: /Export Text/i }))
    await waitFor(() => expect((window as any).api.exportText).toHaveBeenCalledTimes(1))
    expect(screen.getByText('C:\\Exports\\Release Notes.txt')).toBeInTheDocument()

    // Go back -> HTML
    fireEvent.click(screen.getByRole('button', { name: /Export again/i }))
    fireEvent.click(screen.getByRole('button', { name: /HTML Page/i }))
    await waitFor(() => expect(screen.queryByText('Generating preview…')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: /Export HTML/i }))
    await waitFor(() => expect((window as any).api.exportHTML).toHaveBeenCalledTimes(1))
    expect((window as any).api.exportHTML.mock.calls[0][0].theme).toBeTruthy()
    expect(screen.getByText('C:\\Exports\\Release Notes.html')).toBeInTheDocument()

    // Go back -> Markdown
    fireEvent.click(screen.getByRole('button', { name: /Export again/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Markdown/i }))
    await waitFor(() => expect(screen.queryByText('Generating preview…')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: /Export Markdown/i }))
    await waitFor(() => expect((window as any).api.exportMarkdown).toHaveBeenCalledTimes(1))
    expect(screen.getByText('C:\\Exports\\Release Notes.md')).toBeInTheDocument()
    expect((window as any).api.exportBatch).not.toHaveBeenCalled()
  })
})

describe('BatchExportDialog', () => {
  const originalApi = (window as any).api

  beforeEach(() => {
    ;(window as any).api = {
      exportPreview: vi.fn().mockResolvedValue({
        html: '<!DOCTYPE html><html><body><div class="page"><p>Batch Preview OK</p></div></body></html>',
        format: 'pdf',
        truncated: false
      }),
      exportCombined: vi.fn().mockResolvedValue({
        success: true,
        filePath: 'C:\\Exports\\Combined.out',
        total: 1,
        exported: 1,
        failed: 0,
        combined: true
      }),
      exportBatch: vi.fn().mockResolvedValue({
        success: true,
        outputDir: 'C:\\Exports',
        total: 2,
        exported: 2,
        failed: 0
      }),
      onBatchExportProgress: vi.fn(() => () => {})
    }
  })

  afterEach(() => {
    ;(window as any).api = originalApi
    vi.restoreAllMocks()
  })

  it('places compact Merged/Separate tabs at the very top without any bottom dropdown, and restores Merged after leaving ZIP', async () => {
    render(
      <BatchExportDialog
        isOpen
        folderName="Docs"
        notes={[
          { id: '1', title: 'Alpha', content: '# Alpha\nHello' },
          { id: '2', title: 'Beta', content: '# Beta\nWorld' }
        ]}
        onClose={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.queryByText('Generating preview…')).toBeNull()
    })

    const radiogroup = screen.getByRole('radiogroup', { name: /Export mode/i })
    const formatsHeading = screen.getByText('Formats')
    const optionsHeading = screen.getByText('Options')

    // Tabs come strictly before Formats and Options, and there is no Destination Mode label
    expect(
      Boolean(radiogroup.compareDocumentPosition(formatsHeading) & Node.DOCUMENT_POSITION_FOLLOWING)
    ).toBe(true)
    expect(
      Boolean(formatsHeading.compareDocumentPosition(optionsHeading) & Node.DOCUMENT_POSITION_FOLLOWING)
    ).toBe(true)
    expect(screen.queryByText('Destination Mode')).toBeNull()
    expect(screen.queryByText('Included Notes')).toBeNull()

    // Clicking ZIP Archive keeps the top radiogroup visible with Merged disabled and Separate checked
    fireEvent.click(screen.getByRole('button', { name: /ZIP Archive/i }))
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /Merged/i })).toBeDisabled()
      expect(screen.getByRole('radio', { name: /Separate/i })).toHaveAttribute('aria-checked', 'true')
    })

    // Switching from ZIP to Plain Text, HTML, or Markdown restores Merged mode instead of opening the folder picker
    fireEvent.click(screen.getByRole('button', { name: /Plain Text/i }))
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /Merged/i })).toHaveAttribute('aria-checked', 'true')
    })
    fireEvent.click(screen.getByRole('button', { name: /Export as TEXT/i }))
    await waitFor(() => expect((window as any).api.exportCombined).toHaveBeenCalledTimes(1))
    expect((window as any).api.exportCombined.mock.calls[0][0].format).toBe('text')
    expect((window as any).api.exportBatch).not.toHaveBeenCalled()
  })

  it('hides Merged/Separate tabs for a single note and saves HTML/Markdown/Text directly via exportCombined', async () => {
    render(
      <BatchExportDialog
        isOpen
        folderName="Solo"
        notes={[{ id: '1', title: 'Solo', content: '# Solo\nBody text' }]}
        onClose={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.queryByText('Generating preview…')).toBeNull()
    })
    expect(screen.queryByRole('radiogroup', { name: /Export mode/i })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /HTML Page/i }))
    await waitFor(() => expect(screen.queryByText('Generating preview…')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: /Export HTML/i }))

    await waitFor(() => expect((window as any).api.exportCombined).toHaveBeenCalledTimes(1))
    expect((window as any).api.exportCombined.mock.calls[0][0].format).toBe('html')
    expect((window as any).api.exportCombined.mock.calls[0][0].theme).toBeTruthy()
    expect((window as any).api.exportBatch).not.toHaveBeenCalled()
  })
})

describe('PreviewFrame wheel & pinch zoom', () => {
  it('supports Ctrl+Wheel, trackpad pinch accumulation, and iframe postMessage zoom without rewriting srcDoc', () => {
    const sampleHtml = '<!DOCTYPE html><html><body><div class="page"><p>Zoom Test</p></div></body></html>'
    const { container } = render(<PreviewFrame html={sampleHtml} loading={false} label="PDF" />)

    const iframe = screen.getByTitle('PDF preview') as HTMLIFrameElement
    const viewport = container.querySelector('.export-preview-viewport') as HTMLElement
    const initialSrcDoc = iframe.getAttribute('srcdoc')

    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts')
    expect(initialSrcDoc).toContain('lumina-zoom-stage')
    expect(initialSrcDoc).toContain('lumina-preview-wheel-zoom')
    expect(screen.getByRole('button', { name: /Reset zoom/i }).textContent).toBe('100%')

    const postMessageSpy = vi.fn()
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage: postMessageSpy }
    })

    // 1. Ctrl+Wheel zoom in on viewport
    act(() => {
      viewport.dispatchEvent(
        new WheelEvent('wheel', { deltaY: -120, ctrlKey: true, bubbles: true, cancelable: true })
      )
    })
    expect(screen.getByRole('button', { name: /Reset zoom/i }).textContent).toBe('110%')
    expect(postMessageSpy).toHaveBeenCalledWith({ type: 'lumina-preview-set-zoom', zoom: 1.1 }, '*')
    expect(iframe.getAttribute('srcdoc')).toBe(initialSrcDoc)

    // 2. Small fractional trackpad pinch deltas inside viewport (out: positive deltaY)
    act(() => {
      viewport.dispatchEvent(
        new WheelEvent('wheel', { deltaY: 7, ctrlKey: true, bubbles: true, cancelable: true })
      )
      viewport.dispatchEvent(
        new WheelEvent('wheel', { deltaY: 7, ctrlKey: true, bubbles: true, cancelable: true })
      )
    })
    expect(screen.getByRole('button', { name: /Reset zoom/i }).textContent).toBe('100%')

    // 3. Simulated pinch/wheel postMessage from inside sandboxed iframe
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'lumina-preview-wheel-zoom', deltaY: -8 }
        })
      )
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'lumina-preview-wheel-zoom', deltaY: -8 }
        })
      )
    })
    expect(screen.getByRole('button', { name: /Reset zoom/i }).textContent).toBe('110%')
    expect(postMessageSpy).toHaveBeenLastCalledWith({ type: 'lumina-preview-set-zoom', zoom: 1.1 }, '*')
    expect(iframe.getAttribute('srcdoc')).toBe(initialSrcDoc)
  })
})
