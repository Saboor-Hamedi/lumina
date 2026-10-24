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
  Layers,
  Files,
  Copy,
  Square,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  FileText,
  Check,
  ArrowLeft,
  Archive
} from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'
import { EXPORT_FORMATS, getFormat, type ExportFormat } from '../formats'
import { PREVIEW_COMPONENTS } from '../previews'
import Toggle from '../../../components/toggle/Toggle'
import '../css/exportContainer.css'
import '../css/batchExportDialog.css'

export type BatchFormat = ExportFormat
/** 'combined' = one merged file; 'separate' = one file per note. */
export type BatchMode = 'combined' | 'separate'

export interface BatchNote {
  id?: string
  title?: string
  code?: string
  content?: string
}

export interface BatchExportDialogProps {
  isOpen: boolean
  notes: BatchNote[]
  /** Optional folder or collection name used for the combined document title */
  folderName?: string
  /** Format preselected when the dialog opens. Defaults to PDF. */
  initialFormat?: BatchFormat
  onClose: () => void
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void
}

interface ProgressState {
  current: number
  total: number
  title: string
  phase: string
}

interface BatchResult {
  outputDir?: string
  filePath?: string
  total: number
  exported: number
  failed: number
  combined?: boolean
}

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

import { getTheme } from '../../theme/hooks/themeDefinitions'

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

/**
 * BatchExportDialog
 *
 * Exports many selected notes at once. The mode cards make the core decision
 * (merge into one vs separate files) intentional; a live preview shows the
 * resulting document for the chosen format/mode. Supports window maximizing,
 * an included notes inspector, and per-note preview in separate mode.
 */
