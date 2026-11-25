/**
 * SplitNodeRenderer.tsx
 *
 * Recursive renderer for Lumina's binary split-pane tree (`SplitTreeNode`).
 * Supports arbitrary nested vertical (columns) and horizontal (rows) splits,
 * with an independent draggable resizer on every branch.
 */

import React, { useRef } from 'react'
import WorkspacePane, { type WorkspacePaneProps } from '../WorkspacePane'
import type { SplitTreeNode } from '../../../core/store/workspaceStore'

export interface SplitNodeRendererProps {
  /** Current node in the binary split tree (either a leaf pane or a split branch) */
  node: SplitTreeNode
  /** Callback invoked when dragging or double-clicking a branch divider */
  onResizeSplit: (splitId: string, ratio: number) => void
  /** Shared layout & action props forwarded to every leaf WorkspacePane */
  paneProps: Omit<WorkspacePaneProps, 'paneId' | 'flexRatio'>
}

export const SplitNodeRenderer: React.FC<SplitNodeRendererProps> = React.memo(
  ({ node, onResizeSplit, paneProps }) => {
    const branchRef = useRef<HTMLDivElement | null>(null)

    if (node.kind === 'leaf') {
      return <WorkspacePane paneId={node.paneId} {...paneProps} flexRatio={1} />
    }

    const handleStartResize = (e: React.MouseEvent | React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const container = branchRef.current
      if (!container) return

      const isVertical = node.direction === 'vertical'
      document.body.classList.add(isVertical ? 'is-split-resizing-v' : 'is-split-resizing-h')

      const onPointerMove = (moveEvent: MouseEvent | PointerEvent) => {
        const rect = container.getBoundingClientRect()
        if (isVertical && rect.width > 0) {
          onResizeSplit(node.id, (moveEvent.clientX - rect.left) / rect.width)
        } else if (!isVertical && rect.height > 0) {
          onResizeSplit(node.id, (moveEvent.clientY - rect.top) / rect.height)
        }
      }

      const onPointerUp = () => {
        document.body.classList.remove('is-split-resizing-v', 'is-split-resizing-h')
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
        window.removeEventListener('pointercancel', onPointerUp)
        window.removeEventListener('mousemove', onPointerMove)
        window.removeEventListener('mouseup', onPointerUp)
      }

      window.addEventListener('pointermove', onPointerMove, { passive: true })
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('pointercancel', onPointerUp)
      window.addEventListener('mousemove', onPointerMove, { passive: true })
      window.addEventListener('mouseup', onPointerUp)
    }

    return (
      <div
        ref={branchRef}
        className={`workspace-split-container split-${node.direction}`}
      >
        <div className="workspace-split-slot" style={{ flex: node.ratio }}>
          <SplitNodeRenderer
            node={node.first}
            onResizeSplit={onResizeSplit}
            paneProps={paneProps}
          />
        </div>
        <div
          className={`split-pane-resizer ${node.direction}`}
          title="Drag to resize panes (double-click to reset 50/50)"
          onPointerDown={handleStartResize}
          onDoubleClick={() => onResizeSplit(node.id, 0.5)}
        />
        <div className="workspace-split-slot" style={{ flex: 1 - node.ratio }}>
          <SplitNodeRenderer
            node={node.second}
            onResizeSplit={onResizeSplit}
            paneProps={paneProps}
          />
        </div>
      </div>
    )
  }
)

SplitNodeRenderer.displayName = 'SplitNodeRenderer'
export default SplitNodeRenderer
