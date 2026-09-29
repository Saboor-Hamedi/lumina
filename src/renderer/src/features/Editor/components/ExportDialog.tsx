import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Square,
  Copy,
  FileCode,
  FileText,
  Printer,
  FileType,
  FileJson,
  Loader2,
  Download,
  AlertTriangle
} from 'lucide-react'
import './css/exportDialog.css'

export type ExportFormat = 'html' | 'pdf' | 'docs' | 'markdown' | 'text'

const PREVIEW_THEME_KEYS = [
  'bg-app',
  'bg-panel',
  'bg-sidebar',
  'bg-editor',
  'bg-card',
  'bg-active',
  'text-main',
  'text-muted',
  'text-faint',
  'text-accent',
  'border-dim',
  'border-card',
  'border-subtle'
]

/**
 * Reads the app's resolved theme tokens so the (separate) preview iframe can
 * render with the exact same palette.
 */
function readThemeTokens(): Record<string, string> | undefined {
  if (typeof window === 'undefined' || typeof document === 'undefined') return undefined
  try {
    const cs = getComputedStyle(document.documentElement)
    const out: Record<string, string> = {}
    for (const key of PREVIEW_THEME_KEYS) {
      const value = cs.getPropertyValue(`--${key}`).trim()
      if (value) out[key] = value
    }
    return out
  } catch {
    return undefined
  }
}

export interface ExportDialogProps {
  isOpen: boolean
  title: string
  content: string
  initialFormat?: ExportFormat
  onClose: () => void
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void
}

interface FormatSpec {
  id: ExportFormat
  label: string
  description: string
  icon: React.ReactNode
  apiKey: string
  acceptLabel: string
}

const FORMATS: FormatSpec[] = [
  {
    id: 'pdf',
    label: 'PDF',
    description: 'Print-ready A4 document with table of contents and diagrams.',
    icon: <Printer size={14} />,
    apiKey: 'exportPDF',
    acceptLabel: 'Export PDF'
  },
  {
    id: 'html',
    label: 'HTML',
    description: 'Self-contained web page with embedded images and styling.',
    icon: <FileCode size={14} />,
    apiKey: 'exportHTML',
    acceptLabel: 'Export HTML'
  },
  {
    id: 'docs',
    label: 'Word',
    description: 'Microsoft Word (.doc) document with embedded diagrams.',
    icon: <FileText size={14} />,
    apiKey: 'exportDocs',
    acceptLabel: 'Export Word'
  },
  {
    id: 'markdown',
    label: 'Markdown',
    description: 'Plain markdown source, ideal for other editors.',
    icon: <FileJson size={14} />,
    apiKey: 'exportMarkdown',
    acceptLabel: 'Export Markdown'
  },
  {
    id: 'text',
    label: 'Text',
    description: 'Plain text with formatting stripped.',
    icon: <FileType size={14} />,
    apiKey: 'exportText',
    acceptLabel: 'Export Text'
  }
]

/**
 * Export dialog with a live preview pane.
 *
 * Mirrors the app's Theme/Settings modal shell (900×76vh, settings-style
 * titlebar with window controls, fast motion).
 */
