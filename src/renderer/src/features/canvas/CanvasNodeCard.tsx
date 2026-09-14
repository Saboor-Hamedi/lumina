/**
 * ============================================================================
 * Lumina Canvas Node Card
 * ============================================================================
 * Memoized card component rendering text notes, markdown documents, images,
 * and PDF files on the infinite spatial canvas.
 *
 * Performance features:
 * - MemoizedMarkdownPreview prevents re-parsing Markdown AST when moving/dragging
 * - Custom React.memo comparator avoids re-renders when other canvas elements move
 * - Isolated scrolling prevents canvas wheel pan hijacking
 * - Interactive connection ports and corner resize handles
 * ============================================================================
 */

import React, { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ExternalLink, Palette, X, FileText } from 'lucide-react'
import { CanvasNode, CanvasEdgeSide } from './types'
import { stripFrontmatter } from './canvasUtils'
import { CanvasImagePreview } from './CanvasImagePreview'
import { useVaultStore } from '../../core/store/workspaceStore'
import ToolTip from '../../components/atoms/ToolTip'

/**
 * Isolated memoized preview for markdown notes.
 * Ensures large (2,000+ words) notes do not re-parse Markdown on mouse movement.
 */
const MemoizedMarkdownPreview = React.memo<{ text: string }>(({ text }) => {
  const strippedText = useMemo(() => stripFrontmatter(text || ''), [text])
  if (!strippedText) {
    return <span className="placeholder">Double-click to type...</span>
  }
  return (
    <div className="lumina-canvas-markdown" dir="auto">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {strippedText}
      </ReactMarkdown>
    </div>
  )
})
MemoizedMarkdownPreview.displayName = 'MemoizedMarkdownPreview'

export interface CanvasNodeCardProps {
  node: CanvasNode
  isSelected: boolean
  isEditing: boolean
  editingField: 'title' | 'text' | null
  snappedPortSide?: CanvasEdgeSide | null
  onNodeMouseDown: (e: React.MouseEvent, node: CanvasNode) => void
  onPortMouseDown: (e: React.MouseEvent, nodeId: string, side: CanvasEdgeSide) => void
  onResizeMouseDown: (e: React.MouseEvent, node: CanvasNode) => void
  onStartEditing: (nodeId: string, field: 'title' | 'text') => void
  onStopEditing: () => void
  onUpdateTitle: (nodeId: string, title: string) => void
  onUpdateText: (nodeId: string, text: string) => void
  onCycleColor: (nodeId: string) => void
  onDeleteNode: (nodeId: string) => void
}

