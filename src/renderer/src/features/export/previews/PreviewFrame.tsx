import React, { useState, useCallback, useMemo, useRef } from 'react'
import { Loader2, AlertTriangle, ZoomIn, ZoomOut } from 'lucide-react'

/** Props shared by every format preview component. */
export interface PreviewProps {
  /** Full HTML document produced by the main-process preview builder. */
  html: string
  /** True while the preview document is being generated. */
  loading: boolean
  /** Error message when preview generation failed. */
  error?: string | null
  /** Human-readable label shown in empty states, e.g. "PDF". */
  label?: string
  /** Base64-encoded PDF binary for native PDF preview */
  pdfBase64?: string
  /** Document title */
  title?: string
  /** Optional badge text (deprecated). */
  badge?: string
  /** Optional secondary badge (deprecated). */
  subBadge?: string
  /** Optional icon (deprecated). */
  icon?: React.ReactNode
  /** Enable zoom controls (defaults to true). */
  allowZoom?: boolean
  /** Initial zoom level. Default 1. */
  initialZoom?: number
}

const ZOOM_STEPS = [0.6, 0.75, 0.85, 1.0, 1.15, 1.25, 1.5]
const DEFAULT_ZOOM_INDEX = 3 // 1.0

/**
 * PreviewFrame
 *
 * Sleek, full-bleed document preview frame with centered zoom and a consolidated,
 * floating glass zoom pill. No heavy header or redundant buttons.
 */
export const PreviewFrame: React.FC<PreviewProps> = ({
  html,
  loading,
  error,
  label,
  allowZoom = true,
  initialZoom = 1.0
}) => {
  const hasHtml = Boolean(html)
  const initialIndex = useMemo(() => {
    const idx = ZOOM_STEPS.indexOf(initialZoom)
    return idx !== -1 ? idx : DEFAULT_ZOOM_INDEX
  }, [initialZoom])

  const [zoomIndex, setZoomIndex] = useState(initialIndex)
  const zoom = ZOOM_STEPS[zoomIndex]

  const handleZoomIn = useCallback(() => {
    setZoomIndex((prev) => Math.min(prev + 1, ZOOM_STEPS.length - 1))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoomIndex((prev) => Math.max(prev - 1, 0))
  }, [])

  const handleResetZoom = useCallback(() => {
    setZoomIndex(DEFAULT_ZOOM_INDEX)
  }, [])

  const iframeRef = useRef<HTMLIFrameElement>(null)

  const applyZoom = useCallback(() => {
    try {
      const doc = iframeRef.current?.contentDocument
      if (!doc) return
      let styleEl = doc.getElementById('lumina-preview-zoom') as HTMLStyleElement | null
      if (!styleEl) {
        styleEl = doc.createElement('style')
        styleEl.id = 'lumina-preview-zoom'
        if (doc.head) {
          doc.head.appendChild(styleEl)
        } else if (doc.documentElement) {
          doc.documentElement.appendChild(styleEl)
        }
      }
      styleEl.textContent = `
        body {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          width: 100% !important;
          min-width: min-content !important;
          min-height: 100% !important;
          margin: 0 auto !important;
        }
        .page, .doc, .container, pre.md, pre.txt, article {
          zoom: ${zoom} !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }
      `
    } catch {
      // Ignore cross-origin sandbox restrictions if any
    }
  }, [zoom])

  React.useEffect(() => {
    applyZoom()
  }, [zoom, applyZoom])

  const srcDocWithZoom = useMemo(() => {
    if (!html) return ''
    const zoomStyle = `<style id="lumina-preview-zoom">body{display:flex!important;flex-direction:column!important;align-items:center!important;width:100%!important;min-width:min-content!important;min-height:100%!important;margin:0 auto!important;}.page,.doc,.container,pre.md,pre.txt,article{zoom:${zoom}!important;margin-left:auto!important;margin-right:auto!important;}</style>`
    if (html.includes('</head>')) {
      return html.replace('</head>', `${zoomStyle}</head>`)
    }
    return `${zoomStyle}${html}`
  }, [html, zoom])

  return (
    <div className="export-preview-wrap">
      {/* Main Document Viewport */}
      <div className="export-preview-viewport">
        {hasHtml ? (
          <div className="export-preview-scaler">
            <iframe
              ref={iframeRef}
              className="export-preview-frame"
              title={`${label || 'Export'} preview`}
              sandbox="allow-scripts"
              srcDoc={srcDocWithZoom}
              onLoad={applyZoom}
            />
          </div>
        ) : !loading ? (
          <div className="export-preview-empty">
            <AlertTriangle size={20} />
            <p>{error || 'Preview unavailable. You can still export.'}</p>
          </div>
        ) : null}

        {loading && (
          <div className="export-preview-loading" aria-live="polite">
            <Loader2 size={22} className="spin" />
            <span>Generating preview…</span>
          </div>
        )}

        {/* Consolidated Floating Zoom Pill */}
        {allowZoom && hasHtml && (
          <div className="preview-floating-zoom" role="toolbar" aria-label="Zoom controls">
            <button
              type="button"
              className="preview-zoom-btn"
              onClick={handleZoomOut}
              disabled={zoomIndex <= 0}
              title="Zoom out"
              aria-label="Zoom out"
            >
              <ZoomOut size={13} />
            </button>
            <button
              type="button"
              className="preview-zoom-chip"
              onClick={handleResetZoom}
              title="Click to reset zoom to 100%"
              aria-label="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              className="preview-zoom-btn"
              onClick={handleZoomIn}
              disabled={zoomIndex >= ZOOM_STEPS.length - 1}
              title="Zoom in"
              aria-label="Zoom in"
            >
              <ZoomIn size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default PreviewFrame
