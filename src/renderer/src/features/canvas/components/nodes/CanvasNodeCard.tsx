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
import { ExternalLink, Palette, X, FileText, Copy } from 'lucide-react'
import { CanvasNode, CanvasEdgeSide, CanvasNodeColor } from '../../types'
import { stripFrontmatter, getShapePortRatio, CANVAS_NODE_COLOR_HEX } from '../../utils/canvasUtils'
import { CanvasImagePreview } from './CanvasImagePreview'
import { renderShapeSVG } from '../controls/ConvasShapes'
import { useWorkspaceStore } from '../../../../core/store/workspaceStore'
import ToolTip from '../../../../components/atoms/ToolTip'

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
  isMultiSelection?: boolean
  isEditing: boolean
  editingField: 'title' | 'text' | null
  snappedPortSide?: CanvasEdgeSide | null
  connectedPorts?: Partial<Record<CanvasEdgeSide, { hasArrow: boolean; color?: CanvasNodeColor }>>
  onNodeMouseDown: (e: React.MouseEvent, node: CanvasNode) => void
  onPortMouseDown: (e: React.MouseEvent, nodeId: string, side: CanvasEdgeSide) => void
  onResizeMouseDown: (e: React.MouseEvent, node: CanvasNode) => void
  onStartEditing: (nodeId: string, field: 'title' | 'text') => void
  onStopEditing: () => void
  onUpdateTitle: (nodeId: string, title: string) => void
  onUpdateText: (nodeId: string, text: string) => void
  onCycleColor: (nodeId: string) => void
  onDuplicateNode?: (nodeId: string) => void
  onDeleteNode: (nodeId: string) => void
}

