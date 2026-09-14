/**
 * inlineTypes.ts - Data types for the detached Inline Drawing Canvas
 */

export type InlineShapeType =
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

export type InlineColor =
  | 'default'
  | 'yellow'
  | 'blue'
  | 'green'
  | 'purple'
  | 'red'
  | 'orange'
  | 'cyan'

export interface InlineNode {
  id: string
  shape: InlineShapeType
  x: number
  y: number
  width: number
  height: number
  color: InlineColor
  title: string
  text?: string
}

export interface InlineViewport {
  x: number
  y: number
  zoom: number
}

export type InlineEdgeSide = 'top' | 'right' | 'bottom' | 'left'

export interface InlineEdge {
  id: string
  fromNode: string
  fromSide?: InlineEdgeSide
  toNode: string
  toSide?: InlineEdgeSide
  color?: InlineColor
}

export interface InlineDrawingData {
  nodes: InlineNode[]
  edges: InlineEdge[]
  viewport: InlineViewport
}
