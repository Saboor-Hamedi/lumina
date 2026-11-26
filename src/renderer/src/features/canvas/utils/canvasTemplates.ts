/**
 * ============================================================================
 * Lumina Canvas Diagram Templates (`canvasTemplates.ts`)
 * ============================================================================
 * Pure factory builders for starter diagram templates (flowchart, architecture,
 * mindmap) centered around a given canvas coordinate.
 * ============================================================================
 */

import type { CanvasEdge, CanvasNode } from '../types'

export type CanvasTemplateType = 'flowchart' | 'architecture' | 'mindmap'

export interface BuiltCanvasTemplate {
  nodes: Partial<CanvasNode>[]
  edges: CanvasEdge[]
}

export function buildCanvasTemplate(
  template: CanvasTemplateType,
  cx: number,
  cy: number
): BuiltCanvasTemplate {
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

  if (template === 'flowchart') {
    const startId = `tpl-start-${uid}`
    const decId = `tpl-dec-${uid}`
    const yesId = `tpl-yes-${uid}`
    const noId = `tpl-no-${uid}`
    return {
      nodes: [
        { id: startId, type: 'shape', shape: 'pill', text: 'Start', x: cx - 75, y: cy - 200, width: 150, height: 64, color: 'blue' },
        { id: decId, type: 'shape', shape: 'diamond', text: 'Condition?', x: cx - 70, y: cy - 80, width: 140, height: 120, color: 'yellow' },
        { id: yesId, type: 'shape', shape: 'rounded-rectangle', text: 'Approve', x: cx - 230, y: cy + 95, width: 150, height: 80, color: 'green' },
        { id: noId, type: 'shape', shape: 'rounded-rectangle', text: 'Revise', x: cx + 80, y: cy + 95, width: 150, height: 80, color: 'orange' }
      ],
      edges: [
        { id: `edge-${uid}-1`, fromNode: startId, fromSide: 'bottom', toNode: decId, toSide: 'top', toEnd: 'arrow', lineStyle: 'step', color: 'blue' },
        { id: `edge-${uid}-2`, fromNode: decId, fromSide: 'left', toNode: yesId, toSide: 'top', toEnd: 'arrow', label: 'Yes', lineStyle: 'step', color: 'green' },
        { id: `edge-${uid}-3`, fromNode: decId, fromSide: 'right', toNode: noId, toSide: 'top', toEnd: 'arrow', label: 'No', lineStyle: 'step', color: 'orange' }
      ]
    }
  }

  if (template === 'architecture') {
    const clientId = `tpl-client-${uid}`
    const apiId = `tpl-api-${uid}`
    const queueId = `tpl-queue-${uid}`
    const dbId = `tpl-db-${uid}`
    return {
      nodes: [
        { id: clientId, type: 'shape', shape: 'browser', text: 'Web App', x: cx - 320, y: cy - 55, width: 150, height: 110, color: 'cyan' },
        { id: apiId, type: 'shape', shape: 'server', text: 'API Server', x: cx - 90, y: cy - 65, width: 140, height: 130, color: 'blue' },
        { id: queueId, type: 'shape', shape: 'queue', text: 'Queue', x: cx + 130, y: cy - 125, width: 145, height: 80, color: 'purple' },
        { id: dbId, type: 'shape', shape: 'cylinder', text: 'Database', x: cx + 140, y: cy + 15, width: 125, height: 120, color: 'green' }
      ],
      edges: [
        { id: `edge-${uid}-1`, fromNode: clientId, fromSide: 'right', toNode: apiId, toSide: 'left', toEnd: 'arrow', label: 'HTTPS', lineStyle: 'curved', color: 'cyan' },
        { id: `edge-${uid}-2`, fromNode: apiId, fromSide: 'right', toNode: queueId, toSide: 'left', toEnd: 'arrow', label: 'Jobs', lineStyle: 'curved', color: 'purple' },
        { id: `edge-${uid}-3`, fromNode: apiId, fromSide: 'right', toNode: dbId, toSide: 'left', toEnd: 'arrow', label: 'SQL', lineStyle: 'curved', color: 'green' }
      ]
    }
  }

  const centerId = `tpl-hub-${uid}`
  const b1 = `tpl-b1-${uid}`
  const b2 = `tpl-b2-${uid}`
  const b3 = `tpl-b3-${uid}`
  const b4 = `tpl-b4-${uid}`
  return {
    nodes: [
      { id: centerId, type: 'shape', shape: 'pill', text: 'Core Idea', x: cx - 80, y: cy - 40, width: 160, height: 80, color: 'purple' },
      { id: b1, type: 'shape', shape: 'rounded-rectangle', text: 'Goals', x: cx - 290, y: cy - 120, width: 140, height: 74, color: 'blue' },
      { id: b2, type: 'shape', shape: 'rounded-rectangle', text: 'Research', x: cx + 150, y: cy - 120, width: 140, height: 74, color: 'cyan' },
      { id: b3, type: 'shape', shape: 'rounded-rectangle', text: 'Actions', x: cx - 290, y: cy + 50, width: 140, height: 74, color: 'green' },
      { id: b4, type: 'shape', shape: 'rounded-rectangle', text: 'Risks', x: cx + 150, y: cy + 50, width: 140, height: 74, color: 'orange' }
    ],
    edges: [
      { id: `edge-${uid}-1`, fromNode: centerId, fromSide: 'left', toNode: b1, toSide: 'right', toEnd: 'none', lineStyle: 'curved', color: 'blue' },
      { id: `edge-${uid}-2`, fromNode: centerId, fromSide: 'right', toNode: b2, toSide: 'left', toEnd: 'none', lineStyle: 'curved', color: 'cyan' },
      { id: `edge-${uid}-3`, fromNode: centerId, fromSide: 'left', toNode: b3, toSide: 'right', toEnd: 'none', lineStyle: 'curved', color: 'green' },
      { id: `edge-${uid}-4`, fromNode: centerId, fromSide: 'right', toNode: b4, toSide: 'left', toEnd: 'none', lineStyle: 'curved', color: 'orange' }
    ]
  }
}
