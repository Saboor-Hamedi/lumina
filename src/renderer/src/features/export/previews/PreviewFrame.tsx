import React from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'

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
}

/**
 * PreviewFrame
 *
 * Shared iframe host for all export previews. The generated document is a
 * self-contained HTML string rendered via `srcDoc`. It is sandboxed with
 * `allow-scripts` (so Mermaid can render) but cannot touch the parent document
 * or Node APIs. Link navigation is neutralised inside the document itself.
 */
export const PreviewFrame: React.FC<PreviewProps> = ({ html, loading, error, label }) => {
  const hasHtml = Boolean(html)

  return (
    <div className="export-preview-wrap">
      {hasHtml ? (
        <iframe
          className="export-preview-frame"
          title={`${label || 'Export'} preview`}
          sandbox="allow-scripts"
          srcDoc={html}
        />
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
    </div>
  )
}

export default PreviewFrame
