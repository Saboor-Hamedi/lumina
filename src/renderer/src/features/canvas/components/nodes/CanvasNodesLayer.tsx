/**
 * ============================================================================
 * Lumina Canvas Nodes Layer (CanvasNodesLayer.tsx)
 * ============================================================================
 * Coordinates rendering of canvas cards, vector shapes, and contextual
 * multi-selection alignment action bars.
 * ============================================================================
 */

import React from 'react'
import { CanvasNode, CanvasNodeColor } from '../../types'
import { CanvasNodeCard } from './CanvasNodeCard'
import { CanvasSelectionToolbar } from '../controls/CanvasSelectionToolbar'
import { CanvasAlignmentType, CanvasDistributionType } from '../../utils/canvasAlignment'

export interface CanvasNodesLayerProps {
  nodes: CanvasNode[]
  selectedNodeIds: string[]
  editingNodeId: string | null
  editingField: 'title' | 'text' | null
  snappedPortTargetNodeId?: string | null
  snappedPortSide?: any
  selectionBox: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } | null
  onNodeMouseDown: (e: React.MouseEvent, node: CanvasNode) => void
  onPortMouseDown: (e: React.MouseEvent, nodeId: string, side: any) => void
  onResizeMouseDown: (e: React.MouseEvent, node: CanvasNode) => void
  onStartEditing: (id: string, field: 'title' | 'text') => void
  onStopEditing: () => void
  onUpdateTitle: (id: string, title: string) => void
  onUpdateText: (id: string, text: string) => void
  onCycleColor: (id: string) => void
  onDuplicateNode: (id: string) => void
  onDeleteNode: (id: string) => void
  onAlignSelection: (alignment: CanvasAlignmentType) => void
  onDistributeSelection: (direction: CanvasDistributionType) => void
  onDuplicateSelection: () => void
  onCycleSelectionColor: () => void
  onDeleteSelection: () => void
  onSnapSelectionToGrid: () => void
}

export const CanvasNodesLayer: React.FC<CanvasNodesLayerProps> = React.memo(
  ({
    nodes,
    selectedNodeIds,
    editingNodeId,
    editingField,
    snappedPortTargetNodeId,
    snappedPortSide,
    selectionBox,
    onNodeMouseDown,
    onPortMouseDown,
    onResizeMouseDown,
    onStartEditing,
    onStopEditing,
    onUpdateTitle,
    onUpdateText,
    onCycleColor,
    onDuplicateNode,
    onDeleteNode,
    onAlignSelection,
    onDistributeSelection,
    onDuplicateSelection,
    onCycleSelectionColor,
    onDeleteSelection,
    onSnapSelectionToGrid
  }) => {
    return (
      <>
        {/* Render Node Cards (Memoized CanvasNodeCard components) */}
        {nodes.map((node) => (
          <CanvasNodeCard
            key={node.id}
            node={node}
            isSelected={selectedNodeIds.includes(node.id)}
            isMultiSelection={selectedNodeIds.length > 1}
            isEditing={editingNodeId === node.id}
            editingField={editingNodeId === node.id ? editingField : null}
            snappedPortSide={snappedPortTargetNodeId === node.id ? snappedPortSide : null}
            onNodeMouseDown={onNodeMouseDown}
            onPortMouseDown={onPortMouseDown}
            onResizeMouseDown={onResizeMouseDown}
            onStartEditing={onStartEditing}
            onStopEditing={onStopEditing}
            onUpdateTitle={onUpdateTitle}
            onUpdateText={onUpdateText}
            onCycleColor={onCycleColor}
            onDuplicateNode={onDuplicateNode}
            onDeleteNode={onDeleteNode}
          />
        ))}

        {/* Floating Multi-Selection Action Bar (Alignment, Distribution, Duplicate, Color, Delete, Snap) */}
        {selectionBox && selectedNodeIds.length > 1 && (
          <CanvasSelectionToolbar
            selectionBox={selectionBox}
            selectedCount={selectedNodeIds.length}
            onAlign={onAlignSelection}
            onDistribute={onDistributeSelection}
            onDuplicate={onDuplicateSelection}
            onCycleColor={onCycleSelectionColor}
            onDelete={onDeleteSelection}
            onSnapToGrid={onSnapSelectionToGrid}
          />
        )}
      </>
    )
  }
)

CanvasNodesLayer.displayName = 'CanvasNodesLayer'
export default CanvasNodesLayer
