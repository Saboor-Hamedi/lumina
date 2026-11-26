/**
 * Semantic blueprint types for AI-to-Canvas visual diagram generation.
 *
 * LLMs supply lightweight, structured semantic nodes/edges/groups; Lumina's
 * deterministic layout compiler converts them into 100% native `CanvasData`
 * with exact integer coordinates, validated shapes/colors, and smart routing.
 */

import type {
  CanvasEdgeLineStyle,
  CanvasEdgeStrokeDash,
  CanvasNodeColor,
  CanvasShapeType
} from '../types'

export type CanvasDiagramLayout =
  | 'flowchart'
  | 'architecture'
  | 'mindmap'
  | 'concept-map'
  | 'timeline'

export type CanvasDiagramDirection = 'TB' | 'LR'

export interface DiagramGroupSpec {
  id: string
  label: string
  color?: CanvasNodeColor
  nodeIds: string[]
}

export interface DiagramNodeSpec {
  /** Short stable identifier referenced by edges and groups (e.g. "auth", "db") */
  id: string
  /** Display label or concise content shown inside the shape/card */
  label: string
  /** Optional subtitle or bullet note (used on sticky/text cards or appended cleanly) */
  description?: string
  /** Visual element kind; defaults to 'shape' */
  kind?: 'shape' | 'sticky' | 'text'
  /** Native Lumina shape when kind === 'shape' (defaults to 'rounded-rectangle') */
  shape?: CanvasShapeType
  /** Theme color accent */
  color?: CanvasNodeColor
}

export interface DiagramEdgeSpec {
  from: string
  to: string
  label?: string
  color?: CanvasNodeColor
  lineStyle?: CanvasEdgeLineStyle
  strokeDash?: CanvasEdgeStrokeDash
  bidirectional?: boolean
}

export interface CanvasDiagramSpec {
  title?: string
  layout?: CanvasDiagramLayout
  direction?: CanvasDiagramDirection
  groups?: DiagramGroupSpec[]
  nodes: DiagramNodeSpec[]
  edges?: DiagramEdgeSpec[]
}
