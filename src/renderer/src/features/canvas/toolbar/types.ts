import {
  CanvasShapeType,
  CanvasNodeColor,
  CanvasEdgeLineStyle,
  CanvasNode,
  CanvasEdge
} from '../types'
import { CanvasAlignmentType, CanvasDistributionType } from '../canvasAlignment'

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
  snapToGrid?: boolean
  onToggleSnapToGrid?: () => void
  onSnapAllToGrid?: () => void
  isMiniMapOpen?: boolean
  onToggleMiniMap?: () => void
  nodes?: CanvasNode[]
  edges?: CanvasEdge[]
  defaultLineStyle?: CanvasEdgeLineStyle
  onChangeDefaultLineStyle?: (style: CanvasEdgeLineStyle) => void
  defaultEndpoints?: 'directed' | 'bidirectional' | 'none'
  onChangeDefaultEndpoints?: (mode: 'directed' | 'bidirectional' | 'none') => void
  onAlignSelection?: (alignment: CanvasAlignmentType) => void
  onDistributeSelection?: (direction: CanvasDistributionType) => void
}
