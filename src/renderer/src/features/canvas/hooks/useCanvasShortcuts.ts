/**
 * ============================================================================
 * Lumina Canvas Keyboard Shortcuts Hook (useCanvasShortcuts.ts)
 * ============================================================================
 * High-performance keyboard interaction listener for the canvas workspace:
 * - Strict editor protection: yields immediately when user is in input/textarea/ProseMirror
 * - Arrow-key nudging (1px/2px, Shift=10px, snap=20px) grouped in single undo step
 * - Canvas copy (Ctrl+C) and paste (Ctrl+V) with multi-node offset
 * - Wire actions: L (line style), C (color), A (endpoints)
 * - Viewport navigation: V (select), H (hand), Space (pan hold), Ctrl+1, Ctrl+0
 * - Zero intrusive notifications for routine actions (silent grid, undo, redo, copy, paste)
 * ============================================================================
 */

import React, { useEffect, useRef } from 'react'
import {
  CanvasNode,
  CanvasEdge,
  CanvasEdgeLineStyle,
  CanvasNodeColor,
  CanvasEdgeEnd,
  CanvasEdgeSide
} from '../types'
import { COLOR_CYCLE } from '../utils'

export interface UseCanvasShortcutsOptions {
  containerRef: React.RefObject<HTMLDivElement | null>
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  selectedNodeIds: string[]
  selectedEdgeId: string | null
  snapToGrid: boolean
  onOpenDrawer?: () => void
  deleteSelected: (ids?: string[]) => void
  deleteEdge: (id: string) => void
  setSelectedEdgeId: (id: string | null) => void
  setSelectedNodeIds: (ids: string[]) => void
  duplicateNodes: (ids?: string[]) => string[]
  copyNodes: (ids?: string[]) => number
  pasteNodes: () => string[]
  hasCopiedNodes: () => boolean
  updateNodesPositions: (updates: { id: string; x: number; y: number }[]) => void
  updateEdgeLineStyle: (id: string, style: CanvasEdgeLineStyle) => void
  updateEdgeColor: (id: string, color: CanvasNodeColor) => void
  updateEdgeEndpoints: (id: string, from?: CanvasEdgeEnd, to?: CanvasEdgeEnd) => void
  handleToggleSnapToGrid: () => void
  zoomToFit: (rect?: DOMRect | null) => void
  resetViewport: () => void
  setToolMode: (mode: 'select' | 'hand') => void
  setIsSpacePressed: (pressed: boolean) => void
  setConnecting: (connecting: any) => void
  connectingRef: React.MutableRefObject<any>
  setSnappedTarget: (target: any) => void
  snappedTargetRef: React.MutableRefObject<any>
  setEditingNodeId: (id: string | null) => void
  setEditingField: (field: any) => void
  undo: () => void
  redo: () => void
  pushHistory: () => void
}