export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  title,
  content,
  initialFormat = 'pdf',
  onClose,
  showToast
}) => {
  const [format, setFormat] = useState<ExportFormat>(initialFormat)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const requestIdRef = useRef(0)

  // Sync the externally requested initial format each time the dialog opens.
  useEffect(() => {
    if (isOpen) {
      setFormat(initialFormat)
      setPreviewError(null)
      setIsMaximized(false)
    }
  }, [isOpen, initialFormat])

  const activeFormat = useMemo(() => FORMATS.find((f) => f.id === format) || FORMATS[0], [format])

  // Generate the preview whenever the dialog opens or the format changes.
  useEffect(() => {
    if (!isOpen) return
    if (!content) {
      setPreviewHtml('')
      setPreviewError(null)
      return
    }

    const api = (window as any).api
    if (!api?.exportPreview) {
      setPreviewLoading(false)
      setPreviewHtml('')
      setPreviewError('Preview is unavailable in this build. You can still export below.')
      return
    }

    const requestId = ++requestIdRef.current
    setPreviewLoading(true)
    setPreviewError(null)

    const handle = setTimeout(async () => {
      try {
        const res = await api.exportPreview({
          format,
          title,
          content,
          theme: readThemeTokens()
        })
        // Ignore stale responses from a previous format selection.
        if (requestId !== requestIdRef.current) return
        if (!res || typeof res.html !== 'string') {
          throw new Error('Preview generation returned no content')
        }
        setPreviewHtml(res.html)
        if (res.truncated) {
          setPreviewError('Preview truncated for performance. The exported file will be complete.')
        }
      } catch (err: any) {
        if (requestId !== requestIdRef.current) return
        console.error('[ExportDialog] Preview failed:', err)
        setPreviewError(err?.message || 'Failed to generate preview.')
      } finally {
        if (requestId === requestIdRef.current) setPreviewLoading(false)
      }
    }, 250)

    return () => clearTimeout(handle)
  }, [isOpen, format, title, content])

  const handleExport = useCallback(async () => {
    const api = (window as any).api
    const handler = api?.[activeFormat.apiKey]
    if (typeof handler !== 'function') {
      showToast?.(`${activeFormat.label} export is not supported in this environment.`, 'error')
      return
    }

    setExporting(true)
    try {
      const res = await handler({ title, content, language: 'markdown' })
      if (res?.success) {
        showToast?.(`${activeFormat.label} exported successfully.`, 'success')
        onClose()
      } else if (res?.canceled) {
        // User dismissed the native save dialog; keep the preview open.
      } else if (res?.error) {
        showToast?.(`Failed to export ${activeFormat.label}: ${res.error}`, 'error')
      }
    } catch (err: any) {
      console.error('[ExportDialog] Export failed:', err)
      showToast?.(
        `Failed to export ${activeFormat.label}: ${err?.message || 'Unknown error'}`,
        'error'
      )
    } finally {
      setExporting(false)
    }
  }, [activeFormat, title, content, showToast, onClose])

  // Escape to close (unless mid-export).
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !exporting) {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !exporting) {
        e.preventDefault()
        e.stopPropagation()
        handleExport()
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [isOpen, exporting, onClose, handleExport])

  if (!isOpen || typeof document === 'undefined') return null

  const hasContent = Boolean(content && content.trim().length > 0)

  return createPortal(
    <div
      className="export-dialog-overlay"
      role="presentation"
      onClick={exporting ? undefined : onClose}
    >
      <div
        className={`export-dialog${isMaximized ? ' maximized' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Export preview"
        data-testid="export-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Titlebar — same structure as Theme / Settings modals */}
        <div className="export-dialog-header">
          <div className="export-header-left">
            <span className="export-header-icon">
              <Download size={14} strokeWidth={2} />
            </span>
            <span className="export-header-title">Export</span>
            <span className="export-header-divider">/</span>
            <span className="export-header-subtitle">{title || 'Untitled'}</span>
          </div>

          <div className="export-header-right">
            <button
              type="button"
              className="export-window-btn"
              aria-label={isMaximized ? 'Restore Window' : 'Maximize Window'}
              onClick={() => setIsMaximized((v) => !v)}
            >
              {isMaximized ? (
                <Copy size={13} strokeWidth={2} />
              ) : (
                <Square size={13} strokeWidth={2} />
              )}
            </button>
            <button
              type="button"
              className="export-window-btn export-close-btn"
              aria-label="Close"
              onClick={onClose}
              disabled={exporting}
            >
              <X size={15} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Body: format sidebar + live preview */}
        <div className="export-dialog-body">
          <aside className="export-sidebar" aria-label="Export format">
            <div className="export-sidebar-header">Format</div>
            <div className="export-sidebar-list">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`export-sidebar-item ${format === f.id ? 'active' : ''}`}
                  aria-pressed={format === f.id}
                  onClick={() => setFormat(f.id)}
                  disabled={exporting}
                >
                  <span className="export-sidebar-item-icon">{f.icon}</span>
                  <span className="export-sidebar-item-text">
                    <span className="export-sidebar-item-label">{f.label}</span>
                    <span className="export-sidebar-item-desc">{f.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <div className="export-content">
            <div className="export-dialog-preview">
              {!hasContent ? (
                <div className="export-preview-empty">
                  <AlertTriangle size={20} />
                  <p>There is no content to export.</p>
                </div>
              ) : (
                <div className="export-preview-wrap">
                  {previewHtml ? (
                    <iframe
                      className="export-preview-frame"
                      title="Export preview"
                      // sandbox allows the preview to render (and run mermaid) without
                      // granting it access to the parent document or Node APIs.
                      sandbox="allow-scripts"
                      srcDoc={previewHtml}
                    />
                  ) : !previewLoading ? (
                    <div className="export-preview-empty">
                      <AlertTriangle size={20} />
                      <p>{previewError || 'Preview unavailable. You can still export below.'}</p>
                    </div>
                  ) : null}
                  {previewLoading && (
                    <div className="export-preview-loading" aria-live="polite">
                      <Loader2 size={22} className="spin" />
                      <span>Generating preview…</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="export-dialog-footer">
              <p className="export-dialog-description">
                {activeFormat.description}
                {previewError && <span className="export-preview-warning"> {previewError}</span>}
              </p>
              <div className="export-dialog-actions">
                <span className="export-footer-hint" aria-hidden="true">
                  Ctrl + Enter
                </span>
                <button
                  type="button"
                  className="btn export-cancel-btn"
                  onClick={onClose}
                  disabled={exporting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary export-confirm-btn"
                  onClick={handleExport}
                  disabled={exporting || !hasContent}
                  autoFocus
                >
                  {exporting ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                  <span>{exporting ? 'Exporting…' : activeFormat.acceptLabel}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default React.memo(ExportDialog)
