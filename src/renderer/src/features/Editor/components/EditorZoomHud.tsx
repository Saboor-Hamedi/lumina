/**
 * =========================================================================================
 * Editor Zoom HUD Component (`EditorZoomHud.tsx`)
 * =========================================================================================
 *
 * Standalone floating zoom badge indicator that appears in the bottom-right corner
 * whenever the user zooms the editor in or out (via Ctrl + Wheel, Ctrl + +/-, etc.).
 *
 * Features:
 * - Theme-adaptive styling with backdrop-filter blur.
 * - Smooth entrance and exit animations.
 * - Non-interactive (`pointer-events: none`) so it never intercepts clicks or cursor edits.
 * =========================================================================================
 */

import React from 'react'
import { ZoomIn } from 'lucide-react'

export interface EditorZoomHudProps {
  zoomBadge: string | null
  className?: string
  style?: React.CSSProperties
}

export const EditorZoomHud: React.FC<EditorZoomHudProps> = React.memo(
  ({ zoomBadge, className = '', style }) => {
    if (!zoomBadge) return null

    return (
      <div
        className={`editor-zoom-hud ${className}`.trim()}
        style={style}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <ZoomIn size={13} strokeWidth={2} className="editor-zoom-hud-icon" />
        <span className="editor-zoom-hud-value">{zoomBadge}</span>
      </div>
    )
  }
)

EditorZoomHud.displayName = 'EditorZoomHud'

export default EditorZoomHud
