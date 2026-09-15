/**
 * ============================================================================
 * Lumina Canvas Alignment Guides Layer (CanvasAlignmentGuidesLayer.tsx)
 * ============================================================================
 * SVG overlay rendering real-time alignment guidelines and magnetic snaps
 * when dragging cards and shapes across the infinite canvas.
 * ============================================================================
 */

import React from 'react'
import { AlignmentGuide } from '../../utils/canvasAlignmentGuides'

export interface CanvasAlignmentGuidesLayerProps {
  guides: AlignmentGuide[]
}

export const CanvasAlignmentGuidesLayer: React.FC<CanvasAlignmentGuidesLayerProps> = React.memo(
  ({ guides }) => {
    if (!guides || guides.length === 0) return null

    return (
      <svg className="lumina-canvas-alignment-guides-layer">
        {guides.map((guide) => {
          if (guide.orientation === 'vertical') {
            return (
              <line
                key={guide.id}
                x1={guide.coordinate}
                y1={guide.start}
                x2={guide.coordinate}
                y2={guide.end}
                className="lumina-canvas-alignment-guide vertical"
              />
            )
          }
          return (
            <line
              key={guide.id}
              x1={guide.start}
              y1={guide.coordinate}
              x2={guide.end}
              y2={guide.coordinate}
              className="lumina-canvas-alignment-guide horizontal"
            />
          )
        })}
      </svg>
    )
  }
)

CanvasAlignmentGuidesLayer.displayName = 'CanvasAlignmentGuidesLayer'
export default CanvasAlignmentGuidesLayer
