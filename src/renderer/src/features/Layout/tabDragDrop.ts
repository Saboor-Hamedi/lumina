/**
 * tabDragDrop.ts
 *
 * Pure geometry & lightweight drag-state store for VS Code-style tab dragging
 * across split panes and edge drop-to-split zones.
 */

import { create } from 'zustand'
import type { WorkspacePaneId } from '../../core/store/workspaceStore'

export type DropZonePosition = 'left' | 'right' | 'top' | 'bottom' | 'center'

export interface TabDropTarget {
  targetPane: WorkspacePaneId
  zone: DropZonePosition
}

interface TabDragState {
  draggingTabId: string | null
  sourcePane: WorkspacePaneId | null
  dropTarget: TabDropTarget | null
  startDrag: (tabId: string, sourcePane: WorkspacePaneId) => void
  setDropTarget: (target: TabDropTarget | null) => void
  clearDrag: () => void
}

export const useTabDragStore = create<TabDragState>((set) => ({
  draggingTabId: null,
  sourcePane: null,
  dropTarget: null,
  startDrag: (tabId, sourcePane) =>
    set({ draggingTabId: tabId, sourcePane, dropTarget: null }),
  setDropTarget: (dropTarget) =>
    set((state) => {
      if (
        state.dropTarget?.targetPane === dropTarget?.targetPane &&
        state.dropTarget?.zone === dropTarget?.zone
      ) {
        return state
      }
      return { dropTarget }
    }),
  clearDrag: () => set({ draggingTabId: null, sourcePane: null, dropTarget: null })
}))

/**
 * Pure geometry helper: given a bounding rect and pointer coordinates,
 * computes which split/move drop zone the cursor is over.
 */
export function resolveDropZoneInRect(
  rect: Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>,
  clientX: number,
  clientY: number,
  edgeThreshold = 0.28
): DropZonePosition {
  if (rect.width <= 0 || rect.height <= 0) return 'center'
  const rx = (clientX - rect.left) / rect.width
  const ry = (clientY - rect.top) / rect.height

  // Top 36px (tabbar region) always drops into the pane's tab strip
  if (clientY - rect.top <= 36) return 'center'

  const distRight = 1 - rx
  const distLeft = rx
  const distBottom = 1 - ry
  const distTop = ry

  const minEdge = Math.min(distRight, distLeft, distBottom, distTop)
  if (minEdge > edgeThreshold) return 'center'

  if (minEdge === distRight) return 'right'
  if (minEdge === distBottom) return 'bottom'
  if (minEdge === distLeft) return 'left'
  return 'top'
}

/**
 * Finds the WorkspacePane under the pointer and returns its drop target,
 * or null if the pointer is still inside the source TabBar (allowing normal reordering).
 */
export function computePaneDropTarget(
  clientX: number,
  clientY: number,
  sourcePane: WorkspacePaneId,
  sourceTabbarEl: HTMLElement | null
): TabDropTarget | null {
  if (sourceTabbarEl) {
    const tbRect = sourceTabbarEl.getBoundingClientRect()
    const pad = 14
    if (
      clientX >= tbRect.left - pad &&
      clientX <= tbRect.right + pad &&
      clientY >= tbRect.top - pad &&
      clientY <= tbRect.bottom + pad
    ) {
      return null
    }
  }

  const paneEls = document.querySelectorAll<HTMLElement>('[data-workspace-pane]')
  for (let i = 0; i < paneEls.length; i++) {
    const el = paneEls[i]
    const rect = el.getBoundingClientRect()
    if (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    ) {
      const targetPane = el.getAttribute('data-workspace-pane') as WorkspacePaneId
      if (!targetPane) continue
      const zone = resolveDropZoneInRect(rect, clientX, clientY)
      if (zone === 'center' && targetPane === sourcePane) {
        return null
      }
      return { targetPane, zone }
    }
  }

  return null
}
