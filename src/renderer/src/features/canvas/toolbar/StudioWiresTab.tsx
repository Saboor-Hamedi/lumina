import React from 'react'
import {
  Sparkles,
  Spline,
  CornerDownRight,
  Minus,
  ArrowRight,
  ArrowLeftRight
} from 'lucide-react'
import { CanvasEdgeLineStyle } from '../types'

export interface StudioWiresTabProps {
  defaultLineStyle?: CanvasEdgeLineStyle
  onChangeDefaultLineStyle?: (style: CanvasEdgeLineStyle) => void
  defaultEndpoints?: 'directed' | 'bidirectional' | 'none'
  onChangeDefaultEndpoints?: (mode: 'directed' | 'bidirectional' | 'none') => void
}

export const StudioWiresTab: React.FC<StudioWiresTabProps> = React.memo(
  ({
    defaultLineStyle = 'curved',
    onChangeDefaultLineStyle,
    defaultEndpoints = 'directed',
    onChangeDefaultEndpoints
  }) => {
    return (
      <div className="lumina-canvas-studio-tab-pane">
        <div className="studio-section-banner">
          <span className="banner-title">Smart Connectors</span>
          <span className="banner-sub">Directional wires and relationship arrows</span>
        </div>

        {/* Super Smart Dynamic Port Routing Feature Card */}
        <div className="lumina-canvas-studio-chip-active">
          <Sparkles size={14} className="chip-icon" />
          <div className="chip-content">
            <span className="chip-title">Super Smart Direction: Active</span>
            <span className="chip-subtitle">
              Wires auto-flip to the closest facing ports as shapes move in 2D space. No loops or awkward crossovers!
            </span>
          </div>
        </div>

        {/* Default Line Style Selector */}
        <div className="lumina-canvas-studio-card-box">
          <span className="card-box-label">Default Wire Path</span>
          <div className="lumina-canvas-studio-btn-toggle-group">
            <button
              type="button"
              className={`toggle-btn ${defaultLineStyle === 'curved' ? 'active' : ''}`}
              onClick={() => onChangeDefaultLineStyle && onChangeDefaultLineStyle('curved')}
            >
              <Spline size={12} />
              <span>Curved</span>
            </button>
            <button
              type="button"
              className={`toggle-btn ${defaultLineStyle === 'step' ? 'active' : ''}`}
              onClick={() => onChangeDefaultLineStyle && onChangeDefaultLineStyle('step')}
            >
              <CornerDownRight size={12} />
              <span>Step</span>
            </button>
            <button
              type="button"
              className={`toggle-btn ${defaultLineStyle === 'straight' ? 'active' : ''}`}
              onClick={() => onChangeDefaultLineStyle && onChangeDefaultLineStyle('straight')}
            >
              <Minus size={12} />
              <span>Straight</span>
            </button>
          </div>
        </div>

        {/* Default Arrowhead Selector */}
        <div className="lumina-canvas-studio-card-box">
          <span className="card-box-label">Default Arrowheads</span>
          <div className="lumina-canvas-studio-btn-toggle-group">
            <button
              type="button"
              className={`toggle-btn ${defaultEndpoints === 'directed' ? 'active' : ''}`}
              onClick={() => onChangeDefaultEndpoints && onChangeDefaultEndpoints('directed')}
            >
              <ArrowRight size={12} />
              <span>Single</span>
            </button>
            <button
              type="button"
              className={`toggle-btn ${defaultEndpoints === 'bidirectional' ? 'active' : ''}`}
              onClick={() => onChangeDefaultEndpoints && onChangeDefaultEndpoints('bidirectional')}
            >
              <ArrowLeftRight size={12} />
              <span>Mutual</span>
            </button>
            <button
              type="button"
              className={`toggle-btn ${defaultEndpoints === 'none' ? 'active' : ''}`}
              onClick={() => onChangeDefaultEndpoints && onChangeDefaultEndpoints('none')}
            >
              <Minus size={12} />
              <span>Plain</span>
            </button>
          </div>
        </div>

        {/* Wire linking tips */}
        <div className="studio-info-callout">
          <span className="info-title">Quick Tip:</span>
          <span className="info-text">
            Click any card port knob to start linking, click target port to finish. Click empty space or press Escape to cancel.
          </span>
        </div>
      </div>
    )
  }
)

StudioWiresTab.displayName = 'StudioWiresTab'
export default StudioWiresTab
