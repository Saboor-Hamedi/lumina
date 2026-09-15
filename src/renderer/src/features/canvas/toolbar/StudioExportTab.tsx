import React, { useState, useMemo } from 'react'
import { Copy, Image as ImageIcon, Download, Share2, Sparkles } from 'lucide-react'
import { StudioStats } from './types'
import { StudioDropdown, StudioDropdownOption } from './StudioDropdown'

export interface StudioExportTabProps {
  onCopyImage?: () => void
  onExportPNG?: () => void
  onExportSVG?: () => void
  hasSelectedNodes?: boolean
  selectedCount?: number
  stats: StudioStats
}

type ExportActionId = 'copy' | 'png' | 'svg'

const EXPORT_OPTIONS: StudioDropdownOption<ExportActionId>[] = [
  {
    id: 'copy',
    label: 'Copy Image to Clipboard',
    icon: <Copy size={13} />,
    description: 'Instant bitmap copy ready to paste'
  },
  {
    id: 'png',
    label: 'Export as High-Res PNG',
    icon: <ImageIcon size={13} />,
    badge: 'Raster',
    description: 'High-DPI transparent bitmap'
  },
  {
    id: 'svg',
    label: 'Export as Vector SVG',
    icon: <Download size={13} />,
    badge: 'Vector',
    description: 'Infinitely scalable graphics'
  }
]

export const StudioExportTab: React.FC<StudioExportTabProps> = React.memo(
  ({
    onCopyImage,
    onExportPNG,
    onExportSVG,
    hasSelectedNodes = false,
    selectedCount = 0,
    stats
  }) => {
    const [selectedAction, setSelectedAction] = useState<ExportActionId>('png')

    const handleExecuteExport = () => {
      if (selectedAction === 'copy') {
        onCopyImage?.()
      } else if (selectedAction === 'png') {
        onExportPNG?.()
      } else if (selectedAction === 'svg') {
        onExportSVG?.()
      }
    }

    return (
      <div className="lumina-canvas-studio-tab-pane">
        <div className="studio-section-banner">
          <span className="banner-title">Export & Insights</span>
          <span className="banner-sub">Capture, export and inspect diagram statistics</span>
        </div>

        {/* Feature: Export Format Dropdown & Trigger */}
        <div className="lumina-canvas-studio-card-box">
          <StudioDropdown<ExportActionId>
            label="Export Format"
            description={hasSelectedNodes ? 'Exports selected items' : 'Exports whole canvas'}
            value={selectedAction}
            options={EXPORT_OPTIONS}
            onChange={(action) => {
              setSelectedAction(action)
            }}
          />

          <button
            type="button"
            className="lumina-canvas-studio-action-btn"
            style={{ marginTop: 6, justifyContent: 'center', fontWeight: 600 }}
            onClick={handleExecuteExport}
          >
            {selectedAction === 'copy' && <Copy size={12} />}
            {selectedAction === 'png' && <ImageIcon size={12} />}
            {selectedAction === 'svg' && <Download size={12} />}
            <span>
              {selectedAction === 'copy'
                ? hasSelectedNodes
                  ? 'Copy Selection to Clipboard'
                  : 'Copy Snapshot to Clipboard'
                : selectedAction === 'png'
                ? 'Download High-Res PNG'
                : 'Download Vector SVG'}
            </span>
          </button>
        </div>

        {/* Quick Action Buttons */}
        <div className="lumina-canvas-studio-card-box">
          <span className="card-box-label">Quick Actions</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            {onCopyImage && (
              <button
                type="button"
                className="lumina-canvas-studio-action-btn"
                onClick={onCopyImage}
              >
                <Copy size={12} />
                <span>{hasSelectedNodes ? 'Copy Selection' : 'Copy All'}</span>
              </button>
            )}

            {onExportPNG && (
              <button
                type="button"
                className="lumina-canvas-studio-action-btn"
                onClick={onExportPNG}
              >
                <ImageIcon size={12} />
                <span>Save PNG Image</span>
              </button>
            )}

            {onExportSVG && (
              <button
                type="button"
                className="lumina-canvas-studio-action-btn"
                onClick={onExportSVG}
              >
                <Download size={12} />
                <span>Save Vector SVG</span>
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
