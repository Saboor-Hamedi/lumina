/**
 * ============================================================================
 * Lumina Canvas Export Actions Hook (`useCanvasExportActions.ts`)
 * ============================================================================
 * Encapsulates clipboard snapshot copy, PNG export, and SVG export with
 * user toast feedback.
 * ============================================================================
 */

import { useCallback } from 'react'
import type { CanvasEdge, CanvasNode, CanvasStroke } from '../types'
import { copyCanvasAsImage, downloadCanvasPng, downloadCanvasSvg } from '../utils'
import type { ToastType } from '../../../core/notification'

export interface UseCanvasExportActionsOptions {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  strokes: CanvasStroke[]
  selectedNodeIds: string[]
  showToast: (message: string, type?: ToastType) => void
}

export function useCanvasExportActions({
  nodes,
  edges,
  strokes,
  selectedNodeIds,
  showToast
}: UseCanvasExportActionsOptions) {
  const handleCopyImage = useCallback(async () => {
    const success = await copyCanvasAsImage({
      nodes,
      edges,
      strokes,
      selectedNodeIds: selectedNodeIds.length > 0 ? selectedNodeIds : undefined
    })
    if (success) {
      showToast('Canvas snapshot copied to clipboard', 'success')
    } else {
      showToast('Failed to copy canvas snapshot', 'error')
    }
  }, [nodes, edges, strokes, selectedNodeIds, showToast])

  const handleExportPNG = useCallback(async () => {
    try {
      const result = await downloadCanvasPng({
        nodes,
        edges,
        strokes,
        selectedNodeIds: selectedNodeIds.length > 0 ? selectedNodeIds : undefined
      })
      if (result.saved) {
        showToast('Exported canvas as PNG image', 'success')
      }
    } catch (err) {
      console.error('[Canvas] Failed to export PNG:', err)
      showToast('Failed to export PNG image', 'error')
    }
  }, [nodes, edges, strokes, selectedNodeIds, showToast])

  const handleExportSVG = useCallback(async () => {
    try {
      const result = await downloadCanvasSvg({
        nodes,
        edges,
        strokes,
        selectedNodeIds: selectedNodeIds.length > 0 ? selectedNodeIds : undefined
      })
      if (result.saved) {
        showToast('Exported canvas as SVG vector', 'success')
      }
    } catch (err) {
      console.error('[Canvas] Failed to export SVG:', err)
      showToast('Failed to export SVG vector', 'error')
    }
  }, [nodes, edges, strokes, selectedNodeIds, showToast])

  return {
    handleCopyImage,
    handleExportPNG,
    handleExportSVG
  }
}
