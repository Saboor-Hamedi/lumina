/**
 * ============================================================================
 * Lumina Canvas Selection Floating Toolbar (CanvasSelectionToolbar.tsx)
 * ============================================================================
 * Contextual action bar that docks right above multi-card selections:
 * - Multi-node alignment: Left, Center, Right, Top, Middle, Bottom
 * - Multi-node distribution: Horizontal Spacing, Vertical Spacing
 * - Multi-node actions: Duplicate (Alt+D), Change Color, Delete (Del)
 * - Prevents event bubbling to canvas background
 * ============================================================================
 */

import React, { useState, useRef, useEffect } from 'react'
import {
  Copy,
  Palette,
  Trash2,
  Grid,
  Shapes
} from 'lucide-react'
import ToolTip from '../../../../components/atoms/ToolTip'
import { CanvasAlignmentType, CanvasDistributionType } from '../../utils/canvasAlignment'
import { CanvasShapeType } from '../../types'
import { CANVAS_SHAPES, renderShapeSVG } from './ConvasShapes'

export interface CanvasSelectionToolbarProps {
  selectionBox: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number }
  selectedCount: number
  selectedShapeType?: CanvasShapeType | null
  canReplaceShape?: boolean
  selectedColorHex?: string
  onDuplicate: () => void
  onCycleColor: () => void
  onDelete: () => void
  onReplaceShape?: (newShape: CanvasShapeType) => void
  onSnapToGrid?: () => void
  onAlign?: (alignment: CanvasAlignmentType) => void
  onDistribute?: (direction: CanvasDistributionType) => void
}

