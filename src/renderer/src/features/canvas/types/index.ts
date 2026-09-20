/**
 * ============================================================================
 * Lumina Infinite Spatial Canvas - Type Definitions (`types/index.ts`)
 * ============================================================================
 * Standardized data models for nodes, edges, viewport transformations, and
 * canvas file persistence (.canvas format compatible with open ecosystem).
 *
 * Types Overview:
 * - `CanvasNodeType`: Distinguishes notes, markdown text cards, shapes, links, images, PDFs.
 * - `CanvasShapeType`: 22 distinct geometric vector diagram shapes.
 * - `CanvasNodeColor`: 9 theme colors (default, red, orange, yellow, green, cyan, purple, blue, pink).
 * - `CanvasNode`: 2D spatial entity model with geometry and payload.
 * - `CanvasEdge`: Directional/undirected wire connecting two node ports.
 * - `CanvasViewport`: 2D translation and zoom transformation matrix.
 * - `CanvasData`: Complete diagram persistence payload.
 * ============================================================================
 */

/**
 * Node entity discriminator representing all supported card and element types.
 */
export type CanvasNodeType =
  | 'note'
  | 'text'
  | 'file'
  | 'link'
  | 'group'
  | 'image'
  | 'pdf'
  | 'shape'
  | 'sticky'

/**
 * Geometric shape identifier supported by the visual diagramming engine.
 * Each shape provides bespoke port snapping ratios and SVG vector definitions.
 */
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
  | 'octagon'
  | 'trapezoid'
  | 'cross'
  | 'pentagon'
  | 'actor'
  | 'envelope'

/**
 * Unified 9-color theme palette for cards, shapes, and connector wires.
 */
export type CanvasNodeColor =
  | 'default'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'cyan'
  | 'purple'
  | 'blue'
  | 'pink'

/**
 * Spatial node entity model on the infinite 2D canvas plane.
 */
export interface CanvasNode {
  /** Unique entity ID (UUID or generated timestamp-based hash) */
  id: string
  /** Node type discriminator */
  type: CanvasNodeType
  /** Optional geometry shape for 'shape' nodes */
  shape?: CanvasShapeType
  /** Optional legacy/alternative shapeType property */
  shapeType?: CanvasShapeType
  /** Canvas X coordinate in virtual canvas pixels */
  x: number
  /** Canvas Y coordinate in virtual canvas pixels */
  y: number
  /** Width in virtual canvas pixels */
  width: number
  /** Height in virtual canvas pixels */
  height: number
  /** Color theme accent */
  color?: CanvasNodeColor
  /** Relative workspace file path (for 'note' or 'file' types) */
  file?: string
  /** Image source URL for 'image' nodes */
  imageUrl?: string
  /** Markdown text or plaintext content */
  text?: string
  /** External hyperlink URL (for 'link' type) */
  url?: string
  /** Header title displayed on cards */
  title?: string
  /** Stacking order layer */
  zIndex?: number
  [key: string]: any
}

/**
 * Wire endpoint arrowhead terminator style.
 */
export type CanvasEdgeEnd = 'none' | 'arrow'

/**
 * Bounding box port side for edge connection.
 */
export type CanvasEdgeSide = 'top' | 'right' | 'bottom' | 'left'

/**
 * Connector wire spline geometry style.
 */
export type CanvasEdgeLineStyle = 'straight' | 'curved' | 'step'

/**
 * Connection wire linking two nodes.
 */
export interface CanvasEdge {
  /** Unique edge ID */
  id: string
  /** Source node ID */
  fromNode: string
  /** Source port side ('top' | 'right' | 'bottom' | 'left') */
  fromSide?: CanvasEdgeSide
  /** Source endpoint terminator ('none' | 'arrow') */
  fromEnd?: CanvasEdgeEnd
  /** Target node ID */
  toNode: string
  /** Target port side ('top' | 'right' | 'bottom' | 'left') */
  toSide?: CanvasEdgeSide
  /** Target endpoint terminator ('none' | 'arrow') */
  toEnd?: CanvasEdgeEnd
  /** Optional relationship annotation label */
  label?: string
  /** Wire accent theme color */
  color?: CanvasNodeColor
  /** Interpolation spline style */
  lineStyle?: CanvasEdgeLineStyle
  /** Routing behavior ('smart' dynamic facing ports vs 'manual' fixed ports) */
  routing?: 'smart' | 'manual'
}

/**
 * Viewport camera transformation matrix.
 */
export interface CanvasViewport {
  /** Horizontal canvas camera translation (px) */
  x: number
  /** Vertical canvas camera translation (px) */
  y: number
  /** Scale factor (clamped 0.1 to 2.5) */
  zoom: number
}

/**
 * Complete serialized canvas document format.
 */
export interface CanvasData {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  viewport?: CanvasViewport
}
