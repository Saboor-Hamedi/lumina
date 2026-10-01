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
  Copy,
  Maximize2,
  Minimize2,
  FileText,
  ArrowLeft
} from 'lucide-react'
import { EXPORT_FORMATS, getFormat, type ExportFormat } from './formats'
import { PREVIEW_COMPONENTS } from './previews'
import Toggle from '../../components/toggle/Toggle'
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

import { getTheme } from '../theme/hooks/themeDefinitions'

/** Reads the app's resolved theme tokens so the preview matches the UI. */
function readThemeTokens(): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    const savedThemeId = (typeof localStorage !== 'undefined' && localStorage.getItem('theme-id')) || 'dark'
    const themeDef = getTheme(savedThemeId)
    if (themeDef?.colors) {
      for (const [key, val] of Object.entries(themeDef.colors)) {
        if (typeof val === 'string' && key.startsWith('--')) {
          out[key.replace(/^--/, '')] = val
        }
      }
    }
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const cs = getComputedStyle(document.documentElement)
      for (const key of PREVIEW_THEME_KEYS) {
        const value = cs.getPropertyValue(`--${key}`).trim()
        if (value) out[key] = value
      }
    }
  } catch {}
  return out
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
 * "Open file", "Open folder" and "Export again". Supports window maximizing.
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
  const [isMaximized, setIsMaximized] = useState(false)
  const [includeToc, setIncludeToc] = useState(true)
  const [previewData, setPreviewData] = useState<{ html: string; pdfBase64?: string }>({ html: '' })
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [success, setSuccess] = useState<SuccessState | null>(null)
  const [copied, setCopied] = useState(false)
  const [themeTick, setThemeTick] = useState(0)
  const requestIdRef = useRef(0)
  const previewCacheRef = useRef<Map<string, { html: string; pdfBase64?: string }>>(new Map())

  useEffect(() => {
    const onThemeChange = () => {
      previewCacheRef.current.clear()
      setThemeTick((t) => t + 1)
    }
    window.addEventListener('theme-changed', onThemeChange)
    return () => window.removeEventListener('theme-changed', onThemeChange)
  }, [])

  const activeFormat = useMemo(() => getFormat(format), [format])
  const PreviewComponent = PREVIEW_COMPONENTS[format]

  // Note statistics
  const noteStats = useMemo(() => {
    const text = content ? content.trim() : ''
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0
    const chars = text.length
    return { words, chars }
  }, [content])

  // Reset everything each time the container opens.
  useEffect(() => {
    if (!isOpen) return
    setFormat(initialFormat)
    setIsMaximized(false)
    setIncludeToc(true)
    setPreviewError(null)
    setSuccess(null)
    setExporting(false)
    setCopied(false)
    previewCacheRef.current.clear()
  }, [isOpen, initialFormat])

  // Clear the previous result when the format changes so you can export again.
  useEffect(() => {
    setSuccess(null)
  }, [format])

  // Generate the preview whenever the dialog opens, format changes, or TOC is toggled.
  useEffect(() => {
    if (!isOpen || success) return
    if (!content) {
      setPreviewData({ html: '' })
      setPreviewError(null)
      return
    }

    const cacheKey = `${format}:${includeToc ? 'toc' : 'notoc'}`
    if (previewCacheRef.current.has(cacheKey)) {
      setPreviewData(previewCacheRef.current.get(cacheKey)!)
      setPreviewLoading(false)
      setPreviewError(null)
      return
    }

    const api = (window as any).api
    if (!api?.exportPreview) {
      setPreviewLoading(false)
      setPreviewData({ html: '' })
      setPreviewError('Preview is unavailable in this build.')
      return
    }

    const requestId = ++requestIdRef.current
    setPreviewLoading(true)
    setPreviewError(null)

    let isMounted = true

    api.exportPreview({
      format,
      title,
      content,
      theme: readThemeTokens(),
      toc: includeToc
    }).then((res: any) => {
      if (!isMounted || requestId !== requestIdRef.current) return
      if (!res || typeof res.html !== 'string') {
        throw new Error('Preview generation returned no content')
      }
      const data = { html: res.html }
      previewCacheRef.current.set(cacheKey, data)
      setPreviewData(data)
      if (res.truncated) {
        setPreviewError('Preview truncated for performance; the exported file is complete.')
      }
      setPreviewLoading(false)
    }).catch((err: any) => {
      if (!isMounted || requestId !== requestIdRef.current) return
      console.error('[ExportContainer] Preview failed:', err)
      setPreviewError(err?.message || 'Failed to generate preview.')
      setPreviewLoading(false)
    })

    // Pre-warm remaining formats in background for zero-latency instant switching
    const otherFormats: ExportFormat[] = (['pdf', 'docs', 'html', 'markdown', 'text'] as ExportFormat[]).filter(
      (f) => f !== format
    )
    for (const f of otherFormats) {
      const otherKey = `${f}:${includeToc ? 'toc' : 'notoc'}`
      if (!previewCacheRef.current.has(otherKey)) {
        api.exportPreview({
          format: f,
          title,
          content,
          theme: readThemeTokens(),
          toc: includeToc
        }).then((res: any) => {
          if (res?.html) {
            previewCacheRef.current.set(otherKey, { html: res.html })
          }
        }).catch(() => {})
      }
    }

    return () => {
      isMounted = false
    }
  }, [isOpen, format, title, content, success, includeToc, themeTick])

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
      const res = await handler({ title, content, language: 'markdown', toc: includeToc })
      if (res?.success) {
        setSuccess({ filePath: res.filePath || '', format })
        showToast?.(`${activeFormat.label} exported successfully.`, 'success')
      } else if (!res?.canceled) {
        setPreviewError('Export did not complete.')
      }
    } catch (err: any) {
      console.error('[ExportContainer] Export error:', err)
      const msg = err?.message || 'Export failed.'
      setPreviewError(msg)
      showToast?.(`Export failed: ${msg}`, 'error')
    } finally {
      setExporting(false)
    }
  }, [activeFormat, title, content, format, includeToc, showToast])

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
    <div
      className={`export-overlay ${isMaximized ? 'is-maximized' : ''}`}
      role="presentation"
      onClick={exporting ? undefined : onClose}
    >
      <div
        className={`export-container ${isMaximized ? 'is-maximized' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Export"
        data-testid="export-container"
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className="export-header"
          onDoubleClick={() => setIsMaximized((prev) => !prev)}
        >
          <div className="export-header-left">
            <span className="export-header-badge">
              <Download size={14} strokeWidth={2} />
            </span>
            <div className="export-header-titles">
              <span className="export-header-title">Export</span>
              <span className="export-header-subtitle">{title || 'Untitled'}</span>
            </div>
          </div>

          <div className="export-header-actions">
            <button
              type="button"
              className="export-icon-btn export-maximize"
              aria-label={isMaximized ? 'Restore down' : 'Maximize'}
              title={isMaximized ? 'Restore down' : 'Maximize'}
              onClick={() => setIsMaximized((prev) => !prev)}
            >
              {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            <button
              type="button"
              className="export-close"
              aria-label="Close"
              onClick={onClose}
              disabled={exporting}
            >
              <X size={16} />
            </button>
          </div>
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

            <div className="export-success-footer-actions">
              <button
                type="button"
                className="export-btn"
                onClick={handleExportAgain}
                aria-label="Go back to options"
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
              <button type="button" className="export-btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="export-body">
              <aside className="export-formats" aria-label="Export format">
                {/* Note Source Details Chip */}
                <div className="export-source-card">
                  <div className="export-source-card-top">
                    <FileText size={13} className="export-source-icon" />
                    <span className="export-source-title">{title || 'Untitled'}</span>
                  </div>
                  <div className="export-source-stats">
                    <span>{noteStats.words} words</span>
                    <span>&bull;</span>
                    <span>{noteStats.chars} chars</span>
                  </div>
                </div>

                <span className="export-formats-heading">Available Formats</span>
                {EXPORT_FORMATS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`export-format-card ${format === f.id ? 'active' : ''}`}
                    aria-pressed={format === f.id}
                    onClick={() => setFormat(f.id)}
                    disabled={exporting}
                    style={{ '--card-accent': f.accent } as React.CSSProperties}
                  >
                    <span
                      className="export-format-icon"
                      style={{ color: format === f.id ? f.accent : 'var(--text-muted)' }}
                    >
                      {f.icon}
                    </span>
                    <span className="export-format-text">
                      <span className="export-format-title-row">
                        <span className="export-format-title">{f.title}</span>
                        <span className="export-format-ext-pill">{f.ext}</span>
                      </span>
                      <span className="export-format-desc">{f.description}</span>
                    </span>
                  </button>
                ))}

                {(format === 'pdf' || format === 'docs' || format === 'html') && (
                  <div className="export-options-group">
                    <span className="export-formats-heading">Options</span>
                    <div className="export-option-row" onClick={() => setIncludeToc((prev) => !prev)}>
                      <div className="export-option-label">
                        <span className="export-option-title">Include Table of Contents</span>
                        <span className="export-option-desc">Add navigation index at start</span>
                      </div>
                      <Toggle
                        checked={includeToc}
                        onCheckedChange={setIncludeToc}
                        disabled={exporting}
                        ariaLabel="Include Table of Contents"
                      />
                    </div>
                  </div>
                )}
              </aside>

              <section className="export-preview-pane" aria-label="Preview">
                {hasContent ? (
                  <PreviewComponent
                    html={previewData.html}
                    pdfBase64={previewData.pdfBase64}
                    title={title}
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
