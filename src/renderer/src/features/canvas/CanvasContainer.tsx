/**
 * ============================================================================
 * Lumina Infinite Spatial Canvas Container (`CanvasContainer.tsx`)
 * ============================================================================
 * Main canvas orchestrator for visual thinking, research diagramming,
 * mind-mapping, and media organization.
 *
 * Modular Architecture:
 * - Core State: `useCanvas.ts`
 * - Edge & Port Actions: `useCanvasEdgeActions.ts`
 * - Selection, Alignment & Style Actions: `useCanvasSelectionActions.ts`
 * - Export Actions: `useCanvasExportActions.ts`
 * - Viewport & Creation Actions: `useCanvasViewportActions.ts`
 * - Pointer & Gesture Physics: `useCanvasGestures.ts`
 * - External & Explorer Drops: `useCanvasDrop.ts`
 * - Diagram Templates: `canvasTemplates.ts`
 * ============================================================================
 */

import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react'
import {
  useCanvas,
  useCanvasGestures,
  useCanvasDrop,
  useCanvasShortcuts,
  useCanvasPaste,
  useCanvasEdgeActions,
  useCanvasSelectionActions,
  useCanvasExportActions,
  useCanvasViewportActions
} from './hooks'
import { CanvasData, CanvasNode, CanvasNodeColor, CanvasToolMode } from './types'
import {
  CanvasEdgesLayer,
  CanvasStrokesLayer,
  CanvasNodesLayer,
  CanvasAlignmentGuidesLayer,
  ConvasToolBarCenter
} from './components'
import { ConvasToolBarRight } from './toolbar'
import { Notification, useToast } from '../../core/notification'
import './css/canvas-base.css'
import './css/canvas-toolbar.css'
import './css/canvas-studio.css'
import './css/canvas-dropdown.css'
import './css/canvas-nodes.css'
import './css/canvas-shapes.css'
import './css/canvas-selection.css'
import './css/canvas-minimap.css'
import './css/canvas-toast.css'

export interface ConvasContainerProps {
  initialData?: CanvasData
  onChange?: (data: CanvasData) => void
  isSelected?: boolean
}

export type CanvasContainerProps = ConvasContainerProps