export const BatchExportDialog: React.FC<BatchExportDialogProps> = ({
  isOpen,
  notes,
  folderName = 'Combined Export',
  initialFormat = 'pdf',
  onClose,
  showToast
}) => {
  const [format, setFormat] = useState<BatchFormat>(initialFormat)
  const [mode, setMode] = useState<BatchMode>('combined')
  const [isMaximized, setIsMaximized] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [showNotesList, setShowNotesList] = useState(false)
  const [selectedNoteIndex, setSelectedNoteIndex] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [result, setResult] = useState<BatchResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [themeTick, setThemeTick] = useState(0)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    const onThemeChange = () => {
      previewCacheRef.current.clear()
      setThemeTick((t) => t + 1)
    }
    window.addEventListener('theme-changed', onThemeChange)
    return () => window.removeEventListener('theme-changed', onThemeChange)
  }, [])

  const count = notes?.length || 0
  const activeFormat = useMemo(() => getFormat(format), [format])
  const PreviewComponent = PREVIEW_COMPONENTS[format]

  // Notes statistics
  const noteStats = useMemo(() => {
    let words = 0
    let chars = 0
    for (const n of notes || []) {
      const text = (n.content ?? n.code ?? '').trim()
      if (text) {
        words += text.split(/\s+/).filter(Boolean).length
        chars += text.length
      }
    }
    return { words, chars }
  }, [notes])

  // Markdown used to preview the merge (or the active note for "separate").
  const previewMarkdown = useMemo(() => {
    const list = notes || []
    if (list.length === 0) return ''
    if (mode === 'separate' || format === 'zip') {
      const activeNote = list[selectedNoteIndex] || list[0]
      return activeNote.content ?? activeNote.code ?? ''
    }
    return list
      .map((n) => (n.content ?? n.code ?? '').trim())
      .filter(Boolean)
      .join('\n\n\n')
  }, [notes, mode, format, selectedNoteIndex])

  const activeNoteTitle = useMemo(() => {
    return notes?.[selectedNoteIndex]?.title || notes?.[0]?.title || 'Untitled'
  }, [notes, selectedNoteIndex])

  const [includeToc, setIncludeToc] = useState(true)
  const [compressZip, setCompressZip] = useState(false)
  const [previewData, setPreviewData] = useState<{ html: string; pdfBase64?: string }>({ html: '' })
  const previewCacheRef = useRef<Map<string, { html: string; pdfBase64?: string }>>(new Map())

  // Reset transient state each time the dialog opens.
  useEffect(() => {
    if (isOpen) {
      setFormat(initialFormat)
      setMode(initialFormat === 'zip' ? 'separate' : 'combined')
      setIsMaximized(false)
      setShowNotesList(false)
      setSelectedNoteIndex(0)
      setIncludeToc(true)
      setCompressZip(false)
      setExporting(false)
      setProgress(null)
      setResult(null)
      setError(null)
      setCopied(false)
      previewCacheRef.current.clear()
    }
  }, [isOpen, initialFormat])

  // When format is 'zip', destination mode is always strictly 'separate'
  useEffect(() => {
    if (format === 'zip' && mode !== 'separate') {
      setMode('separate')
    }
  }, [format, mode])

  // Changing format or mode clears the previous result so you can export again.
  useEffect(() => {
    setResult(null)
    setError(null)
    setProgress(null)
  }, [format, mode])

  // Live preview of the resulting document with instant cache switching.
  useEffect(() => {
    if (!isOpen || result) return
    const api = (window as any).api
    if (!api?.exportPreview || !previewMarkdown) {
      setPreviewData({ html: '' })
      return
    }

    const isSeparate = mode === 'separate' || format === 'zip'
    const cacheKey = `${format}:${isSeparate ? 'separate' : 'combined'}:${isSeparate ? selectedNoteIndex : 'all'}:${includeToc ? 'toc' : 'notoc'}`
    if (previewCacheRef.current.has(cacheKey)) {
      setPreviewData(previewCacheRef.current.get(cacheKey)!)
      setPreviewLoading(false)
      return
    }

    const requestId = ++requestIdRef.current
    setPreviewLoading(true)

    const previewTitle =
      !isSeparate
        ? folderName || 'Combined Export'
        : notes?.[selectedNoteIndex]?.title || notes?.[0]?.title || 'Untitled'

    const payloadNotes =
      !isSeparate
        ? (notes || []).map((n) => ({
            id: n.id,
            title: n.title || 'Untitled',
            content: n.content ?? n.code ?? ''
          }))
        : undefined

    let isMounted = true

    api.exportPreview({
      format,
      title: previewTitle,
      content: previewMarkdown,
      theme: readThemeTokens(),
      toc: includeToc,
      notes: payloadNotes
    }).then((res: any) => {
      if (!isMounted || requestId !== requestIdRef.current) return
      if (res && typeof res.html === 'string') {
        const data = { html: res.html }
        previewCacheRef.current.set(cacheKey, data)
        setPreviewData(data)
      }
      setPreviewLoading(false)
    }).catch(() => {
      if (!isMounted || requestId !== requestIdRef.current) return
      setPreviewLoading(false)
    })

    // Pre-warm remaining formats for instant 0ms switching
    const otherFormats: BatchFormat[] = (['pdf', 'docs', 'html', 'markdown', 'text'] as BatchFormat[]).filter(
      (f) => f !== format
    )
    for (const f of otherFormats) {
      const otherKey = `${f}:${isSeparate ? 'separate' : 'combined'}:${isSeparate ? selectedNoteIndex : 'all'}:${includeToc ? 'toc' : 'notoc'}`
      if (!previewCacheRef.current.has(otherKey)) {
        api.exportPreview({
          format: f,
          title: previewTitle,
          content: previewMarkdown,
          theme: readThemeTokens(),
          toc: includeToc,
          notes: payloadNotes
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
  }, [isOpen, format, mode, previewMarkdown, result, notes, selectedNoteIndex, includeToc, folderName, themeTick])

  // Subscribe to batch progress while exporting.
  useEffect(() => {
    if (!isOpen) return
    const api = (window as any).api
    if (api?.onBatchExportProgress) {
      unsubscribeRef.current = api.onBatchExportProgress((p: any) => {
        if (!p || p.phase === 'complete') return
        setProgress({
          current: p.current ?? 0,
          total: p.total ?? count,
          title: p.title ?? '',
          phase: p.phase ?? ''
        })
      })
    }
    return () => {
      unsubscribeRef.current?.()
      unsubscribeRef.current = null
    }
  }, [isOpen, count])

  const handleStart = useCallback(async () => {
    const api = (window as any).api
    const isZip = format === 'zip' || (mode === 'separate' && compressZip)
    const method = isZip ? 'exportBatch' : mode === 'combined' ? 'exportCombined' : 'exportBatch'
    if (typeof api?.[method] !== 'function') {
      const msg =
        mode === 'combined' && !isZip
          ? 'Combined export is unavailable in this build. Restart/rebuild the app and try again.'
          : 'Batch export is unavailable in this environment.'
      setError(msg)
      showToast?.(msg, 'error')
      return
    }

    const payloadNotes = (notes || []).map((n) => ({
      id: n.id,
      title: n.title || 'Untitled',
      content: n.content ?? n.code ?? ''
    }))
    if (payloadNotes.length === 0) {
      setError('No notes selected.')
      return
    }

    setExporting(true)
    setError(null)
    setResult(null)
    setProgress({ current: 0, total: payloadNotes.length, title: '', phase: 'start' })

    try {
      const isZip = format === 'zip' || (mode === 'separate' && compressZip)
      const res = await api[method]({
        notes: payloadNotes,
        format: format === 'zip' ? 'markdown' : format,
        toc: includeToc,
        title: payloadNotes.length === 1 ? payloadNotes[0].title || folderName || 'Untitled' : folderName,
        compressZip: isZip,
        archiveTitle: (payloadNotes.length === 1 ? payloadNotes[0].title : folderName) || 'Lumina-Notes'
      })
      if (res?.canceled) {
        setExporting(false)
        setProgress(null)
        return
      }
      if (res?.success) {
        setResult({
          outputDir: res.outputDir,
          filePath: res.filePath,
          total: res.total,
          exported: res.exported ?? res.total,
          failed: res.failed ?? 0,
          combined: Boolean(res.combined)
        })
        showToast?.(
          res.combined
            ? `Combined ${res.total} notes into one ${format.toUpperCase()}.`
            : res.isZip
              ? `Packaged ${res.exported ?? res.total} notes into ZIP archive.`
              : `Exported ${res.exported ?? res.total} notes successfully.`,
          'success'
        )
      } else {
        setError('Export did not complete.')
      }
    } catch (err: any) {
      console.error('[BatchExportDialog] Export failed:', err)
      setError(err?.message || 'Export failed.')
      showToast?.(`Export failed: ${err?.message || 'Unknown error'}`, 'error')
    } finally {
      setExporting(false)
    }
  }, [notes, format, mode, includeToc, compressZip, folderName, showToast])

  const handleCopyPath = useCallback(async () => {
    const p = result?.filePath || result?.outputDir
    if (!p) return
    try {
      await navigator.clipboard.writeText(p)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }, [result])

  const handleOpenFile = useCallback(() => {
    if (result?.filePath) (window as any).api?.openPath?.(result.filePath)
  }, [result])

  const handleOpenFolder = useCallback(() => {
    const p = result?.filePath || result?.outputDir
    if (p) (window as any).api?.showItemInFolder?.(p)
  }, [result])

  // Escape closes (unless mid-export).
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !exporting) {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [isOpen, exporting, onClose])

  const percent = useMemo(() => {
    if (!progress || progress.total <= 0) return 0
    return Math.round((progress.current / progress.total) * 100)
  }, [progress])

  if (!isOpen || typeof document === 'undefined') return null

  const resultPath = result?.filePath || result?.outputDir

  return createPortal(
    <div
      className={`export-overlay ${isMaximized ? 'is-maximized' : ''}`}
      role="presentation"
      onClick={exporting ? undefined : onClose}
    >
      <div
        className={`export-container batch-export-container ${isMaximized ? 'is-maximized' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Export notes"
        data-testid="batch-export-dialog"
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
            <span className="export-header-title">Batch Export</span>
            <span className="export-header-divider">/</span>
            <span className="export-header-subtitle">
              {count} {count === 1 ? 'note' : 'notes'}
              {folderName ? ` in ${folderName}` : ''}
            </span>
          </div>

          <div className="docs-header-right export-header-right export-header-actions">
            <ToolTip text={`${count} notes selected`} position="bottom">
              <div className="docs-header-stat export-header-stat">
                <Files size={12} />
                <span>{count} notes</span>
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

        {result ? (
          <div className="export-success" data-testid="batch-export-success">
            <div className="export-success-icon">
              <CheckCircle2 size={44} strokeWidth={1.5} />
            </div>
            <h3 className="export-success-headline">Export complete!</h3>
            <p className="export-success-detail">
              {result.combined
                ? `Merged ${result.total} notes into one ${format.toUpperCase()} file.`
                : result.filePath && result.filePath.toLowerCase().endsWith('.zip')
                  ? `Packaged all ${result.exported} notes as individual .md files into ZIP archive.`
                  : `Saved ${result.exported} of ${result.total} notes.`}
            </p>

            {resultPath && (
              <div className="export-success-path">
                <span className="export-success-path-text" title={resultPath}>
                  {resultPath}
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
              {result.filePath && (
                <button type="button" className="export-btn" onClick={handleOpenFile}>
                  <FileDown size={15} />
                  <span>Open file</span>
                </button>
              )}
              <button type="button" className="export-btn" onClick={handleOpenFolder}>
                <FolderOpen size={15} />
                <span>Open folder</span>
              </button>
              <button type="button" className="export-btn" onClick={() => setResult(null)}>
                <RotateCcw size={15} />
                <span>Export again</span>
              </button>
            </div>

            <div className="export-success-footer-actions">
              <button
                type="button"
                className="export-btn"
                onClick={() => setResult(null)}
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
                <aside className="export-formats" aria-label="Export options">
                {/* Options / Toggle switches at the TOP */}
                {((format === 'pdf' || format === 'docs' || format === 'html') || (mode === 'separate' && format !== 'zip')) && (
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
                    {mode === 'separate' && (format as string) !== 'zip' && (
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
                  </div>
                )}

                {/* Destination Mode Segmented Control or Archive Badge */}
                <span className="export-formats-heading">Destination Mode</span>
                {format !== 'zip' ? (
                  <div className="batch-mode-pills" role="radiogroup" aria-label="Export mode">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={mode === 'combined'}
                      className={`batch-mode-pill ${mode === 'combined' ? 'active' : ''}`}
                      onClick={() => setMode('combined')}
                      disabled={exporting}
                    >
                      <Layers size={13} strokeWidth={2} />
                      <span>Merged</span>
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={mode === 'separate'}
                      className={`batch-mode-pill ${mode === 'separate' ? 'active' : ''}`}
                      onClick={() => setMode('separate')}
                      disabled={exporting}
                    >
                      <Files size={13} strokeWidth={2} />
                      <span>Separate</span>
                    </button>
                  </div>
                ) : (
                  <div className="batch-zip-mode-badge">
                    <Archive size={14} strokeWidth={2} className="batch-zip-mode-icon" />
                    <div className="batch-zip-mode-content">
                      <span className="batch-zip-mode-title">ZIP Archive</span>
                    </div>
                  </div>
                )}

                <span className="export-formats-heading">Formats</span>
                {EXPORT_FORMATS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`export-format-card ${format === f.id ? 'active' : ''}`}
                    onClick={() => {
                      setFormat(f.id)
                      if (f.id === 'zip') {
                        setMode('separate')
                      }
                    }}
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
                <PreviewComponent
                  html={previewData.html}
                  pdfBase64={previewData.pdfBase64}
                  title={mode === 'separate' || format === 'zip' ? activeNoteTitle : folderName}
                  loading={previewLoading}
                  error={error}
                />
                {exporting && (
                  <div className="batch-progress" aria-live="polite">
                    <div className="batch-progress-label">
                      <span>{mode === 'combined' ? 'Merging notes…' : 'Exporting…'}</span>
                      <span>{percent}%</span>
                    </div>
                    <div
                      className="batch-progress-track"
                      role="progressbar"
                      aria-valuenow={percent}
                    >
                      <div className="batch-progress-fill" style={{ width: `${percent}%` }} />
                    </div>
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
                onClick={handleStart}
                disabled={exporting || count === 0}
                autoFocus
              >
                {exporting ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
                <span>
                  {exporting
                    ? 'Exporting…'
                    : format === 'zip' || (mode === 'separate' && compressZip)
                      ? `Export ${count} Notes as ZIP Archive`
                      : mode === 'combined'
                        ? `Export as ${format === 'docs' ? 'DOCX' : format.toUpperCase()}`
                        : `Export ${count} Files`}
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

export default React.memo(BatchExportDialog)