export const CanvasSelectionToolbar: React.FC<CanvasSelectionToolbarProps> = React.memo(
  ({
    selectionBox,
    selectedCount,
    selectedShapeType,
    canReplaceShape,
    selectedColorHex,
    onDuplicate,
    onCycleColor,
    onDelete,
    onReplaceShape,
    onSnapToGrid
  }) => {
    const [isReplaceOpen, setIsReplaceOpen] = useState(false)
    const [openUpward, setOpenUpward] = useState(false)
    const anchorRef = useRef<HTMLDivElement>(null)
    const popoverRef = useRef<HTMLDivElement>(null)

    // Dock 44px above the top-center of the selection bounding box
    const toolbarX = selectionBox.minX + selectionBox.width / 2
    const toolbarY = selectionBox.minY - 44

    // Prevent popover clipping near viewport edges (flip upward if close to bottom)
    useEffect(() => {
      if (!isReplaceOpen) return

      if (anchorRef.current) {
        const anchorRect = anchorRef.current.getBoundingClientRect()
        if (anchorRect.bottom + 230 > window.innerHeight) {
          setOpenUpward(true)
        } else {
          setOpenUpward(false)
        }
      }

      const adjustHorizontal = () => {
        if (!popoverRef.current) return
        const popoverRect = popoverRef.current.getBoundingClientRect()
        const padding = 12
        if (popoverRect.right > window.innerWidth - padding) {
          const overflow = popoverRect.right - (window.innerWidth - padding)
          popoverRef.current.style.transform = `translateX(calc(-50% - ${overflow}px))`
        } else if (popoverRect.left < padding) {
          const overflow = padding - popoverRect.left
          popoverRef.current.style.transform = `translateX(calc(-50% + ${overflow}px))`
        }
      }

      const raf = requestAnimationFrame(adjustHorizontal)

      const handlePointerDown = (e: PointerEvent) => {
        if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
          setIsReplaceOpen(false)
        }
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsReplaceOpen(false)
        }
      }

      window.addEventListener('pointerdown', handlePointerDown)
      window.addEventListener('keydown', handleKeyDown)
      return () => {
        cancelAnimationFrame(raf)
        window.removeEventListener('pointerdown', handlePointerDown)
        window.removeEventListener('keydown', handleKeyDown)
      }
    }, [isReplaceOpen])

    return (
      <div
        className="lumina-canvas-selection-toolbar"
        style={{
          left: `${toolbarX}px`,
          top: `${toolbarY}px`,
          transform: 'translateX(-50%)'
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        {selectedCount > 1 && (
          <>
            <span className="lumina-canvas-selection-count">
              {selectedCount} selected
            </span>
            <div className="lumina-canvas-divider vertical" />
          </>
        )}

        {/* Change Color */}
        <ToolTip text="Change Color" position="top">
          <button
            type="button"
            className="lumina-canvas-tool-btn"
            onClick={onCycleColor}
            aria-label="Change Color"
          >
            <Palette size={13} />
          </button>
        </ToolTip>

        {/* Replace Shape (Active when a shape is selected) */}
        {canReplaceShape && onReplaceShape && (
          <div ref={anchorRef} className="lumina-canvas-toolbar-anchor">
            <ToolTip text="Replace Shape" position="top">
              <button
                type="button"
                className={`lumina-canvas-tool-btn ${isReplaceOpen ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  setIsReplaceOpen((prev) => !prev)
                }}
                aria-label="Replace Shape"
              >
                <Shapes size={13} />
              </button>
            </ToolTip>

            {isReplaceOpen && (
              <div
                ref={popoverRef}
                className={`lumina-canvas-replace-shape-popover ${openUpward ? 'open-upward' : ''}`}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
              >
                <div className="lumina-canvas-replace-shape-header">
                  <span className="lumina-canvas-replace-shape-title">Replace Shape</span>
                  <span className="lumina-canvas-replace-shape-hint">Preserves wires</span>
                </div>
                <div className="lumina-canvas-replace-shape-grid">
                  {CANVAS_SHAPES.map((s) => {
                    const isCurrent = selectedShapeType === s.id
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={`lumina-canvas-replace-shape-item ${isCurrent ? 'active' : ''}`}
                        title={`${s.label} (${s.description})`}
                        onClick={(e) => {
                          e.stopPropagation()
                          onReplaceShape(s.id)
                          setIsReplaceOpen(false)
                        }}
                      >
                        <div className="lumina-canvas-replace-shape-preview">
                          <svg viewBox="0 0 100 100" className="lumina-canvas-shape-mini-svg">
                            {renderShapeSVG(
                              s.id,
                              isCurrent ? 'currentColor' : (selectedColorHex || 'var(--node-accent, #38bdf8)'),
                              isCurrent ? 'currentColor' : (selectedColorHex || 'var(--node-accent, #38bdf8)'),
                              0.12,
                              2.2
                            )}
                          </svg>
                        </div>
                        <span className="lumina-canvas-replace-shape-label">{s.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Duplicate Selection */}
        <ToolTip text="Duplicate (Alt+D)" position="top">
          <button
            type="button"
            className="lumina-canvas-tool-btn"
            onClick={onDuplicate}
            aria-label="Duplicate (Alt+D)"
          >
            <Copy size={13} />
          </button>
        </ToolTip>

        {/* Snap to Grid */}
        {onSnapToGrid && (
          <ToolTip text="Snap to Grid" position="top">
            <button
              type="button"
              className="lumina-canvas-tool-btn"
              onClick={onSnapToGrid}
              aria-label="Snap to Grid"
            >
              <Grid size={13} />
            </button>
          </ToolTip>
        )}

        <div className="lumina-canvas-divider vertical" />

        {/* Delete Selection */}
        <ToolTip text="Delete (Del)" position="top">
          <button
            type="button"
            className="lumina-canvas-tool-btn delete"
            onClick={onDelete}
            aria-label="Delete (Del)"
          >
            <Trash2 size={13} />
          </button>
        </ToolTip>
      </div>
    )
  }
)

CanvasSelectionToolbar.displayName = 'CanvasSelectionToolbar'

export default CanvasSelectionToolbar
