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
  Copy
} from 'lucide-react'
import { EXPORT_FORMATS, getFormat, type ExportFormat } from '../formats'
import { PREVIEW_COMPONENTS } from '../previews'
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

/**
 * BatchExportDialog
 *
 * Exports many selected notes at once. The mode cards make the core decision
 * (merge into one vs separate files) intentional; a live preview shows the
 * resulting document for the chosen format/mode.
 */
export const BatchExportDialog: React.FC<BatchExportDialogProps> = ({
  isOpen,
  notes,
  initialFormat = 'pdf',
  onClose,
  showToast
}) => {
  const [format, setFormat] = useState<BatchFormat>(initialFormat)
  const [mode, setMode] = useState<BatchMode>('combined')
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [result, setResult] = useState<BatchResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const requestIdRef = useRef(0)

  const count = notes?.length || 0
  const activeFormat = useMemo(() => getFormat(format), [format])
  const PreviewComponent = PREVIEW_COMPONENTS[format]

  // Markdown used to preview the merge (or the first note for "separate").
  const previewMarkdown = useMemo(() => {
    const list = notes || []
    if (list.length === 0) return ''
    if (mode === 'separate') {
      const n = list[0]
      return `# ${n.title || 'Untitled'}\n\n${n.content ?? n.code ?? ''}`
    }
    return list
      .map((n) => `# ${n.title || 'Untitled'}\n\n${n.content ?? n.code ?? ''}`)
      .join('\n\n---\n\n')
  }, [notes, mode])

  // Reset transient state each time the dialog opens.
  useEffect(() => {
    if (isOpen) {
      setFormat(initialFormat)
      setMode('combined')
      setExporting(false)
      setProgress(null)
      setResult(null)
      setError(null)
      setCopied(false)
    }
  }, [isOpen, initialFormat])

  // Changing format or mode clears the previous result so you can export again.
  useEffect(() => {
    setResult(null)
    setError(null)
    setProgress(null)
  }, [format, mode])

  // Live preview of the resulting document.
  useEffect(() => {
    if (!isOpen || result) return
    const api = (window as any).api
    if (!api?.exportPreview || !previewMarkdown) {
      setPreviewHtml('')
      return
    }
    const requestId = ++requestIdRef.current
    setPreviewLoading(true)
    const handle = setTimeout(async () => {
      try {
        const res = await api.exportPreview({
          format,
          title: mode === 'combined' ? 'Combined Export' : notes?.[0]?.title || 'Untitled',
          content: previewMarkdown,
          theme: readThemeTokens()
        })
        if (requestId !== requestIdRef.current) return
        if (res && typeof res.html === 'string') setPreviewHtml(res.html)
      } catch {
        /* preview is best-effort */
      } finally {
        if (requestId === requestIdRef.current) setPreviewLoading(false)
      }
    }, 220)
    return () => clearTimeout(handle)
  }, [isOpen, format, mode, previewMarkdown, result, notes])

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
      const res = await api[method]({ notes: payloadNotes, format })
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
    <div className="export-overlay" role="presentation" onClick={exporting ? undefined : onClose}>
      <div
        className="export-container batch-export-container"
        role="dialog"
        aria-modal="true"
        aria-label="Export notes"
        data-testid="batch-export-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="export-header">
          <div className="export-header-left">
            <span className="export-header-badge">
              <Download size={14} strokeWidth={2} />
            </span>
            <div className="export-header-titles">
              <span className="export-header-title">Export</span>
              <span className="export-header-subtitle">
                {count} {count === 1 ? 'note' : 'notes'} selected
              </span>
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

            <button type="button" className="export-btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="export-body">
              <aside className="export-formats" aria-label="Export options">
                {/* Mode cards */}
                <span className="export-formats-heading">Mode</span>
                <div className="batch-mode-cards" role="radiogroup" aria-label="Export mode">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={mode === 'combined'}
                    className={`batch-mode-card ${mode === 'combined' ? 'active' : ''}`}
                    onClick={() => setMode('combined')}
                    disabled={exporting}
                  >
                    <span className="batch-mode-icon">
                      <Layers size={18} strokeWidth={1.75} />
                    </span>
                    <span className="batch-mode-title">Single Document</span>
                    <span className="batch-mode-sub">Combine all notes into one file.</span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={mode === 'separate'}
                    className={`batch-mode-card ${mode === 'separate' ? 'active' : ''}`}
                    onClick={() => setMode('separate')}
                    disabled={exporting}
                  >
                    <span className="batch-mode-icon">
                      <Files size={18} strokeWidth={1.75} />
                    </span>
                    <span className="batch-mode-title">Separate Files</span>
                    <span className="batch-mode-sub">Save each note on its own.</span>
                  </button>
                </div>

                {/* Format cards */}
                <span className="export-formats-heading">Format</span>
                {EXPORT_FORMATS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`export-format-card ${format === f.id ? 'active' : ''}`}
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
                <PreviewComponent html={previewHtml} loading={previewLoading} error={error} />
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

export default React.memo(BatchExportDialog)
