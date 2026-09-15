import React from 'react'
import { Copy, Image as ImageIcon, Download } from 'lucide-react'
import { StudioStats } from './types'

export interface StudioExportTabProps {
  onCopyImage?: () => void
  onExportPNG?: () => void
  onExportSVG?: () => void
  hasSelectedNodes?: boolean
  selectedCount?: number
  stats: StudioStats
}

export const StudioExportTab: React.FC<StudioExportTabProps> = React.memo(
  ({
    onCopyImage,
    onExportPNG,
    onExportSVG,
    hasSelectedNodes = false,
    selectedCount = 0,
    stats
  }) => {
    return (
      <div className="lumina-canvas-studio-tab-pane">
        <div className="studio-section-banner">
          <span className="banner-title">Export & Insights</span>
          <span className="banner-sub">Capture, export and inspect diagram statistics</span>
        </div>

        <div className="lumina-canvas-studio-card-box">
          <span className="card-box-label">Export Actions</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            {onCopyImage && (
              <button
                type="button"
                className="lumina-canvas-studio-action-btn"
                onClick={onCopyImage}
              >
                <Copy size={12} />
                <span>
                  {hasSelectedNodes ? 'Copy Selection to Clipboard' : 'Copy Snapshot as Image'}
                </span>
              </button>
            )}

            {onExportPNG && (
              <button
                type="button"
                className="lumina-canvas-studio-action-btn"
                onClick={onExportPNG}
              >
                <ImageIcon size={12} />
                <span>Export as High-Res PNG</span>
              </button>
            )}

            {onExportSVG && (
              <button
                type="button"
                className="lumina-canvas-studio-action-btn"
                onClick={onExportSVG}
              >
                <Download size={12} />
                <span>Export as Vector SVG</span>
              </button>
            )}
          </div>
        </div>

        {/* Diagram Stats Summary */}
        <div className="lumina-canvas-studio-card-box">
          <span className="card-box-label">Diagram Insights</span>
          <div className="lumina-canvas-studio-stats-grid">
            <div className="stat-card">
              <span className="stat-number">{stats.totalNodes}</span>
              <span className="stat-label">Total Cards</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">{stats.shapeCount}</span>
              <span className="stat-label">Shapes</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">{stats.noteCount}</span>
              <span className="stat-label">Notes</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">{stats.edgeCount}</span>
              <span className="stat-label">Wires</span>
            </div>
            <div className="stat-card full-width">
              <span className="stat-number">{selectedCount}</span>
              <span className="stat-label">Items Selected</span>
            </div>
          </div>
        </div>
      </div>
    )
  }
)

StudioExportTab.displayName = 'StudioExportTab'
export default StudioExportTab
