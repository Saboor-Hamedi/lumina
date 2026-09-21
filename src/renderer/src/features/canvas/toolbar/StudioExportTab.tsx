import React from 'react'
import { Copy, Image as ImageIcon, Download } from 'lucide-react'
import { StudioStats } from './types'

export interface StudioExportTabProps {
  onCopyImage?: () => void
  onExportPNG?: () => void
  onExportSVG?: () => void
  hasSelectedNodes?: boolean
  selectedCount?: number
  stats?: StudioStats
}

export const StudioExportTab: React.FC<StudioExportTabProps> = React.memo(
  ({
    onCopyImage,
    onExportPNG,
    onExportSVG,
    hasSelectedNodes = false,
    selectedCount = 0
  }) => {
    return (
      <div className="lumina-canvas-studio-tab-pane">
        <div className="studio-section-banner">
          <span className="banner-title">Export Canvas</span>
          <span className="banner-sub">
            {hasSelectedNodes
              ? `${selectedCount} item${selectedCount > 1 ? 's' : ''} selected for export`
              : 'Export as image or vector'}
          </span>
        </div>

        {/* Export Actions */}
        <div className="lumina-canvas-studio-card-box">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {onCopyImage && (
              <button
                type="button"
                className="lumina-canvas-studio-action-btn"
                onClick={onCopyImage}
              >
                <Copy size={13} />
                <span>{hasSelectedNodes ? 'Copy Selection to Clipboard' : 'Copy to Clipboard'}</span>
              </button>
            )}

            {onExportPNG && (
              <button
                type="button"
                className="lumina-canvas-studio-action-btn"
                onClick={onExportPNG}
              >
                <ImageIcon size={13} />
                <span>Export as PNG</span>
              </button>
            )}

            {onExportSVG && (
              <button
                type="button"
                className="lumina-canvas-studio-action-btn"
                onClick={onExportSVG}
              >
                <Download size={13} />
                <span>Export as Vector SVG</span>
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }
)

StudioExportTab.displayName = 'StudioExportTab'
export default StudioExportTab
