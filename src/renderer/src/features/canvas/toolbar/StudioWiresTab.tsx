import React from 'react'
import { CanvasEdgeLineStyle } from '../types'

export interface StudioWiresTabProps {
  defaultLineStyle?: CanvasEdgeLineStyle
  onChangeDefaultLineStyle?: (style: CanvasEdgeLineStyle) => void
  defaultEndpoints?: 'directed' | 'bidirectional' | 'none'
  onChangeDefaultEndpoints?: (mode: 'directed' | 'bidirectional' | 'none') => void
  selectedEdgeId?: string | null
}

interface LineStyleItem {
  id: CanvasEdgeLineStyle
  label: string
  title: string
  svg: React.ReactNode
}

interface EndpointItem {
  id: 'directed' | 'bidirectional' | 'none'
  label: string
  title: string
  svg: React.ReactNode
}

const LINE_STYLES: LineStyleItem[] = [
  {
    id: 'curved',
    label: 'Curved',
    title: 'Curved (Spline) connector',
    svg: (
      <svg viewBox="0 0 38 22" width="38" height="22" fill="none">
        <path
          d="M 5 17 C 15 17, 23 5, 33 5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    )
  },
  {
    id: 'step',
    label: 'Orthogonal',
    title: 'Orthogonal (Manhattan right-angle) connector',
    svg: (
      <svg viewBox="0 0 38 22" width="38" height="22" fill="none">
        <path
          d="M 5 17 H 19 V 5 H 33"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  },
  {
    id: 'straight',
    label: 'Straight',
    title: 'Straight direct wire',
    svg: (
      <svg viewBox="0 0 38 22" width="38" height="22" fill="none">
        <line
          x1="5"
          y1="17"
          x2="33"
          y2="5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    )
  }
]

const ENDPOINTS: EndpointItem[] = [
  {
    id: 'directed',
    label: 'Directed',
    title: 'Directed (Single arrow to target)',
    svg: (
      <svg viewBox="0 0 38 22" width="38" height="22" fill="none">
        <line
          x1="5"
          y1="11"
          x2="28"
          y2="11"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <polygon points="26,7 34,11 26,15" fill="currentColor" />
      </svg>
    )
  },
  {
    id: 'bidirectional',
    label: 'Mutual',
    title: 'Mutual (Dual arrows on both ends)',
    svg: (
      <svg viewBox="0 0 38 22" width="38" height="22" fill="none">
        <polygon points="12,7 4,11 12,15" fill="currentColor" />
        <line
          x1="10"
          y1="11"
          x2="28"
          y2="11"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <polygon points="26,7 34,11 26,15" fill="currentColor" />
      </svg>
    )
  },
  {
    id: 'none',
    label: 'Plain',
    title: 'Plain line without arrowheads',
    svg: (
      <svg viewBox="0 0 38 22" width="38" height="22" fill="none">
        <line
          x1="5"
          y1="11"
          x2="33"
          y2="11"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    )
  }
]

export const StudioWiresTab: React.FC<StudioWiresTabProps> = React.memo(
  ({
    defaultLineStyle = 'curved',
    onChangeDefaultLineStyle,
    defaultEndpoints = 'directed',
    onChangeDefaultEndpoints,
    selectedEdgeId
  }) => {
    return (
      <div className="lumina-canvas-studio-tab-pane">
        <div className="studio-section-banner">
          <span className="banner-title">Connectors</span>
          <span className="banner-sub">
            {selectedEdgeId ? 'Selected connector line style & endpoints' : 'Line geometry and arrow endpoints'}
          </span>
        </div>

        {/* Feature 1: Wire Path Style Cards Grid (Matching Shapes Aesthetic) */}
        <div className="lumina-canvas-studio-card-box">
          <div className="studio-field-header">
            <span className="studio-field-label">Line Style</span>
          </div>

          <div className="lumina-canvas-studio-wire-cards-grid">
            {LINE_STYLES.map((style) => {
              const isActive = defaultLineStyle === style.id
              return (
                <button
                  key={style.id}
                  type="button"
                  className={`lumina-canvas-studio-wire-card ${isActive ? 'active' : ''}`}
                  onClick={() => onChangeDefaultLineStyle?.(style.id)}
                  title={style.title}
                  aria-pressed={isActive}
                >
                  <div className="wire-preview-svg">{style.svg}</div>
                  <span className="wire-card-label">{style.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Feature 2: Arrowhead Endpoints Cards Grid (Matching Shapes Aesthetic) */}
        <div className="lumina-canvas-studio-card-box">
          <div className="studio-field-header">
            <span className="studio-field-label">Arrowheads</span>
          </div>

          <div className="lumina-canvas-studio-wire-cards-grid">
            {ENDPOINTS.map((endpoint) => {
              const isActive = defaultEndpoints === endpoint.id
              return (
                <button
                  key={endpoint.id}
                  type="button"
                  className={`lumina-canvas-studio-wire-card ${isActive ? 'active' : ''}`}
                  onClick={() => onChangeDefaultEndpoints?.(endpoint.id)}
                  title={endpoint.title}
                  aria-pressed={isActive}
                >
                  <div className="wire-preview-svg">{endpoint.svg}</div>
                  <span className="wire-card-label">{endpoint.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }
)

StudioWiresTab.displayName = 'StudioWiresTab'
export default StudioWiresTab
