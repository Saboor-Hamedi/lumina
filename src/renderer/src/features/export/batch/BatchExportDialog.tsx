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
  Maximize2,
  Minimize2,
  ChevronDown,
  FileText,
  Check,
  ArrowLeft
} from 'lucide-react'
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
    if (mode === 'separate') {
      const activeNote = list[selectedNoteIndex] || list[0]
      return activeNote.content ?? activeNote.code ?? ''
    }
    return list
      .map((n) => (n.content ?? n.code ?? '').trim())
      .filter(Boolean)
      .join('\n\n\n')
  }, [notes, mode, selectedNoteIndex])

  const [includeToc, setIncludeToc] = useState(true)
  const [previewData, setPreviewData] = useState<{ html: string; pdfBase64?: string }>({ html: '' })
  const previewCacheRef = useRef<Map<string, { html: string; pdfBase64?: string }>>(new Map())

  // Reset transient state each time the dialog opens.
  useEffect(() => {
    if (isOpen) {
      setFormat(initialFormat)
      setMode('combined')
      setIsMaximized(false)
      setShowNotesList(false)
      setSelectedNoteIndex(0)
      setIncludeToc(true)
      setExporting(false)
      setProgress(null)
      setResult(null)
      setError(null)
      setCopied(false)
      previewCacheRef.current.clear()
    }
  }, [isOpen, initialFormat])

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

    const cacheKey = `${format}:${mode}:${mode === 'separate' ? selectedNoteIndex : 'all'}:${includeToc ? 'toc' : 'notoc'}`
    if (previewCacheRef.current.has(cacheKey)) {
      setPreviewData(previewCacheRef.current.get(cacheKey)!)
      setPreviewLoading(false)
      return
    }

    const requestId = ++requestIdRef.current
    setPreviewLoading(true)

    const previewTitle =
      mode === 'combined'
        ? folderName || 'Combined Export'
        : notes?.[selectedNoteIndex]?.title || notes?.[0]?.title || 'Untitled'

    const payloadNotes =
      mode === 'combined'
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
      const otherKey = `${f}:${mode}:${mode === 'separate' ? selectedNoteIndex : 'all'}:${includeToc ? 'toc' : 'notoc'}`
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
    const method = mode === 'combined' ? 'exportCombined' : 'exportBatch'
    if (typeof api?.[method] !== 'function') {
      const msg =
        mode === 'combined'
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
      const res = await api[method]({
        notes: payloadNotes,
        format,
        toc: includeToc,
        title: folderName
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
  }, [notes, format, mode, showToast])

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
          className="export-header"
          onDoubleClick={() => setIsMaximized((prev) => !prev)}
        >
          <div className="export-header-left">
            <span className="export-header-badge">
              <Download size={14} strokeWidth={2} />
            </span>
            <div className="export-header-titles">
              <span className="export-header-title">Batch Export</span>
              <span className="export-header-subtitle">
                {count} {count === 1 ? 'note' : 'notes'} selected
                {mode === 'separate' && notes[selectedNoteIndex] && (
                  <> &bull; Previewing: {notes[selectedNoteIndex]?.title || 'Untitled'}</>
                )}
              </span>
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

        {result ? (
          <div className="export-success" data-testid="batch-export-success">
            <div className="export-success-icon">
              <CheckCircle2 size={44} strokeWidth={1.5} />
            </div>
            <h3 className="export-success-headline">Export complete!</h3>
            <p className="export-success-detail">
              {result.combined
                ? `Merged ${result.total} notes into one ${format.toUpperCase()} file.`
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
            <div className="export-body">
              <aside className="export-formats" aria-label="Export options">
                {/* Note Source Details Chip (Identical to ExportContainer) */}
                <div className="export-source-card">
                  <div className="export-source-card-top">
                    <FileText size={13} className="export-source-icon" />
                    <span className="export-source-title">{count} Notes Selected</span>
                  </div>
                  <div className="export-source-stats">
                    <span>{noteStats.words} words</span>
                    <span>&bull;</span>
                    <span>{noteStats.chars} chars</span>
                  </div>
                </div>

                {/* Destination Mode Segmented Control */}
                <span className="export-formats-heading">Destination Mode</span>
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
                    <span>Merged File</span>
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
                    <span>Separate Files</span>
                  </button>
                </div>

                {/* Collapsible Included Notes Drawer */}
                <div className="batch-notes-drawer">
                  <button
                    type="button"
                    className="batch-notes-drawer-toggle"
                    onClick={() => setShowNotesList((prev) => !prev)}
                    aria-expanded={showNotesList}
                  >
                    <span className="batch-notes-toggle-left">
                      <FileText size={13} className="batch-notes-icon" />
                      <span>Included Notes</span>
                      <span className="batch-notes-count-badge">{count}</span>
                    </span>
                    <ChevronDown
                      size={14}
                      className={`batch-chevron ${showNotesList ? 'expanded' : ''}`}
                    />
                  </button>

                  {showNotesList && (
                    <div className="batch-notes-list">
                      {notes.map((n, idx) => {
                        const isViewing = mode === 'separate' && selectedNoteIndex === idx
                        return (
                          <button
                            key={n.id || idx}
                            type="button"
                            className={`batch-note-row ${isViewing ? 'active' : ''}`}
                            onClick={() => {
                              if (mode === 'separate') setSelectedNoteIndex(idx)
                            }}
                            title={
                              mode === 'separate'
                                ? `Click to preview "${n.title || 'Untitled'}"`
                                : n.title || 'Untitled'
                            }
                          >
                            <span className="batch-note-row-idx">{idx + 1}</span>
                            <span className="batch-note-row-title">{n.title || 'Untitled'}</span>
                            {isViewing && (
                              <span className="batch-note-row-pill">Previewing</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
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
                <PreviewComponent
                  html={previewData.html}
                  pdfBase64={previewData.pdfBase64}
                  title={mode === 'separate' ? activeNoteTitle : folderName}
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