export const CanvasContainer: React.FC<CanvasContainerProps> = ({
  initialData,
  onChange,
  isSelected = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const { toast, showToast, clearToast } = useToast()

  // Local editing & tool states
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<'title' | 'text' | null>(null)
  const [toolMode, setToolMode] = useState<CanvasToolMode>('select')
  const [pencilColor, setPencilColor] = useState<CanvasNodeColor>('default')
  const [pencilWidth, setPencilWidth] = useState<number>(4)
  const [pencilHighlighter, setPencilHighlighter] = useState<boolean>(false)
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [snapToGrid, setSnapToGrid] = useState<boolean>(() => {
    if (typeof initialData?.snapToGrid === 'boolean') return initialData.snapToGrid
    try {
      return localStorage.getItem('lumina_canvas_snap_to_grid') === 'true'
    } catch {
      return false
    }
  })
  const [isMiniMapOpen, setIsMiniMapOpen] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem('lumina_canvas_snap_to_grid', String(snapToGrid))
    } catch {
      // Ignore storage errors in restricted environments
    }
  }, [snapToGrid])

  useEffect(() => {
    if (typeof initialData?.snapToGrid === 'boolean') {
      setSnapToGrid(initialData.snapToGrid)
    }
  }, [initialData?.snapToGrid])

  // Central Canvas State Hook
  const {
    nodes,
    edges,
    strokes,
    viewport,
    selectedNodeIds,
    selectedEdgeId,
    setEdges,
    setViewport,
    setSelectedNodeIds,
    setSelectedEdgeId,
    screenToCanvas,
    zoomAt,
    resetViewport,
    zoomToFit,
    panBy,
    addNode,
    addNodes,
    updateNodePosition,
    updateNodesPositions,
    updateNodeSize,
    updateNodeText,
    updateNodeTitle,
    updateNodeColor,
    updateNodesShapes,
    updateNodesFontSize,
    deleteNode,
    deleteSelected,
    duplicateNodes,
    copyNodes,
    pasteNodes,
    hasCopiedNodes,
    snapNodesToGrid,
    updateEdgeLineStyle,
    updateEdgeStrokeDash,
    updateEdgeColor,
    deleteEdge,
    updateEdgeLabel,
    updateEdgeEndpoints,
    addStroke,
    deleteStrokes,
    clearStrokes,
    clearCanvas,
    undo,
    redo,
    canUndo,
    canRedo,
    pushHistory
  } = useCanvas({ initialData, onChange, snapToGrid })

  // Fast O(1) node lookup map for dynamic edge routing & port queries
  const nodeMap = useMemo(() => {
    const map = new Map<string, CanvasNode>()
    for (let i = 0; i < nodes.length; i++) {
      map.set(nodes[i].id, nodes[i])
    }
    return map
  }, [nodes])

  // Edge connections, selection, port docking, and styling
  const {
    selectedEdgeIds,
    setSelectedEdgeIds,
    connectedPortsMap,
    activeLineStyle,
    activeEndpoints,
    completeConnection,
    handleSelectEdge,
    handleDeleteEdge,
    handleChangeLineStyle,
    handleChangeEndpoints,
    handleApplyToAllEdges
  } = useCanvasEdgeActions({
    edges,
    nodeMap,
    selectedNodeIds,
    selectedEdgeId,
    setEdges,
    setSelectedEdgeId,
    setSelectedNodeIds,
    deleteEdge,
    updateEdgeLineStyle,
    updateEdgeEndpoints,
    pushHistory
  })

  // Selection metadata, alignment, distribution, color, shape, and font-size actions
  const {
    selectionBox,
    selectedColor,
    canReplaceShape,
    selectedShapeType,
    selectedColorHex,
    canAdjustFontSize,
    selectedFontSize,
    handleAlignSelection,
    handleDistributeSelection,
    handleCycleSelectionColor,
    handleUpdateSelectionColor,
    handleCycleColor,
    handleAdjustFontSize,
    handleReplaceShape,
    handleDeleteSelected
  } = useCanvasSelectionActions({
    nodes,
    edges,
    nodeMap,
    selectedNodeIds,
    selectedEdgeId,
    selectedEdgeIds,
    setEdges,
    setSelectedEdgeId,
    setSelectedEdgeIds,
    updateNodesPositions,
    updateNodeColor,
    updateEdgeColor,
    updateNodesShapes,
    updateNodesFontSize,
    deleteSelected,
    pushHistory
  })

  // Clipboard snapshot, PNG, and SVG export actions
  const { handleCopyImage, handleExportPNG, handleExportSVG } = useCanvasExportActions({
    nodes,
    edges,
    strokes,
    selectedNodeIds,
    showToast
  })

  // Viewport, wheel, double-click, creation, template, and grid-snap actions
  const {
    handleToggleSnapToGrid,
    handlePanTo,
    handleDoubleClick,
    handleAddSticky,
    handleAddShape,
    handleInsertTemplate,
    handleSetZoom,
    handleZoomIn,
    handleZoomOut,
    handleZoomToFit,
    handleSnapAllToGrid
  } = useCanvasViewportActions({
    containerRef,
    nodes,
    viewport,
    selectedNodeIds,
    toolMode,
    snapToGrid,
    setSnapToGrid,
    setViewport,
    setEdges,
    setEditingNodeId,
    setEditingField,
    screenToCanvas,
    zoomAt,
    zoomToFit,
    panBy,
    addNode,
    addNodes,
    updateNodesPositions,
    snapNodesToGrid,
    showToast
  })

  // Gesture & Pointer Interactions Engine
  const {
    connecting,
    setConnecting,
    connectingRef,
    snappedTarget,
    setSnappedTarget,
    snappedTargetRef,
    mouseCanvasPos,
    activeStroke,
    marqueeBox,
    isPanningState,
    handleCanvasMouseDown,
    handleResizeMouseDown,
    handleNodeMouseDown,
    handlePortMouseDown,
    alignmentGuides
  } = useCanvasGestures({
    containerRef,
    nodes,
    nodeMap,
    strokes,
    viewport,
    selectedNodeIds,
    selectedEdgeId,
    setSelectedEdgeId,
    setSelectedEdgeIds,
    toolMode,
    setToolMode,
    pencilColor,
    pencilWidth,
    pencilHighlighter,
    isSpacePressed,
    snapToGrid,
    screenToCanvas,
    zoomAt,
    panBy,
    setSelectedNodeIds,
    updateNodePosition,
    updateNodesPositions,
    updateNodeSize,
    completeConnection,
    addNode,
    addStroke,
    deleteStrokes,
    setEditingNodeId,
    setEditingField,
    pushHistory
  })

  // Drag and Drop Ingestion Engine
  const { handleDragOver, handleDrop } = useCanvasDrop({
    containerRef,
    screenToCanvas,
    addNode,
    addNodes,
    snapToGrid,
    setEditingNodeId,
    setEditingField,
    onToast: showToast
  })

  // Clipboard Paste Engine
  useCanvasPaste({
    containerRef,
    screenToCanvas,
    viewport,
    mouseCanvasPos,
    snapToGrid,
    addNode,
    hasCopiedNodes,
    pasteNodes,
    onToast: showToast,
    isActive: isSelected ?? true
  })

  useCanvasShortcuts({
    isActive: isSelected ?? true,
    containerRef,
    nodes,
    edges,
    selectedNodeIds,
    selectedEdgeId,
    snapToGrid,
    deleteSelected,
    deleteEdge,
    setSelectedEdgeId,
    setSelectedNodeIds,
    duplicateNodes,
    copyNodes,
    pasteNodes,
    hasCopiedNodes,
    updateNodesPositions,
    updateEdgeLineStyle,
    updateEdgeColor,
    updateEdgeEndpoints,
    handleToggleSnapToGrid,
    zoomToFit,
    resetViewport,
    setToolMode,
    setIsSpacePressed,
    setConnecting,
    connectingRef,
    setSnappedTarget,
    snappedTargetRef,
    setEditingNodeId,
    setEditingField,
    undo,
    redo,
    pushHistory
  })

  const handleClearCanvas = useCallback(() => {
    if (clearCanvas()) {
      setSelectedEdgeIds([])
      setEditingNodeId(null)
      setEditingField(null)
    }
  }, [clearCanvas, setSelectedEdgeIds])

  const handleStartEditing = useCallback((id: string, field: 'title' | 'text') => {
    setEditingNodeId(id)
    setEditingField(field)
  }, [])

  const handleStopEditing = useCallback(() => {
    setEditingNodeId(null)
    setEditingField(null)
  }, [])

  const handleDuplicateSingleNode = useCallback((id: string) => duplicateNodes([id]), [duplicateNodes])
  const handleDuplicateSelection = useCallback(() => duplicateNodes(), [duplicateNodes])
  const handleDeleteSelectionNodes = useCallback(() => deleteSelected(), [deleteSelected])
  const handleEraseSingleStroke = useCallback((strokeId: string) => deleteStrokes([strokeId], true), [deleteStrokes])
  const handleCreateNewCanvas = useCallback(() => {
    window.dispatchEvent(new CustomEvent('trigger-new-canvas'))
  }, [])

  const handleCanvasContextMenu = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement | null
    if (target?.closest?.('input, textarea')) return
    e.preventDefault()
  }, [])

  const cursorStyle = isPanningState
    ? 'grabbing'
    : connecting || toolMode === 'pencil' || toolMode === 'eraser'
      ? 'crosshair'
      : toolMode === 'text'
        ? 'text'
        : toolMode === 'hand' || isSpacePressed
          ? 'grab'
          : 'default'

  return (
    <div
      ref={containerRef}
      className={`lumina-canvas-container tool-${toolMode} ${isPanningState ? 'is-panning' : ''} ${connecting ? 'is-connecting' : ''} ${snapToGrid ? 'is-grid-snapping' : ''} ${selectedNodeIds.length > 1 ? 'is-multi-selecting' : ''}`}
      style={{
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        backgroundSize: `${(snapToGrid ? 20 : 24) * viewport.zoom}px ${(snapToGrid ? 20 : 24) * viewport.zoom}px`,
        cursor: cursorStyle
      }}
      onPointerDown={handleCanvasMouseDown}
      onMouseDown={handleCanvasMouseDown}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleCanvasContextMenu}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div
        className="lumina-canvas-viewport"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`
        }}
      >
        <CanvasEdgesLayer
          edges={edges}
          nodeMap={nodeMap}
          connecting={connecting}
          snappedTarget={snappedTarget}
          mouseCanvasPos={mouseCanvasPos}
          selectedEdgeId={selectedEdgeId}
          selectedEdgeIds={selectedEdgeIds}
          isMultiSelectionActive={selectedNodeIds.length > 1}
          onSelectEdge={handleSelectEdge}
          onDeleteEdge={handleDeleteEdge}
          onUpdateEdgeLineStyle={updateEdgeLineStyle}
          onUpdateEdgeStrokeDash={updateEdgeStrokeDash}
          onUpdateEdgeLabel={updateEdgeLabel}
          onUpdateEdgeEndpoints={updateEdgeEndpoints}
          onUpdateEdgeColor={updateEdgeColor}
          snapToGrid={snapToGrid}
        />

        <CanvasNodesLayer
          nodes={nodes}
          selectedNodeIds={selectedNodeIds}
          editingNodeId={editingNodeId}
          editingField={editingField}
          snappedPortTargetNodeId={snappedTarget?.nodeId}
          snappedPortSide={snappedTarget?.side}
          connectedPortsMap={connectedPortsMap}
          selectionBox={selectionBox}
          selectedShapeType={selectedShapeType}
          canReplaceShape={canReplaceShape}
          selectedColorHex={selectedColorHex}
          canAdjustFontSize={canAdjustFontSize}
          selectedFontSize={selectedFontSize}
          onAdjustFontSize={handleAdjustFontSize}
          onNodeMouseDown={handleNodeMouseDown}
          onPortMouseDown={handlePortMouseDown}
          onResizeMouseDown={handleResizeMouseDown}
          onStartEditing={handleStartEditing}
          onStopEditing={handleStopEditing}
          onUpdateTitle={updateNodeTitle}
          onUpdateText={updateNodeText}
          onCycleColor={handleCycleColor}
          onDuplicateNode={handleDuplicateSingleNode}
          onDeleteNode={deleteNode}
          onReplaceShape={handleReplaceShape}
          onAlignSelection={handleAlignSelection}
          onDistributeSelection={handleDistributeSelection}
          onDuplicateSelection={handleDuplicateSelection}
          onCycleSelectionColor={handleCycleSelectionColor}
          onDeleteSelection={handleDeleteSelectionNodes}
          onSnapSelectionToGrid={handleSnapAllToGrid}
        />

        <CanvasStrokesLayer
          strokes={strokes}
          activeStroke={activeStroke}
          toolMode={toolMode}
          onEraseStroke={handleEraseSingleStroke}
        />

        <CanvasAlignmentGuidesLayer guides={alignmentGuides} />

        {marqueeBox && marqueeBox.width > 2 && marqueeBox.height > 2 && (
          <div
            className="lumina-canvas-marquee-box"
            style={{
              left: `${marqueeBox.x}px`,
              top: `${marqueeBox.y}px`,
              width: `${marqueeBox.width}px`,
              height: `${marqueeBox.height}px`
            }}
          />
        )}
      </div>

      <ConvasToolBarCenter
        toolMode={toolMode}
        setToolMode={setToolMode}
        onCreateNewCanvas={handleCreateNewCanvas}
        onAddSticky={handleAddSticky}
        onAddShape={handleAddShape}
        pencilColor={pencilColor}
        onChangePencilColor={setPencilColor}
        pencilWidth={pencilWidth}
        onChangePencilWidth={setPencilWidth}
        pencilHighlighter={pencilHighlighter}
        onTogglePencilHighlighter={() => setPencilHighlighter((prev) => !prev)}
        onUndo={undo}
        canUndo={canUndo}
        onRedo={redo}
        canRedo={canRedo}
        onClearStrokes={clearStrokes}
        hasStrokes={strokes.length > 0}
        onClearCanvas={handleClearCanvas}
        hasContent={nodes.length > 0 || edges.length > 0 || strokes.length > 0}
      />

      <ConvasToolBarRight
        zoom={viewport.zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetViewport={resetViewport}
        onZoomToFit={handleZoomToFit}
        onSetZoom={handleSetZoom}
        onDeleteSelected={handleDeleteSelected}
        canDelete={selectedNodeIds.length > 0 || !!selectedEdgeId || selectedEdgeIds.length > 0}
        onAddShape={handleAddShape}
        onCopyImage={handleCopyImage}
        onExportPNG={handleExportPNG}
        onExportSVG={handleExportSVG}
        hasSelectedNodes={selectedNodeIds.length > 0}
        selectedCount={selectedNodeIds.length + Math.max(selectedEdgeIds.length, selectedEdgeId ? 1 : 0)}
        selectedColor={selectedColor}
        onUpdateSelectedColor={handleUpdateSelectionColor}
        snapToGrid={snapToGrid}
        onToggleSnapToGrid={handleToggleSnapToGrid}
        onSnapAllToGrid={handleSnapAllToGrid}
        isMiniMapOpen={isMiniMapOpen}
        onToggleMiniMap={() => setIsMiniMapOpen((prev) => !prev)}
        nodes={nodes}
        edges={edges}
        selectedEdgeId={selectedEdgeId}
        selectedEdgeIds={selectedEdgeIds}
        defaultLineStyle={activeLineStyle}
        onChangeDefaultLineStyle={handleChangeLineStyle}
        defaultEndpoints={activeEndpoints}
        onChangeDefaultEndpoints={handleChangeEndpoints}
        onApplyToAllEdges={handleApplyToAllEdges}
        onAlignSelection={handleAlignSelection}
        onDistributeSelection={handleDistributeSelection}
        onInsertTemplate={handleInsertTemplate}
        onUndo={undo}
        canUndo={canUndo}
        onRedo={redo}
        canRedo={canRedo}
        viewport={viewport}
        containerRect={
          containerRef.current
            ? { width: containerRef.current.clientWidth, height: containerRef.current.clientHeight }
            : null
        }
        onPanTo={handlePanTo}
      />

      <Notification toast={toast} onClose={clearToast} />
    </div>
  )
}

export const ConvasContainer = CanvasContainer
export const CanvasView = CanvasContainer
export default CanvasContainer
