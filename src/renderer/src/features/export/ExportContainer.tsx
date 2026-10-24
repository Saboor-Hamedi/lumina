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
  Square,
  PanelLeftClose,
  PanelLeftOpen,
  FileText,
  ArrowLeft
} from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [includeToc, setIncludeToc] = useState(true)
  const [bundleAssets, setBundleAssets] = useState(false)
  const [compressZip, setCompressZip] = useState(false)
  const [optimizeImages, setOptimizeImages] = useState(true)
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
    setIsSidebarOpen(true)
    setIncludeToc(true)
    setBundleAssets(false)
    setCompressZip(false)
    setOptimizeImages(true)
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
    const isZip = format === 'zip'
    const isBundle = isZip || (format === 'markdown' && (bundleAssets || compressZip))
    const apiKey = isZip
      ? (typeof api?.exportZip === 'function' ? 'exportZip' : 'exportMarkdownBundle')
      : isBundle
        ? 'exportMarkdownBundle'
        : activeFormat.apiKey
    const handler = api?.[apiKey]
    if (typeof handler !== 'function') {
      const msg = `${activeFormat.label} export is not supported in this environment.`
      setPreviewError(msg)
      showToast?.(msg, 'error')
      return
    }

    setExporting(true)
    try {
      const res = await handler({
        title,
        content,
        language: 'markdown',
        toc: includeToc,
        compressZip: isZip || (format === 'markdown' && compressZip),
        optimizeImages
      })
      if (res?.success) {
        setSuccess({ filePath: res.filePath || '', format })
        const label = isZip || compressZip
          ? 'ZIP archive'
          : bundleAssets
            ? 'Markdown bundle'
            : activeFormat.label
        showToast?.(`${label} exported successfully.`, 'success')
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
  }, [
    activeFormat,
    title,
    content,
    format,
    includeToc,
    bundleAssets,
    compressZip,
    optimizeImages,
    showToast
  ])

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
          className="export-header docs-modal-header"
          onDoubleClick={() => setIsMaximized((prev) => !prev)}
          style={{ cursor: 'default' }}
        >
          <div className="docs-header-left export-header-left">
            <ToolTip text={isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'} position="bottom">
              <button
                type="button"
                className="docs-sidebar-toggle-btn export-sidebar-toggle-btn"
                onClick={() => setIsSidebarOpen((prev) => !prev)}
                aria-label={isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
              >
                {isSidebarOpen ? (
                  <PanelLeftClose size={15} strokeWidth={2} />
                ) : (
                  <PanelLeftOpen size={15} strokeWidth={2} />
                )}
              </button>
            </ToolTip>
            <span className="export-header-title">Export</span>
            {title && (
              <>
                <span className="export-header-divider">/</span>
                <span className="export-header-subtitle" title={title}>
                  {title}
                </span>
              </>
            )}
          </div>

          <div className="docs-header-right export-header-right export-header-actions">
            <ToolTip text={`${noteStats.words} words • ${noteStats.chars} chars`} position="bottom">
              <div className="docs-header-stat export-header-stat">
                <FileText size={12} />
                <span>{noteStats.words} words</span>
              </div>
            </ToolTip>
            <ToolTip text={isMaximized ? 'Restore Window' : 'Maximize Window'} position="bottom">
              <button
                type="button"
                className="docs-window-btn export-icon-btn export-maximize"
                onClick={() => setIsMaximized((prev) => !prev)}
                aria-label={isMaximized ? 'Restore Window' : 'Maximize Window'}
              >
                {isMaximized ? (
                  <Copy size={13} strokeWidth={2} />
                ) : (
                  <Square size={13} strokeWidth={2} />
                )}
              </button>
            </ToolTip>
            <ToolTip text="Close (Esc)" position="bottom">
              <button
                type="button"
                className="guide-close-btn export-close"
                onClick={onClose}
                disabled={exporting}
                aria-label="Close Export (Esc)"
              >
                <X size={15} />
              </button>
            </ToolTip>
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
            <div className={`export-body ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
              {isSidebarOpen && (
                <aside className="export-formats" aria-label="Export format">
                {/* Options / Toggle switches at the TOP */}
                <div className="export-options-group">
                  <span className="export-formats-heading">Options</span>

                  {(format === 'pdf' || format === 'docs' || format === 'html') && (
                    <div className="export-option-row" onClick={() => setIncludeToc((prev) => !prev)}>
                      <div className="export-option-label">
                        <span className="export-option-title">Table of Contents</span>
                      </div>
                      <Toggle
                        checked={includeToc}
                        onCheckedChange={setIncludeToc}
                        disabled={exporting}
                        ariaLabel="Include Table of Contents"
                      />
                    </div>
                  )}

                  {format === 'markdown' && (
                    <>
                      <div className="export-option-row" onClick={() => setBundleAssets((prev) => !prev)}>
                        <div className="export-option-label">
                          <span className="export-option-title">Bundle Media</span>
                        </div>
                        <Toggle
                          checked={bundleAssets}
                          onCheckedChange={(checked) => {
                            setBundleAssets(checked)
                            if (!checked) setCompressZip(false)
                          }}
                          disabled={exporting}
                          ariaLabel="Bundle Referenced Media"
                        />
                      </div>

                      {bundleAssets && (
                        <div className="export-option-row" onClick={() => setCompressZip((prev) => !prev)}>
                          <div className="export-option-label">
                            <span className="export-option-title">Compress as ZIP</span>
                          </div>
                          <Toggle
                            checked={compressZip}
                            onCheckedChange={setCompressZip}
                            disabled={exporting}
                            ariaLabel="Compress as ZIP Archive"
                          />
                        </div>
                      )}
                    </>
                  )}

                  {(format === 'pdf' ||
                    format === 'docs' ||
                    format === 'html' ||
                    format === 'zip' ||
                    (format === 'markdown' && bundleAssets)) && (
                    <div className="export-option-row" onClick={() => setOptimizeImages((prev) => !prev)}>
                      <div className="export-option-label">
                        <span className="export-option-title">Optimize Images</span>
                      </div>
                      <Toggle
                        checked={optimizeImages}
                        onCheckedChange={setOptimizeImages}
                        disabled={exporting}
                        ariaLabel="Optimize Images"
                      />
                    </div>
                  )}
                </div>

                <span className="export-formats-heading">Formats</span>
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
                      <span className="export-format-title">{f.title}</span>
                      <span className="export-format-ext-pill">{f.ext}</span>
                    </span>
                  </button>
                ))}
              </aside>
              )}
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
                <span>
                  {exporting
                    ? 'Exporting…'
                    : compressZip
                      ? 'Export as ZIP Archive'
                      : activeFormat.acceptLabel}
                </span>
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
