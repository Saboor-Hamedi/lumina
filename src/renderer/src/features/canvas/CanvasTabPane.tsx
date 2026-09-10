import React, { useMemo, useRef, useCallback, useEffect } from 'react'
import { CanvasView } from './CanvasView'
import { CanvasData } from './types'

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

export const CanvasTabPane: React.FC<CanvasTabPaneProps> = ({
  snippet,
  onSave,
  isSelected = true
}) => {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const latestDataRef = useRef<CanvasData | null>(null)
  const snippetRef = useRef(snippet)
  snippetRef.current = snippet

  const parsedInitialData = useMemo<CanvasData>(() => {
    if (!snippet.code || typeof snippet.code !== 'string') {
      return { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }
    }

    try {
      const parsed = JSON.parse(snippet.code)
      if (parsed && typeof parsed === 'object') {
        return {
          nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
          edges: Array.isArray(parsed.edges) ? parsed.edges : [],
          viewport: parsed.viewport || { x: 0, y: 0, zoom: 1 }
        }
      }
    } catch (e) {
      console.warn('[CanvasTabPane] Failed to parse canvas JSON from snippet:', e)
    }

    return { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }
  }, [snippet.id, snippet.code])

  const handleCanvasChange = useCallback(
    (data: CanvasData) => {
      latestDataRef.current = data

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      saveTimeoutRef.current = setTimeout(() => {
        if (!onSave || !latestDataRef.current) return
        const updated = {
          ...snippetRef.current,
          code: JSON.stringify(latestDataRef.current, null, 2),
          timestamp: Date.now()
        }
        onSave(updated).catch((err) => {
          console.error('[CanvasTabPane] Error saving canvas:', err)
        })
      }, 500)
    },
    [onSave]
  )

  // Flush pending save on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        if (onSave && latestDataRef.current) {
          const updated = {
            ...snippetRef.current,
            code: JSON.stringify(latestDataRef.current, null, 2),
            timestamp: Date.now()
          }
          onSave(updated).catch(() => {})
        }
      }
    }
  }, [onSave])

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
        initialData={parsedInitialData}
        onChange={handleCanvasChange}
      />
    </div>
  )
}

export default CanvasTabPane