export const CanvasNodeCard: React.FC<CanvasNodeCardProps> = React.memo(
  ({
    node,
    isSelected,
    isEditing,
    editingField,
    snappedPortSide,
    onNodeMouseDown,
    onPortMouseDown,
    onResizeMouseDown,
    onStartEditing,
    onStopEditing,
    onUpdateTitle,
    onUpdateText,
    onCycleColor,
    onDeleteNode
  }) => {
    const nodeColorClass = node.color ? `color-${node.color}` : 'color-default'

    return (
      <div
        data-node-id={node.id}
        className={`lumina-canvas-node ${nodeColorClass} ${isSelected ? 'selected' : ''}`}
        style={{
          left: `${node.x}px`,
          top: `${node.y}px`,
          width: `${node.width}px`,
          height: `${node.height}px`
        }}
        onMouseDown={(e) => onNodeMouseDown(e, node)}
      >
        {/* Connection Ports (Knobs appearing on hover for drag/click linking & magnetic socket docking) */}
        <div
          className={`lumina-canvas-port port-top ${snappedPortSide === 'top' ? 'is-magnetic-snap' : ''}`}
          data-node-id={node.id}
          data-port-side="top"
          title="Connect top"
          onMouseDown={(e) => onPortMouseDown(e, node.id, 'top')}
          onClick={(e) => onPortMouseDown(e, node.id, 'top')}
        />
        <div
          className={`lumina-canvas-port port-right ${snappedPortSide === 'right' ? 'is-magnetic-snap' : ''}`}
          data-node-id={node.id}
          data-port-side="right"
          title="Connect right"
          onMouseDown={(e) => onPortMouseDown(e, node.id, 'right')}
          onClick={(e) => onPortMouseDown(e, node.id, 'right')}
        />
        <div
          className={`lumina-canvas-port port-bottom ${snappedPortSide === 'bottom' ? 'is-magnetic-snap' : ''}`}
          data-node-id={node.id}
          data-port-side="bottom"
          title="Connect bottom"
          onMouseDown={(e) => onPortMouseDown(e, node.id, 'bottom')}
          onClick={(e) => onPortMouseDown(e, node.id, 'bottom')}
        />
        <div
          className={`lumina-canvas-port port-left ${snappedPortSide === 'left' ? 'is-magnetic-snap' : ''}`}
          data-node-id={node.id}
          data-port-side="left"
          title="Connect left"
          onMouseDown={(e) => onPortMouseDown(e, node.id, 'left')}
          onClick={(e) => onPortMouseDown(e, node.id, 'left')}
        />

        {/* Card Header */}
        <div className="lumina-canvas-node-header">
          {isEditing && editingField === 'title' ? (
            <input
              autoFocus
              dir="auto"
              className="lumina-canvas-title-input"
              defaultValue={node.title || ''}
              onBlur={(e) => {
                onUpdateTitle(node.id, e.target.value.trim() || 'Untitled')
                onStopEditing()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onUpdateTitle(node.id, e.currentTarget.value.trim() || 'Untitled')
                  onStopEditing()
                }
                if (e.key === 'Escape') onStopEditing()
              }}
            />
          ) : (
            <span
              className="lumina-canvas-node-title"
              dir="auto"
              onDoubleClick={(e) => {
                e.stopPropagation()
                onStartEditing(node.id, 'title')
              }}
              title="Double-click to edit title"
            >
              {node.type === 'pdf' && (
                <span className="lumina-canvas-pdf-badge" style={{ marginRight: 6 }}>
                  PDF
                </span>
              )}
              {node.title ||
                (node.type === 'image'
                  ? 'Image'
                  : node.type === 'pdf'
                    ? 'PDF Document'
                    : 'Note Card')}
            </span>
          )}

          <div className="lumina-canvas-node-actions">
            {/* Open note/image/pdf in workspace tab */}
            {node.file && (
              <ToolTip text="Open in Tab" position="top">
                <button
                  className="lumina-canvas-action-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    useVaultStore.getState().setActiveTabId(node.file!)
                  }}
                >
                  <ExternalLink size={12} />
                </button>
              </ToolTip>
            )}

            <ToolTip text="Change Color" position="top">
              <button
                className="lumina-canvas-action-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  onCycleColor(node.id)
                }}
              >
                <Palette size={12} />
              </button>
            </ToolTip>

            <ToolTip text="Delete Node" position="top">
              <button
                className="lumina-canvas-action-btn delete"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteNode(node.id)
                }}
              >
                <X size={12} />
              </button>
            </ToolTip>
          </div>
        </div>

        {/* Card Body: PDF, Image, or Markdown Preview */}
        {node.type === 'pdf' ? (
          <div
            className="lumina-canvas-pdf-preview"
            onWheel={(e) => e.stopPropagation()}
          >
            <FileText size={32} color="#ef4444" />
            {node.file ? (
              <button
                className="lumina-canvas-pdf-open-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  useVaultStore.getState().setActiveTabId(node.file!)
                }}
              >
                <ExternalLink size={13} />
                Open PDF Tab
              </button>
            ) : (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {node.title}
              </span>
            )}
          </div>
        ) : node.type === 'image' ? (
          <CanvasImagePreview
            url={node.url}
            relativePath={node.text || node.file}
            title={node.title}
          />
        ) : (
          <div
            className="lumina-canvas-node-body"
            onWheel={(e) => e.stopPropagation()}
            onDoubleClick={(e) => {
              e.stopPropagation()
              onStartEditing(node.id, 'text')
            }}
          >
            {isEditing && editingField === 'text' ? (
              <textarea
                autoFocus
                dir="auto"
                className="lumina-canvas-text-area"
                defaultValue={node.text || ''}
                onBlur={(e) => {
                  onUpdateText(node.id, e.target.value)
                  onStopEditing()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    onUpdateText(node.id, e.currentTarget.value)
                    onStopEditing()
                  }
                  if (e.key === 'Escape') onStopEditing()
                }}
              />
            ) : (
              <MemoizedMarkdownPreview text={node.text || ''} />
            )}
          </div>
        )}

        {/* Bottom-right Corner Resize Handle */}
        <div
          className="lumina-canvas-resize-handle handle-br"
          title="Drag to resize card"
          onMouseDown={(e) => onResizeMouseDown(e, node)}
        />
      </div>
    )
  },
  (prev, next) => {
    // Only re-render if node data, selection, editing state, or snapped port changed
    return (
      prev.node === next.node &&
      prev.isSelected === next.isSelected &&
      prev.isEditing === next.isEditing &&
      prev.editingField === next.editingField &&
      prev.snappedPortSide === next.snappedPortSide
    )
  }
)

CanvasNodeCard.displayName = 'CanvasNodeCard'

export default CanvasNodeCard
