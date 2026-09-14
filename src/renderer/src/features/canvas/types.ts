/**
 * ============================================================================
 * Lumina Infinite Spatial Canvas - Type Definitions
 * ============================================================================
 * Standardized data models for nodes, edges, viewport transformations, and
 * canvas file persistence (.canvas format compatible with open ecosystem).
 * ============================================================================
 */

export type CanvasNodeType = 'note' | 'text' | 'file' | 'link' | 'group' | 'image' | 'pdf' | 'shape'

export type CanvasShapeType =
  | 'rectangle'
  | 'rounded-rectangle'
  | 'circle'
  | 'diamond'
  | 'triangle'
  | 'hexagon'
  | 'cylinder'
  | 'cloud'
  | 'star'
  | 'parallelogram'
  | 'speech-bubble'
  | 'pill'
  | 'document'
  | 'step'
  | 'shield'
  | 'heart'

export type CanvasNodeColor =
  | 'default'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'cyan'
  | 'purple'

export interface CanvasNode {
  id: string
  type: CanvasNodeType
  shape?: CanvasShapeType
  x: number
  y: number
  width: number
  height: number
  color?: CanvasNodeColor
  // For 'note' type: links to an existing workspace snippet/file
  file?: string
  // For 'text' / sticky type: plain markdown or text contents
  text?: string
  // For 'link' type: external web URL
  url?: string
  // Optional label or title displayed in card header
  title?: string
  // Z-index layer
  zIndex?: number
}

export type CanvasEdgeEnd = 'none' | 'arrow'
export type CanvasEdgeSide = 'top' | 'right' | 'bottom' | 'left'
export type CanvasEdgeLineStyle = 'straight' | 'curved' | 'step'

export interface CanvasEdge {
  id: string
  fromNode: string
  fromSide?: CanvasEdgeSide
  fromEnd?: CanvasEdgeEnd
  toNode: string
  toSide?: CanvasEdgeSide
  toEnd?: CanvasEdgeEnd
  label?: string
  color?: CanvasNodeColor
  lineStyle?: CanvasEdgeLineStyle
}

export interface CanvasViewport {
  x: number
  y: number
  zoom: number // Typically 0.1 to 2.0
}

export interface CanvasData {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  viewport?: CanvasViewport
}
