import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Download,
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
  ArrowLeft
} from 'lucide-react'
import { PulseLoader } from '../../../components/PulseLoader'
import ToolTip from '../../../components/atoms/ToolTip'
import { EXPORT_FORMATS, getFormat, type ExportFormat } from '../formats'
import { PREVIEW_COMPONENTS } from '../previews'
import Toggle from '../../../components/toggle/Toggle'
import { useKeyboardShortcuts } from '../../../core/shortcuts'
import '../css/exportContainer.css'
import '../css/batchExportDialog.css'
import { makePreviewKey } from '../previewKey'

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
  const [selectedNoteIndex, setSelectedNoteIndex] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [result, setResult] = useState<BatchResult | null>(null)
  const [error, setError] = useState<string | null>(null)
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
  const isSingleNote = count <= 1
  const effectiveMode: BatchMode = format === 'zip' ? 'separate' : isSingleNote ? 'combined' : mode
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
    if (effectiveMode === 'separate') {
      const activeNote = list[selectedNoteIndex] || list[0]
      return activeNote.content ?? activeNote.code ?? ''
    }
    return list
      .map((n) => (n.content ?? n.code ?? '').trim())
      .filter(Boolean)
      .join('\n\n\n')
  }, [notes, effectiveMode, selectedNoteIndex])

  const activeNoteTitle = useMemo(() => {
    return notes?.[selectedNoteIndex]?.title || notes?.[0]?.title || 'Untitled'
  }, [notes, selectedNoteIndex])

  const [includeToc, setIncludeToc] = useState(true)
  const [compressZip, setCompressZip] = useState(false)
  const [optimizeImages, setOptimizeImages] = useState(true)
  const [stripMarkdown, setStripMarkdown] = useState(true)
  const [includeTitle, setIncludeTitle] = useState(true)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<{ key: string; html: string; pdfBase64?: string }>({ key: '', html: '' })
  const previewCacheRef = useRef<Map<string, { key: string; html: string; pdfBase64?: string }>>(new Map())
  const isSeparatePreview = effectiveMode === 'separate'
  const activePreviewTitle = isSeparatePreview
    ? activeNoteTitle
    : count === 1 ? (notes?.[0]?.title || folderName || 'Export') : (folderName || 'Combined Export')
  const activePreviewKey = useMemo(
    () => makePreviewKey([
      format,
      effectiveMode,
      selectedNoteIndex,
      includeToc,
      optimizeImages,
      stripMarkdown,
      includeTitle,
      activePreviewTitle,
      previewMarkdown,
      themeTick,
      JSON.stringify((notes || []).map((note) => [note.id, note.title, note.content ?? note.code ?? '']))
    ]),
    [
      format,
      effectiveMode,
      selectedNoteIndex,
      includeToc,
      optimizeImages,
      stripMarkdown,
      includeTitle,
      activePreviewTitle,
      previewMarkdown,
      themeTick,
      notes
    ]
  )

  // Reset transient state each time the dialog opens.
  useEffect(() => {
    if (isOpen) {
      setFormat(initialFormat)
      setMode(initialFormat === 'zip' ? 'separate' : 'combined')
      setIsMaximized(false)
      setSelectedNoteIndex(0)
      setIncludeToc(true)
      setCompressZip(false)
      setOptimizeImages(true)
      setStripMarkdown(true)
      setIncludeTitle(true)
      setPreviewError(null)
      setExporting(false)
      setProgress(null)
      setResult(null)
      setError(null)
      setPreviewData({ key: '', html: '' })
      setPreviewLoading(Boolean(notes?.length))
      requestIdRef.current++
      setCopied(false)
      previewCacheRef.current.clear()
    }
  }, [isOpen, initialFormat])

  // Changing format or mode clears the previous result so you can export again.
  useEffect(() => {
    setResult(null)
    setError(null)
    setPreviewError(null)
    setProgress(null)
  }, [format, effectiveMode])

  // Live preview of the resulting document with instant cache switching.
  useEffect(() => {
    if (!isOpen || result) return
    const api = (window as any).api
    if (!previewMarkdown) {
      setPreviewData({ key: '', html: '' })
      setPreviewLoading(false)
      setPreviewError(null)
      return
    }
    if (!api?.exportPreview) {
      setPreviewData({ key: '', html: '' })
      setPreviewLoading(false)
      setPreviewError('Preview is unavailable in this build.')
      return
    }

    const isSeparate = isSeparatePreview
    const cacheKey = activePreviewKey
    if (previewCacheRef.current.has(cacheKey)) {
      setPreviewData(previewCacheRef.current.get(cacheKey)!)
      setPreviewLoading(false)
      setPreviewError(null)
      return
    }

    const requestId = ++requestIdRef.current
    setPreviewLoading(true)
    setPreviewError(null)

    const previewTitle =
      !isSeparate
        ? count === 1
          ? notes?.[0]?.title || folderName || 'Export'
          : folderName || 'Combined Export'
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
      optimizeImages,
      stripMarkdown,
      includeTitle,
      notes: payloadNotes
    }).then((res: any) => {
      if (!isMounted || requestId !== requestIdRef.current) return
      if (!res || typeof res.html !== 'string') {
        throw new Error('Preview generation returned no content')
      }
      const data = { key: cacheKey, html: res.html }
      previewCacheRef.current.set(cacheKey, data)
      setPreviewData(data)
      setPreviewLoading(false)
    }).catch((err: any) => {
      if (!isMounted || requestId !== requestIdRef.current) return
      setPreviewData({ key: '', html: '' })
      setPreviewError(err?.message || 'Failed to generate preview.')
      setPreviewLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [
    isOpen,
    format,
    effectiveMode,
    previewMarkdown,
    result,
    notes,
    selectedNoteIndex,
    includeToc,
    optimizeImages,
    stripMarkdown,
    includeTitle,
    folderName,
    themeTick,
    activePreviewKey,
    isSeparatePreview
  ])

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
    const isZip = format === 'zip' || (effectiveMode === 'separate' && compressZip)
    const method = isZip ? 'exportBatch' : effectiveMode === 'combined' ? 'exportCombined' : 'exportBatch'
    if (typeof api?.[method] !== 'function') {
      const msg =
        effectiveMode === 'combined' && !isZip
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
        format: format === 'zip' ? 'markdown' : format,
        toc: includeToc,
        optimizeImages,
        stripMarkdown,
        includeTitle,
        title: payloadNotes.length === 1 ? payloadNotes[0].title || folderName || 'Untitled' : folderName,
        compressZip: isZip,
        archiveTitle: (payloadNotes.length === 1 ? payloadNotes[0].title : folderName) || 'Lumina-Notes',
        theme: readThemeTokens()
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
  }, [notes, format, effectiveMode, includeToc, compressZip, optimizeImages, stripMarkdown, includeTitle, folderName, showToast])

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

  // Register Escape with Lumina's global shortcut stack (Engineering Std #5)
  useKeyboardShortcuts({
    onEscape: isOpen && !exporting
      ? () => {
          onClose()
          return true
        }
      : undefined
  })

  // Escape closes fallback (unless mid-export).
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
            <span className="export-header-title">{count === 1 ? 'Export' : 'Batch Export'}</span>
            <span className="export-header-divider">/</span>
            <span className="export-header-subtitle">
              {count === 1
                ? (notes?.[0]?.title || folderName || 'Note')
                : `${count} notes${folderName && folderName !== 'Combined Export' && folderName !== 'Folder Export' ? ` in ${folderName}` : ''}`}
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
                  {/* Compact full-width Mode tabs anchored at the VERY TOP for multi-note exports */}
                  {!isSingleNote && (
                    <div className="batch-mode-group">
                      <div className="batch-mode-pills" role="radiogroup" aria-label="Export mode">
                        <button
                          type="button"
                          role="radio"
                          aria-checked={format !== 'zip' && effectiveMode === 'combined'}
                          className={`batch-mode-pill ${format !== 'zip' && effectiveMode === 'combined' ? 'active' : ''}`}
                          onClick={() => setMode('combined')}
                          disabled={exporting || format === 'zip'}
                          title={format === 'zip' ? 'ZIP exports separate files' : 'Merge into one file'}
                        >
                          <Layers size={12} strokeWidth={2} />
                          <span>Merged</span>
                        </button>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={format === 'zip' || effectiveMode === 'separate'}
                          className={`batch-mode-pill ${format === 'zip' || effectiveMode === 'separate' ? 'active' : ''}`}
                          onClick={() => setMode('separate')}
                          disabled={exporting}
                        >
                          <Files size={12} strokeWidth={2} />
                          <span>Separate</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Formats below top tabs */}
                  <div className="export-sidebar-section">
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
                  </div>

                  {/* Options BELOW Formats */}
                  {((format === 'pdf' || format === 'docs' || format === 'html') ||
                    format === 'zip' ||
                    format === 'text' ||
                    effectiveMode === 'separate') && (
                    <div className="export-options-group">
                      <span className="export-formats-heading">Options</span>
                      {(format === 'pdf' || format === 'docs' || format === 'html') && (
                        <>
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
                        </>
                      )}

                      {(format === 'zip' || (format === 'markdown' && effectiveMode === 'separate')) && (
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

                      {format === 'text' && (
                        <>
                          <div className="export-option-row" onClick={() => setStripMarkdown((prev) => !prev)}>
                            <div className="export-option-label">
                              <span className="export-option-title">Strip Formatting</span>
                            </div>
                            <Toggle
                              checked={stripMarkdown}
                              onCheckedChange={setStripMarkdown}
                              disabled={exporting}
                              ariaLabel="Strip Formatting"
                            />
                          </div>
                          <div className="export-option-row" onClick={() => setIncludeTitle((prev) => !prev)}>
                            <div className="export-option-label">
                              <span className="export-option-title">Include Title</span>
                            </div>
                            <Toggle
                              checked={includeTitle}
                              onCheckedChange={setIncludeTitle}
                              disabled={exporting}
                              ariaLabel="Include Title"
                            />
                          </div>
                        </>
                      )}

                      {effectiveMode === 'separate' && (format as string) !== 'zip' && (
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
                </aside>
              )}
              <section className="export-preview-pane" aria-label="Preview">
                <PreviewComponent
                  html={previewData.key === activePreviewKey ? previewData.html : ''}
                  pdfBase64={previewData.pdfBase64}
                  title={isSeparatePreview ? activeNoteTitle : folderName}
                  loading={previewLoading}
                  error={previewError || error}
                />
                {exporting && (
                  <div className="batch-progress" aria-live="polite">
                    <div className="batch-progress-label">
                      <span>
                        {effectiveMode === 'combined'
                          ? progress?.title
                            ? `Merging: ${progress.title}`
                            : 'Preparing merged document…'
                          : progress?.title
                            ? `Exporting: ${progress.title}`
                            : 'Preparing export…'}
                      </span>
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
              <div className="export-footer-right">
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
                  {exporting ? <PulseLoader size="xs" inline delayMs={0} message="" tone="current" /> : <Download size={15} />}
                  <span>
                    {exporting
                      ? 'Exporting…'
                      : isSingleNote
                        ? activeFormat.acceptLabel
                        : format === 'zip' || (effectiveMode === 'separate' && compressZip)
                          ? `Export ${count} Notes as ZIP Archive`
                          : effectiveMode === 'combined'
                            ? `Export as ${format === 'docs' ? 'DOCX' : format.toUpperCase()}`
                            : `Export ${count} Files`}
                  </span>
                </button>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

export default React.memo(BatchExportDialog)