export const CanvasNodeCard: React.FC<CanvasNodeCardProps> = React.memo(
  ({
    node,
    isSelected,
    isMultiSelection = false,
    isEditing,
    editingField,
    snappedPortSide,
    connectedPorts,
    onNodeMouseDown,
    onPortMouseDown,
    onResizeMouseDown,
    onStartEditing,
    onStopEditing,
    onUpdateTitle,
    onUpdateText,
    onCycleColor,
    onDuplicateNode,
    onDeleteNode
  }) => {
    const nodeColorClass = node.color ? `color-${node.color}` : 'color-default'
    const resolvedShape = node.shape || (node as any).shapeType || (node.type === 'shape' ? 'rectangle' : undefined)
    const isShapeNode = node.type === 'shape' || !!resolvedShape
    const isSticky = !isShapeNode && (node.type === 'text' || node.type === 'sticky') && !node.file

    return (
      <div
        data-node-id={node.id}
        className={`lumina-canvas-node ${nodeColorClass} ${isShapeNode ? `is-shape shape-${resolvedShape || 'rectangle'}` : ''} ${isSticky ? 'is-sticky' : ''} ${isSelected ? (isMultiSelection ? 'selected is-multi-selected' : 'selected') : ''}`}
        style={{
          left: `${node.x}px`,
          top: `${node.y}px`,
          width: `${node.width}px`,
          height: `${node.height}px`
        }}
        onMouseDown={(e) => onNodeMouseDown(e, node)}
      >
        {/* Connection Ports (Knobs appearing on hover for drag/click linking & magnetic socket docking) */}
        {(() => {
          let topRatio = isShapeNode && resolvedShape ? getShapePortRatio(resolvedShape, 'top') : null
          const rightRatio = isShapeNode && resolvedShape ? getShapePortRatio(resolvedShape, 'right') : null
          const bottomRatio = isShapeNode && resolvedShape ? getShapePortRatio(resolvedShape, 'bottom') : null
          const leftRatio = isShapeNode && resolvedShape ? getShapePortRatio(resolvedShape, 'left') : null

          // For actor, crown of round head dynamically shifts with container aspect ratio
          if (isShapeNode && resolvedShape === 'actor') {
            const aspect = node.width / (node.height || 1)
            const headRy = (13 * Math.min(2.5, Math.max(0.4, aspect))) / 100
            topRatio = { rx: 0.5, ry: Math.max(0.01, 0.18 - headRy) }
          }

          const sides: CanvasEdgeSide[] = ['top', 'right', 'bottom', 'left']
          const ratios: Record<CanvasEdgeSide, { rx: number; ry: number } | null> = {
            top: topRatio,
            right: rightRatio,
            bottom: bottomRatio,
            left: leftRatio
          }

          return (
            <>
              {sides.map((side) => {
                const ratio = ratios[side]
                const isSnapped = snappedPortSide === side
                const connectedInfo = connectedPorts?.[side]
                const isConnected = !!connectedInfo
                const hasArrow = !!connectedInfo?.hasArrow
                const portColorHex = connectedInfo?.color
                  ? CANVAS_NODE_COLOR_HEX[connectedInfo.color as keyof typeof CANVAS_NODE_COLOR_HEX]
                  : undefined

                const portStyle: React.CSSProperties = {
                  ...(ratio
                    ? { left: `${ratio.rx * 100}%`, top: `${ratio.ry * 100}%`, transform: 'translate(-50%, -50%)', margin: 0 }
                    : {}),
                  ...(portColorHex ? ({ '--port-color': portColorHex } as any) : {})
                }

                return (
                  <div
                    key={side}
                    className={`lumina-canvas-port port-${side} ${isSnapped ? 'is-magnetic-snap' : ''} ${isConnected ? 'is-connected' : ''} ${hasArrow ? 'is-arrow-docked' : ''}`}
                    data-node-id={node.id}
                    data-port-side={side}
                    title={isConnected ? `Connected ${side}${hasArrow ? ' (arrow docked)' : ''}` : `Connect ${side}`}
                    style={portStyle}
                    onMouseDown={(e) => onPortMouseDown(e, node.id, side)}
                    onClick={(e) => onPortMouseDown(e, node.id, side)}
                  />
                )
              })}
            </>
          )
        })()}

        {/* Shape Mode: Vector Graphic Background & Centered Content */}
        {isShapeNode ? (
          <>
            <svg
              className="lumina-canvas-shape-svg"
              viewBox="0 0 100 100"
              width="100%"
              height="100%"
              preserveAspectRatio={
                resolvedShape === 'circle'
                  ? 'xMidYMid meet'
                  : 'none'
              }
            >
              {renderShapeSVG(
                resolvedShape || 'rectangle',
                'var(--node-accent, var(--text-accent, #38bdf8))',
                'var(--node-accent, var(--text-accent, #38bdf8))',
                0.04,
                isSelected ? 1.35 : 1.2,
                node.width,
                node.height
              )}
            </svg>

            {/* Shape Floating Actions (Cycle Color & Delete - suppressed during multi-selection) */}
            {!isMultiSelection && (
              <div className={`lumina-canvas-shape-actions ${isSelected ? 'is-selected' : ''}`}>
                <ToolTip text="Change Color" position="top">
                  <button
                    className="lumina-canvas-action-btn"
                    title="Change Color"
                    aria-label="Change Color"
                    onClick={(e) => {
                      e.stopPropagation()
                      onCycleColor(node.id)
                    }}
                  >
                    <Palette size={12} />
                  </button>
                </ToolTip>

                {onDuplicateNode && (
                  <ToolTip text="Duplicate Shape (Alt+D)" position="top">
                    <button
                      className="lumina-canvas-action-btn"
                      title="Duplicate Shape (Alt+D)"
                      aria-label="Duplicate Shape"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDuplicateNode(node.id)
                      }}
                    >
                      <Copy size={12} />
                    </button>
                  </ToolTip>
                )}

                <ToolTip text="Delete Shape" position="top">
                  <button
                    className="lumina-canvas-action-btn delete"
                    title="Delete Shape"
                    aria-label="Delete Shape"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteNode(node.id)
                    }}
                  >
                    <X size={12} />
                  </button>
                </ToolTip>
              </div>
            )}

            {/* Shape Centered Text */}
            <div
              className="lumina-canvas-shape-content"
              onMouseDown={(e) => {
                if (isEditing && editingField === 'text') {
                  e.stopPropagation()
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation()
                onStartEditing(node.id, 'text')
              }}
            >
              {isEditing && editingField === 'text' ? (
                <textarea
                  autoFocus
                  dir="auto"
                  className="lumina-canvas-shape-input"
                  defaultValue={node.text || ''}
                  ref={(el) => {
                    if (el) {
                      el.style.height = 'auto'
                      el.style.height = `${el.scrollHeight}px`
                      const len = el.value.length
                      el.setSelectionRange(len, len)
                    }
                  }}
                  onInput={(e) => {
                    const el = e.currentTarget
                    el.style.height = 'auto'
                    el.style.height = `${el.scrollHeight}px`
                    onUpdateText(node.id, el.value)
                  }}
                  onBlur={(e) => {
                    onUpdateText(node.id, e.target.value)
                    onStopEditing()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault()
                      e.stopPropagation()
                      onUpdateText(node.id, e.currentTarget.value)
                      e.currentTarget.blur()
                      onStopEditing()
                    }
                    if (e.key === 'Escape') {
                      e.stopPropagation()
                      e.preventDefault()
                      e.currentTarget.blur()
                      onStopEditing()
                    }
                  }}
                />
              ) : (
                <span className="lumina-canvas-shape-text" dir="auto">
                  {node.text ? (
                    <MemoizedMarkdownPreview text={node.text} />
                  ) : (
                    <span className="placeholder">Double-click to type</span>
                  )}
                </span>
              )}
            </div>
          </>
        ) : isSticky ? (
          <>
            {/* Sticky Actions Toolbar (Appears on hover in top-right corner, subtle) */}
            {!isMultiSelection && (
              <div className="lumina-canvas-sticky-actions">
                <ToolTip text="Change Color" position="top">
                  <button
                    className="lumina-canvas-action-btn"
                    aria-label="Change Color"
                    onClick={(e) => {
                      e.stopPropagation()
                      onCycleColor(node.id)
                    }}
                  >
                    <Palette size={12} />
                  </button>
                </ToolTip>

                {onDuplicateNode && (
                  <ToolTip text="Duplicate Note (Alt+D)" position="top">
                    <button
                      className="lumina-canvas-action-btn"
                      aria-label="Duplicate Note"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDuplicateNode(node.id)
                      }}
                    >
                      <Copy size={12} />
                    </button>
                  </ToolTip>
                )}

                <ToolTip text="Delete Note" position="top">
                  <button
                    className="lumina-canvas-action-btn delete"
                    aria-label="Delete Note"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteNode(node.id)
                    }}
                  >
                    <X size={12} />
                  </button>
                </ToolTip>
              </div>
            )}

            {/* Sticky Note Body: no bulky header */}
            <div
              className="lumina-canvas-node-body lumina-canvas-sticky-body"
              onWheel={(e) => e.stopPropagation()}
              onDoubleClick={(e) => {
                e.stopPropagation()
                onStartEditing(node.id, 'text')
              }}
            >
              {/* Accessible title anchor for tests / assistive tools */}
              <span className="sr-only">{node.title || 'Quick Idea'}</span>
              {isEditing && editingField === 'text' ? (
                <textarea
                  autoFocus
                  dir="auto"
                  className="lumina-canvas-text-area lumina-canvas-sticky-textarea"
                  defaultValue={node.text || ''}
                  ref={(el) => {
                    if (el) {
                      const len = el.value.length
                      el.setSelectionRange(len, len)
                    }
                  }}
                  onInput={(e) => {
                    onUpdateText(node.id, e.currentTarget.value)
                  }}
                  onBlur={(e) => {
                    onUpdateText(node.id, e.target.value)
                    onStopEditing()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault()
                      e.stopPropagation()
                      onUpdateText(node.id, e.currentTarget.value)
                      e.currentTarget.blur()
                      onStopEditing()
                    }
                    if (e.key === 'Escape') {
                      e.stopPropagation()
                      e.preventDefault()
                      e.currentTarget.blur()
                      onStopEditing()
                    }
                  }}
                />
              ) : (
                <MemoizedMarkdownPreview text={node.text || ''} />
              )}
            </div>
          </>
        ) : (
          <>
            {/* Card Header */}
            <div className="lumina-canvas-node-header">
              {isEditing && editingField === 'title' ? (
                <input
                  autoFocus
                  dir="auto"
                  className="lumina-canvas-title-input"
                  defaultValue={node.title || ''}
                  ref={(el) => {
                    if (el) {
                      const len = el.value.length
                      el.setSelectionRange(len, len)
                    }
                  }}
                  onInput={(e) => {
                    onUpdateTitle(node.id, e.currentTarget.value)
                  }}
                  onBlur={(e) => {
                    onUpdateTitle(node.id, e.target.value.trim() || 'Untitled')
                    onStopEditing()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      e.stopPropagation()
                      onUpdateTitle(node.id, e.currentTarget.value.trim() || 'Untitled')
                      e.currentTarget.blur()
                      onStopEditing()
                    }
                    if (e.key === 'Escape') {
                      e.stopPropagation()
                      e.preventDefault()
                      e.currentTarget.blur()
                      onStopEditing()
                    }
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

              {!isMultiSelection && (
                <div className="lumina-canvas-node-actions">
                  {/* Open note/image/pdf in workspace tab */}
                  {node.file && (
                    <ToolTip text="Open in Tab" position="top">
                      <button
                        className="lumina-canvas-action-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          useWorkspaceStore.getState().setActiveTabId(node.file!)
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

                  {onDuplicateNode && (
                    <ToolTip text="Duplicate Card (Alt+D)" position="top">
                      <button
                        className="lumina-canvas-action-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDuplicateNode(node.id)
                        }}
                      >
                        <Copy size={12} />
                      </button>
                    </ToolTip>
                  )}

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
              )}
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
                      useWorkspaceStore.getState().setActiveTabId(node.file!)
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
                url={node.url || node.imageUrl}
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
                    ref={(el) => {
                      if (el) {
                        const len = el.value.length
                        el.setSelectionRange(len, len)
                      }
                    }}
                    onInput={(e) => {
                      onUpdateText(node.id, e.currentTarget.value)
                    }}
                    onBlur={(e) => {
                      onUpdateText(node.id, e.target.value)
                      onStopEditing()
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault()
                        e.stopPropagation()
                        onUpdateText(node.id, e.currentTarget.value)
                        e.currentTarget.blur()
                        onStopEditing()
                      }
                      if (e.key === 'Escape') {
                        e.stopPropagation()
                        e.preventDefault()
                        e.currentTarget.blur()
                        onStopEditing()
                      }
                    }}
                  />
                ) : (
                  <MemoizedMarkdownPreview text={node.text || ''} />
                )}
              </div>
            )}
          </>
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
    // Only re-render if node data, selection, editing state, snapped port, or connected ports changed
    return (
      prev.node === next.node &&
      prev.isSelected === next.isSelected &&
      prev.isMultiSelection === next.isMultiSelection &&
      prev.isEditing === next.isEditing &&
      prev.editingField === next.editingField &&
      prev.snappedPortSide === next.snappedPortSide &&
      prev.connectedPorts === next.connectedPorts
    )
  }
)

CanvasNodeCard.displayName = 'CanvasNodeCard'

export default CanvasNodeCard
