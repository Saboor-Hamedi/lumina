/**
 * ============================================================================
 * Lumina Canvas Tab Pane (CanvasTabPane)
 * ============================================================================
 * Tab pane container integrating CanvasView into Lumina's tabbed workspace:
 * - Safely deserializes `.canvas` JSON data models from snippet.code
 * - Debounces file persistence to disk (500ms delay) to prevent I/O thrashing
 * - Flushes any pending unsaved mutations immediately on tab close or unmount
 * ============================================================================
 */

import React, { useMemo, useRef, useCallback, useEffect } from 'react'
import { CanvasView } from './CanvasView'
import { CanvasData } from './types'
import { useWorkspaceStore } from '../../core/store/workspaceStore'

export interface CanvasTabPaneProps {
  snippet: {
    id: string
    title: string
    code?: string
    fileName?: string
    folderId?: string
    [key: string]: any
  }
  onSave?: (snippet: any) => Promise<any>
  isSelected?: boolean
}

export const CanvasTabPane: React.FC<CanvasTabPaneProps> = React.memo(({
  snippet,
  onSave,
  isSelected = true
}) => {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const latestDataRef = useRef<CanvasData | null>(null)
  const snippetRef = useRef(snippet)
  snippetRef.current = snippet

  // Parse snippet JSON data model with fallback safe structures
  const parsedInitialData = useMemo<CanvasData>(() => {
    if (!snippet.code || typeof snippet.code !== 'string') {
      return { nodes: [], edges: [], strokes: [], viewport: { x: 0, y: 0, zoom: 1 } }
    }

    try {
      const parsed = JSON.parse(snippet.code)
      if (parsed && typeof parsed === 'object') {
        return {
          nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
          edges: Array.isArray(parsed.edges) ? parsed.edges : [],
          strokes: Array.isArray(parsed.strokes) ? parsed.strokes : [],
          viewport: parsed.viewport || { x: 0, y: 0, zoom: 1 },
          ...(typeof parsed.snapToGrid === 'boolean' ? { snapToGrid: parsed.snapToGrid } : {})
        }
      }
    } catch (e) {
      console.warn('[CanvasTabPane] Failed to parse canvas JSON from snippet:', e)
    }

    return { nodes: [], edges: [], strokes: [], viewport: { x: 0, y: 0, zoom: 1 } }
  }, [snippet.id, snippet.code])

  const flushSave = useCallback(() => {
    if (!onSave || !latestDataRef.current) return
    const cur = snippetRef.current
    const storeNotes = useWorkspaceStore.getState().notes || (useWorkspaceStore.getState() as any).snippets || []
    const isStillInStore =
      storeNotes.length === 0 ||
      storeNotes.some(
        (n) =>
          n.id === cur.id ||
          (cur.relativePath && n.relativePath === cur.relativePath) ||
          (cur.fileName && n.fileName === cur.fileName)
      )
    if (!isStillInStore) return

    const updated = {
      ...cur,
      code: JSON.stringify(latestDataRef.current, null, 2),
      timestamp: Date.now()
    }
    onSave(updated).catch((err) => {
      console.error('[CanvasTabPane] Error saving canvas:', err)
    })
  }, [onSave])

  // Debounced auto-save handler to minimize disk I/O during interactions
  const handleCanvasChange = useCallback(
    (data: CanvasData) => {
      latestDataRef.current = data

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      saveTimeoutRef.current = setTimeout(() => {
        saveTimeoutRef.current = null
        flushSave()
      }, 300)
    },
    [flushSave]
  )

  // Flush any pending save on refresh (beforeunload) or tab unmount
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
        flushSave()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
        flushSave()
      }
    }
  }, [flushSave])

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        display: isSelected ? 'block' : 'none'
      }}
    >
      <CanvasView
        key={snippet.id}
        initialData={parsedInitialData}
        onChange={handleCanvasChange}
        isSelected={isSelected}
      />
    </div>
  )
})

CanvasTabPane.displayName = 'CanvasTabPane'

export default CanvasTabPane
