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
import { StudioDropdown, StudioDropdownOption } from './StudioDropdown'

export interface StudioWiresTabProps {
  defaultLineStyle?: CanvasEdgeLineStyle
  onChangeDefaultLineStyle?: (style: CanvasEdgeLineStyle) => void
  defaultEndpoints?: 'directed' | 'bidirectional' | 'none'
  onChangeDefaultEndpoints?: (mode: 'directed' | 'bidirectional' | 'none') => void
}

const LINE_STYLE_OPTIONS: StudioDropdownOption<CanvasEdgeLineStyle>[] = [
  {
    id: 'curved',
    label: 'Curved (Spline)',
    icon: <Spline size={13} />,
    description: 'Smooth organic Bezier paths'
  },
  {
    id: 'step',
    label: 'Step (Orthogonal)',
    icon: <CornerDownRight size={13} />,
    description: '90° right-angle architecture lines'
  },
  {
    id: 'straight',
    label: 'Straight Line',
    icon: <Minus size={13} />,
    description: 'Direct point-to-point connection'
  }
]

const ENDPOINT_OPTIONS: StudioDropdownOption<'directed' | 'bidirectional' | 'none'>[] = [
  {
    id: 'directed',
    label: 'Directed (Single Arrow)',
    icon: <ArrowRight size={13} />,
    description: 'Points from source to target'
  },
  {
    id: 'bidirectional',
    label: 'Mutual (Two Arrows)',
    icon: <ArrowLeftRight size={13} />,
    description: 'Arrows on both ends'
  },
  {
    id: 'none',
    label: 'Plain (No Arrowheads)',
    icon: <Minus size={13} />,
    description: 'Undirected connection wire'
  }
]

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

        {/* Feature 1: Default Wire Path Dropdown */}
        <div className="lumina-canvas-studio-card-box">
          <StudioDropdown<CanvasEdgeLineStyle>
            label="Wire Path Style"
            description="Geometry for new connections"
            value={defaultLineStyle}
            options={LINE_STYLE_OPTIONS}
            onChange={(style) => onChangeDefaultLineStyle?.(style)}
          />
        </div>

        {/* Feature 2: Default Arrowhead Dropdown */}
        <div className="lumina-canvas-studio-card-box">
          <StudioDropdown<'directed' | 'bidirectional' | 'none'>
            label="Default Arrowheads"
            description="Terminator style"
            value={defaultEndpoints}
            options={ENDPOINT_OPTIONS}
            onChange={(endpoints) => onChangeDefaultEndpoints?.(endpoints)}
          />
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
