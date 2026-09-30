import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Download,
  Loader2,
  CheckCircle2,
  FolderOpen,
  FileDown,
  RotateCcw,
  Copy
} from 'lucide-react'
import { EXPORT_FORMATS, getFormat, type ExportFormat } from './formats'
import { PREVIEW_COMPONENTS } from './previews'
import './css/exportContainer.css'

/** CSS custom properties read from the app to theme the preview iframe. */
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

/** Reads the app's resolved theme tokens so the preview matches the UI. */
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

export interface ExportContainerProps {
  isOpen: boolean
  title: string
  content: string
  initialFormat?: ExportFormat
  onClose: () => void
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void
}

interface SuccessState {
  filePath: string
  format: ExportFormat
}

/**
 * ExportContainer
 *
 * The single-note export studio. A left rail of rich format cards drives a live
 * preview on the right, with a polished post-export success panel offering
 * "Open file", "Open folder" and "Export again".
 */
export const ExportContainer: React.FC<ExportContainerProps> = ({
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
  const [success, setSuccess] = useState<SuccessState | null>(null)
  const [copied, setCopied] = useState(false)
  const requestIdRef = useRef(0)

  const activeFormat = useMemo(() => getFormat(format), [format])
  const PreviewComponent = PREVIEW_COMPONENTS[format]

  // Reset everything each time the container opens.
  useEffect(() => {
    if (!isOpen) return
    setFormat(initialFormat)
    setPreviewError(null)
    setSuccess(null)
    setExporting(false)
    setCopied(false)
  }, [isOpen, initialFormat])

  // Clear the previous result when the format changes so you can export again.
  useEffect(() => {
    setSuccess(null)
  }, [format])

  // Generate the preview whenever the dialog opens or the format changes.
  useEffect(() => {
    if (!isOpen || success) return
    if (!content) {
      setPreviewHtml('')
      setPreviewError(null)
      return
    }

    const api = (window as any).api
    if (!api?.exportPreview) {
      setPreviewLoading(false)
      setPreviewHtml('')
      setPreviewError('Preview is unavailable in this build.')
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
        if (requestId !== requestIdRef.current) return
        if (!res || typeof res.html !== 'string') {
          throw new Error('Preview generation returned no content')
        }
        setPreviewHtml(res.html)
        if (res.truncated) {
          setPreviewError('Preview truncated for performance; the exported file is complete.')
        }
      } catch (err: any) {
        if (requestId !== requestIdRef.current) return
        console.error('[ExportContainer] Preview failed:', err)
        setPreviewError(err?.message || 'Failed to generate preview.')
      } finally {
        if (requestId === requestIdRef.current) setPreviewLoading(false)
      }
    }, 220)

    return () => clearTimeout(handle)
  }, [isOpen, format, title, content, success])

  const handleExport = useCallback(async () => {
    const api = (window as any).api
    const handler = api?.[activeFormat.apiKey]
    if (typeof handler !== 'function') {
      const msg = `${activeFormat.label} export is not supported in this environment.`
      setPreviewError(msg)
      showToast?.(msg, 'error')
      return
    }

    setExporting(true)
    try {
      const res = await handler({ title, content, language: 'markdown' })
      if (res?.success) {
        setSuccess({ filePath: res.filePath || '', format })
        showToast?.(`${activeFormat.label} exported successfully.`, 'success')
      } else if (res?.canceled) {
        // User dismissed the native save dialog; keep the preview open.
      } else if (res?.error) {
        showToast?.(`Failed to export ${activeFormat.label}: ${res.error}`, 'error')
      }
    } catch (err: any) {
      console.error('[ExportContainer] Export failed:', err)
      showToast?.(
        `Failed to export ${activeFormat.label}: ${err?.message || 'Unknown error'}`,
        'error'
      )
    } finally {
      setExporting(false)
    }
  }, [activeFormat, title, content, format, showToast])

  const handleCopyPath = useCallback(async () => {
    if (!success?.filePath) return
    try {
      await navigator.clipboard.writeText(success.filePath)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }, [success])

  const handleOpenFile = useCallback(() => {
    if (success?.filePath) (window as any).api?.openPath?.(success.filePath)
  }, [success])

  const handleOpenFolder = useCallback(() => {
    if (success?.filePath) (window as any).api?.showItemInFolder?.(success.filePath)
  }, [success])

  const handleExportAgain = useCallback(() => {
    setSuccess(null)
  }, [])

  // Escape to close (unless mid-export).
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !exporting) {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !exporting && !success) {
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
  }, [isOpen, exporting, success, onClose, handleExport])

  if (!isOpen || typeof document === 'undefined') return null

  const hasContent = Boolean(content && content.trim().length > 0)

  return createPortal(
    <div className="export-overlay" role="presentation" onClick={exporting ? undefined : onClose}>
      <div
        className="export-container"
        role="dialog"
        aria-modal="true"
        aria-label="Export"
        data-testid="export-container"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="export-header">
          <div className="export-header-left">
            <span className="export-header-badge">
              <Download size={14} strokeWidth={2} />
            </span>
            <div className="export-header-titles">
              <span className="export-header-title">Export</span>
              <span className="export-header-subtitle">{title || 'Untitled'}</span>
            </div>
          </div>
          <button
            type="button"
            className="export-close"
            aria-label="Close"
            onClick={onClose}
            disabled={exporting}
          >
            <X size={16} />
          </button>
        </header>

        {success ? (
          <div className="export-success" data-testid="export-success">
            <div className="export-success-icon">
              <CheckCircle2 size={44} strokeWidth={1.5} />
            </div>
            <h3 className="export-success-headline">Export complete!</h3>
            <p className="export-success-detail">
              Saved <strong>{title || 'Untitled'}</strong> as {getFormat(success.format).title}.
            </p>

            {success.filePath && (
              <div className="export-success-path">
                <span className="export-success-path-text" title={success.filePath}>
                  {success.filePath}
                </span>
                <button
                  type="button"
                  className="export-success-copy"
                  onClick={handleCopyPath}
                  aria-label="Copy path"
                >
                  {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                </button>
              </div>
            )}

            <div className="export-success-actions">
              <button type="button" className="export-btn" onClick={handleOpenFile}>
                <FileDown size={15} />
                <span>Open file</span>
              </button>
              <button type="button" className="export-btn" onClick={handleOpenFolder}>
                <FolderOpen size={15} />
                <span>Open folder</span>
              </button>
              <button type="button" className="export-btn" onClick={handleExportAgain}>
                <RotateCcw size={15} />
                <span>Export again</span>
              </button>
            </div>

            <button type="button" className="export-btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="export-body">
              <aside className="export-formats" aria-label="Export format">
                <span className="export-formats-heading">Format</span>
                {EXPORT_FORMATS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`export-format-card ${format === f.id ? 'active' : ''}`}
                    style={format === f.id ? { borderColor: f.accent } : undefined}
                    aria-pressed={format === f.id}
                    onClick={() => setFormat(f.id)}
                    disabled={exporting}
                  >
                    <span className="export-format-icon" style={{ color: f.accent }}>
                      {f.icon}
                    </span>
                    <span className="export-format-text">
                      <span className="export-format-title">{f.title}</span>
                      <span className="export-format-desc">{f.description}</span>
                    </span>
                  </button>
                ))}
              </aside>

              <section className="export-preview-pane" aria-label="Preview">
                {hasContent ? (
                  <PreviewComponent
                    html={previewHtml}
                    loading={previewLoading}
                    error={previewError}
                  />
                ) : (
                  <div className="export-preview-empty">
                    <p>There is no content to export.</p>
                  </div>
                )}
              </section>
            </div>

            <footer className="export-footer">
              <button
                type="button"
                className="export-btn-ghost"
                onClick={onClose}
                disabled={exporting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="export-btn-primary"
                onClick={handleExport}
                disabled={exporting || !hasContent}
                autoFocus
                title={!hasContent ? 'There is nothing to export' : undefined}
              >
                {exporting ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
                <span>{exporting ? 'Exporting…' : activeFormat.acceptLabel}</span>
              </button>
            </footer>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

export default React.memo(ExportContainer)