export function useCanvasShortcuts({
  containerRef,
  nodes,
  edges,
  selectedNodeIds,
  selectedEdgeId,
  snapToGrid,
  onOpenDrawer,
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
}: UseCanvasShortcutsOptions) {
  const isNudgingRef = useRef(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey
      const isSlash = e.code === 'Slash' || e.key === '/' || e.key === '?' || e.code === 'NumpadDivide'

      // Canvas Drawer toggle: Ctrl + Shift + /
      if (isCtrl && e.shiftKey && isSlash) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        const now = Date.now()
        if ((window as any).__lastCanvasDrawerDispatch && now - (window as any).__lastCanvasDrawerDispatch < 300) {
          return
        }
        ;(window as any).__lastCanvasDrawerDispatch = now
        if (onOpenDrawer) {
          onOpenDrawer()
        } else {
          window.dispatchEvent(new CustomEvent('toggle-canvas-drawer'))
        }
        return
      }

      // Check if user is typing in any input, textarea, or ProseMirror/contenteditable editor
      const activeEl = document.activeElement as HTMLElement | null
      const activeTag = (activeEl?.tagName || '').toLowerCase()
      const isInputActive =
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        Boolean(activeEl?.isContentEditable) ||
        Boolean(activeEl?.closest?.('[contenteditable="true"], .ProseMirror, input, textarea'))

      // Space key for panning hand tool
      if (e.code === 'Space' && !isInputActive && !e.repeat) {
        setIsSpacePressed(true)
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !isInputActive) {
        if (selectedNodeIds.length > 0) {
          e.preventDefault()
          e.stopPropagation()
          deleteSelected(selectedNodeIds)
        } else if (selectedEdgeId) {
          e.preventDefault()
          e.stopPropagation()
          deleteEdge(selectedEdgeId)
          setSelectedEdgeId(null)
        }
      } else if (e.key === 'Escape') {
        setConnecting(null)
        if (connectingRef) connectingRef.current = null
        setSnappedTarget(null)
        if (snappedTargetRef) snappedTargetRef.current = null
        setEditingNodeId(null)
        setEditingField(null)
        setSelectedNodeIds([])
        setSelectedEdgeId(null)
      } else if (e.altKey && (e.key === 'd' || e.key === 'D') && !isInputActive) {
        // Alt+D duplicates selected nodes (Ctrl+D reserved for Documentation!)
        if (selectedNodeIds.length > 0) {
          e.preventDefault()
          e.stopPropagation()
          duplicateNodes(selectedNodeIds)
        }
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'c' || e.key === 'C') &&
        !isInputActive &&
        !e.shiftKey &&
        !e.altKey &&
        selectedNodeIds.length > 0 &&
        !window.getSelection()?.toString()
      ) {
        // Safe canvas copy: only when not typing in any editor/input, not selecting text, and has canvas nodes selected
        e.preventDefault()
        e.stopPropagation()
        copyNodes(selectedNodeIds)
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'v' || e.key === 'V') &&
        !isInputActive &&
        !e.shiftKey &&
        !e.altKey &&
        hasCopiedNodes()
      ) {
        // Safe canvas paste: only when not typing in any editor/input and canvas clipboard has items
        e.preventDefault()
        e.stopPropagation()
        pasteNodes()
      } else if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) &&
        !isInputActive &&
        !e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        selectedNodeIds.length > 0
      ) {
        // Pixel-perfect arrow key nudging for selected canvas shapes/cards
        e.preventDefault()
        e.stopPropagation()

        if (!isNudgingRef.current) {
          isNudgingRef.current = true
          pushHistory()
        }

        const step = e.shiftKey ? 10 : snapToGrid ? 20 : 2
        let dx = 0
        let dy = 0

        if (e.key === 'ArrowUp') dy = -step
        else if (e.key === 'ArrowDown') dy = step
        else if (e.key === 'ArrowLeft') dx = -step
        else if (e.key === 'ArrowRight') dx = step

        const selectedSet = new Set(selectedNodeIds)
        const updates = nodes
          .filter((n) => selectedSet.has(n.id))
          .map((n) => ({ id: n.id, x: n.x + dx, y: n.y + dy }))

        if (updates.length > 0) {
          updateNodesPositions(updates)
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "'" || e.key === '"') && !isInputActive) {
        // Ctrl+' toggles 20px grid snapping silently without toast
        e.preventDefault()
        e.stopPropagation()
        handleToggleSnapToGrid()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A') && !isInputActive) {
        e.preventDefault()
        e.stopPropagation()
        setSelectedEdgeId(null)
        setSelectedNodeIds(nodes.map((n) => n.id))
      } else if (((e.ctrlKey || e.metaKey) && e.key === '1') || (e.shiftKey && e.key === '!')) {
        if (!isInputActive) {
          e.preventDefault()
          zoomToFit(containerRef.current?.getBoundingClientRect())
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0' && !isInputActive) {
        e.preventDefault()
        resetViewport()
      } else if (e.key === 'v' && !isInputActive && !e.ctrlKey && !e.metaKey) {
        setToolMode('select')
      } else if (e.key === 'h' && !isInputActive && !e.ctrlKey && !e.metaKey) {
        setToolMode('hand')
      } else if ((e.key === 'l' || e.key === 'L') && !isInputActive && !e.ctrlKey && !e.metaKey && !e.altKey && selectedEdgeId) {
        // Cycle line style on selected wire
        e.preventDefault()
        const currentEdge = edges.find((ed) => ed.id === selectedEdgeId)
        if (currentEdge) {
          const nextStyle: Record<CanvasEdgeLineStyle, CanvasEdgeLineStyle> = {
            curved: 'step',
            step: 'straight',
            straight: 'curved'
          }
          updateEdgeLineStyle(selectedEdgeId, nextStyle[currentEdge.lineStyle || 'curved'] || 'curved')
        }
      } else if ((e.key === 'c' || e.key === 'C') && !isInputActive && !e.ctrlKey && !e.metaKey && !e.altKey && selectedEdgeId) {
        // Cycle color on selected wire
        e.preventDefault()
        const currentEdge = edges.find((ed) => ed.id === selectedEdgeId)
        if (currentEdge) {
          const currentColor = currentEdge.color || 'default'
          const idx = COLOR_CYCLE.indexOf(currentColor)
          const nextColor = COLOR_CYCLE[(idx + 1) % COLOR_CYCLE.length]
          updateEdgeColor(selectedEdgeId, nextColor)
        }
      } else if ((e.key === 'a' || e.key === 'A') && !isInputActive && !e.ctrlKey && !e.metaKey && !e.altKey && selectedEdgeId) {
        // Cycle arrow endpoints on selected wire
        e.preventDefault()
        const currentEdge = edges.find((ed) => ed.id === selectedEdgeId)
        if (currentEdge) {
          if (currentEdge.toEnd === 'none') {
            updateEdgeEndpoints(selectedEdgeId, 'none', 'arrow')
          } else if (currentEdge.fromEnd === 'arrow') {
            updateEdgeEndpoints(selectedEdgeId, 'none', 'none')
          } else {
            updateEdgeEndpoints(selectedEdgeId, 'arrow', 'arrow')
          }
        }
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'z' || e.key === 'Z') &&
        !e.shiftKey &&
        !isInputActive
      ) {
        e.preventDefault()
        e.stopPropagation()
        undo()
      } else if (
        (((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) ||
          ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z'))) &&
        !isInputActive
      ) {
        e.preventDefault()
        e.stopPropagation()
        redo()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false)
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        isNudgingRef.current = false
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [
    containerRef,
    deleteSelected,
    selectedNodeIds,
    selectedEdgeId,
    deleteEdge,
    setSelectedEdgeId,
    duplicateNodes,
    copyNodes,
    pasteNodes,
    hasCopiedNodes,
    updateNodesPositions,
    snapToGrid,
    pushHistory,
    handleToggleSnapToGrid,
    setSelectedNodeIds,
    nodes,
    edges,
    updateEdgeLineStyle,
    updateEdgeColor,
    updateEdgeEndpoints,
    zoomToFit,
    resetViewport,
    setConnecting,
    connectingRef,
    setSnappedTarget,
    snappedTargetRef,
    setEditingNodeId,
    setEditingField,
    setToolMode,
    setIsSpacePressed,
    onOpenDrawer,
    undo,
    redo
  ])
}
