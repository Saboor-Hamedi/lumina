import {
  CanvasShapeType,
  CanvasNodeColor,
  CanvasEdgeLineStyle,
  CanvasNode,
  CanvasEdge,
  CanvasViewport
} from '../types'
import { CanvasAlignmentType, CanvasDistributionType } from '../utils/canvasAlignment'

export type StudioTab = 'shapes' | 'connectors' | 'grid' | 'export'

export interface StudioStats {
  totalNodes: number
  shapeCount: number
  noteCount: number
  textCount: number
  linkCount: number
  edgeCount: number
}

export interface ConvasToolBarRightProps {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onResetViewport: () => void
  onZoomToFit?: () => void
  onSetZoom?: (targetZoom: number) => void
  onDeleteSelected: () => void
  canDelete: boolean
  onAddShape?: (
    shapeType: CanvasShapeType,
    width: number,
    height: number,
    color?: CanvasNodeColor
  ) => void
  onCopyImage?: () => void
  onExportPNG?: () => void
  onExportSVG?: () => void
  onOpenDrawer?: () => void
  hasSelectedNodes?: boolean
  selectedCount?: number
  selectedColor?: CanvasNodeColor
  onUpdateSelectedColor?: (color: CanvasNodeColor) => void
  snapToGrid?: boolean
  onToggleSnapToGrid?: () => void
  onSnapAllToGrid?: () => void
  isMiniMapOpen?: boolean
  onToggleMiniMap?: () => void
  nodes?: CanvasNode[]
  edges?: CanvasEdge[]
  selectedEdgeId?: string | null
  defaultLineStyle?: CanvasEdgeLineStyle
  onChangeDefaultLineStyle?: (style: CanvasEdgeLineStyle) => void
  defaultEndpoints?: 'directed' | 'bidirectional' | 'none'
  onChangeDefaultEndpoints?: (mode: 'directed' | 'bidirectional' | 'none') => void
  onAlignSelection?: (alignment: CanvasAlignmentType) => void
  onDistributeSelection?: (direction: CanvasDistributionType) => void
  onUndo?: () => void
  canUndo?: boolean
  onRedo?: () => void
  canRedo?: boolean
  viewport?: CanvasViewport
  containerRect?: { width: number; height: number } | null
  onPanTo?: (canvasCenterX: number, canvasCenterY: number) => void
}
