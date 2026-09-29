import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  FileCode,
  FileText,
  Printer,
  FileType,
  FileJson,
  Loader2,
  Download,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react'
import '../../Editor/components/css/exportDialog.css'
import './css/batchExportDialog.css'

export type BatchFormat = 'html' | 'pdf' | 'docs' | 'markdown' | 'text'

export interface BatchNote {
  id?: string
  title?: string
  code?: string
  content?: string
}

export interface BatchExportDialogProps {
  isOpen: boolean
  notes: BatchNote[]
  onClose: () => void
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void
}

interface FormatOption {
  id: BatchFormat
  label: string
  icon: React.ReactNode
}

const FORMAT_OPTIONS: FormatOption[] = [
  { id: 'pdf', label: 'PDF', icon: <Printer size={16} /> },
  { id: 'html', label: 'HTML', icon: <FileCode size={16} /> },
  { id: 'docs', label: 'Word', icon: <FileText size={16} /> },
  { id: 'markdown', label: 'Markdown', icon: <FileJson size={16} /> },
  { id: 'text', label: 'Text', icon: <FileType size={16} /> }
]

interface ProgressState {
  current: number
  total: number
  title: string
  phase: string
}

interface BatchResult {
  outputDir: string
  total: number
  exported: number
  failed: number
}

/**
 * Dialog for exporting many selected notes at once.
 * Streams per-note progress from the main process while writing files.
 */
export const BatchExportDialog: React.FC<BatchExportDialogProps> = ({
  isOpen,
  notes,
  onClose,
  showToast
}) => {
  const [format, setFormat] = useState<BatchFormat>('markdown')
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [result, setResult] = useState<BatchResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const count = notes?.length || 0

  // Reset transient state each time the dialog opens.
  useEffect(() => {
    if (isOpen) {
      setExporting(false)
      setProgress(null)
      setResult(null)
      setError(null)
    }
  }, [isOpen])

  // Subscribe to batch progress while exporting.
  useEffect(() => {
    if (!isOpen) return
    const api = (window as any).api
    if (api?.onBatchExportProgress) {
      unsubscribeRef.current = api.onBatchExportProgress((p: any) => {
        if (!p) return
        if (p.phase === 'complete') return
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
    if (typeof api?.exportBatch !== 'function') {
      showToast?.('Batch export is not supported in this environment.', 'error')
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
      const res = await api.exportBatch({ notes: payloadNotes, format })
      if (res?.canceled) {
        setExporting(false)
        setProgress(null)
        return
      }
      if (res?.success) {
        setResult({
          outputDir: res.outputDir,
          total: res.total,
          exported: res.exported,
          failed: res.failed
        })
        if (res.failed > 0) {
          showToast?.(
            `Exported ${res.exported} of ${res.total} notes. ${res.failed} failed.`,
            'info'
          )
        } else {
          showToast?.(`Exported ${res.exported} notes successfully.`, 'success')
        }
      } else {
        setError('Batch export did not complete.')
      }
    } catch (err: any) {
      console.error('[BatchExportDialog] Batch export failed:', err)
      setError(err?.message || 'Batch export failed.')
      showToast?.(`Batch export failed: ${err?.message || 'Unknown error'}`, 'error')
    } finally {
      setExporting(false)
    }
  }, [notes, format, showToast])

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

  return createPortal(
    <div
      className="export-dialog-overlay"
      role="presentation"
      onClick={exporting ? undefined : onClose}
    >
      <div
        className="export-dialog batch-export-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Batch export"
        data-testid="batch-export-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="export-dialog-header">
          <div className="export-header-left">
            <span className="export-header-icon">
              <Download size={14} strokeWidth={2} />
            </span>
            <span className="export-header-title">Export</span>
            <span className="export-header-divider">/</span>
            <span className="export-header-subtitle">
              {count} {count === 1 ? 'Note' : 'Notes'}
            </span>
          </div>
          <div className="export-header-right">
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

        <div className="batch-export-body">
          <p className="batch-export-hint">
            Choose a format. Each note is written to a folder you select; images and diagrams are
            embedded automatically.
          </p>

          <div
            className="export-dialog-tabs batch-export-tabs"
            role="tablist"
            aria-label="Batch format"
          >
            {FORMAT_OPTIONS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={format === f.id}
                className={`export-tab ${format === f.id ? 'active' : ''}`}
                onClick={() => setFormat(f.id)}
                disabled={exporting}
              >
                {f.icon}
                <span>{f.label}</span>
              </button>
            ))}
          </div>

          {exporting && (
            <div className="batch-export-progress" aria-live="polite">
              <div className="batch-export-progress-label">
                <span>
                  Exporting {progress?.current || 0} of {progress?.total || count}…
                </span>
                <span>{percent}%</span>
              </div>
              <div
                className="batch-export-progress-track"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="batch-export-progress-fill" style={{ width: `${percent}%` }} />
              </div>
              {progress?.title && (
                <div className="batch-export-progress-note" title={progress.title}>
                  {progress.title}
                </div>
              )}
            </div>
          )}

          {result && (
            <div className="batch-export-result" data-testid="batch-export-result">
              <CheckCircle2 size={18} className="batch-export-result-icon" />
              <div className="batch-export-result-text">
                <strong>
                  Exported {result.exported} of {result.total} notes
                </strong>
                {result.failed > 0 && (
                  <span className="batch-export-result-warn"> · {result.failed} failed</span>
                )}
                <div className="batch-export-result-path" title={result.outputDir}>
                  {result.outputDir}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="batch-export-result batch-export-error">
              <AlertTriangle size={18} />
              <div className="batch-export-result-text">
                <strong>{error}</strong>
              </div>
            </div>
          )}
        </div>

        <div className="export-dialog-footer">
          <div className="export-dialog-actions">
            <button
              type="button"
              className="btn export-cancel-btn"
              onClick={onClose}
              disabled={exporting}
            >
              {result ? 'Close' : 'Cancel'}
            </button>
            {!result && (
              <button
                type="button"
                className="btn btn-primary export-confirm-btn"
                onClick={handleStart}
                disabled={exporting || count === 0}
                autoFocus
              >
                {exporting ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                <span>{exporting ? 'Exporting…' : 'Choose Folder & Export'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default React.memo(BatchExportDialog)
