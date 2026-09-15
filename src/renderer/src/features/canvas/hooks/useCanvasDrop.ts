/**
 * ============================================================================
 * Lumina Canvas Ingestion Hook (useCanvasDrop.ts)
 * ============================================================================
 * Manages external OS file drag-and-drop (PDFs, images, notes) and internal
 * FileExplorer snippet transfers:
 * - HTML5 dragover & drop listeners
 * - Automatic image Data-URL encoding for reliable local asset loading
 * - Batch additions for multi-item drops
 * - Grid-aware coordinate snapping
 * ============================================================================
 */

import React, { useCallback, useEffect } from 'react'
import { CanvasNode, CanvasShapeType } from '../types'
import { normalizeNode } from '../utils/canvasUtils'
import type { ToastType } from '../../../core/notification'

export interface UseCanvasDropOptions {
  containerRef: React.RefObject<HTMLDivElement | null>
  screenToCanvas: (screenX: number, screenY: number, containerRect?: DOMRect | null) => { x: number; y: number }
  addNode: (node: Partial<CanvasNode> & { id?: string }) => CanvasNode
  addNodes: (nodesList: (Partial<CanvasNode> & { id?: string })[]) => CanvasNode[]
  snapToGrid: boolean
  setEditingNodeId: (id: string | null) => void
  setEditingField: (field: 'title' | 'text' | null) => void
  onToast?: (message: string, type?: ToastType) => void
}

export function useCanvasDrop({
  containerRef,
  screenToCanvas,
  addNode,
  addNodes,
  snapToGrid,
  setEditingNodeId,
  setEditingField,
  onToast
}: UseCanvasDropOptions) {
  /**
   * Builds a canvas node object from an internal FileExplorer snippet.
   */
  const buildNodeFromSnippet = useCallback(
    (snippet: any, pt: { x: number; y: number }, offset: number = 0): Partial<CanvasNode> => {
      const title = snippet.title || snippet.name || 'Untitled Note'
      const content = snippet.content || snippet.text || ''
      const file = snippet.path || snippet.file || ''

      return normalizeNode({
        type: 'note',
        title,
        text: content,
        file: file || undefined,
        x: Math.round(pt.x + offset - 130),
        y: Math.round(pt.y + offset - 70),
        width: 260,
        height: 140,
        color: 'yellow'
      })
    },
    []
  )

  /**
   * Listener for FileExplorer items dropped via Lumina internal DnD events.
   */
  useEffect(() => {
    const handleDroppedExplorerItem = (e: Event) => {
      const customEvent = e as CustomEvent
      const detail = customEvent.detail || (e as any).data || {}
      const { snippets, clientX = 0, clientY = 0 } = detail
      if (!containerRef.current || !Array.isArray(snippets) || snippets.length === 0) return

      const rect = containerRef.current.getBoundingClientRect()
      const hasDimensions = rect.width > 0 && rect.height > 0
      const isInside =
        !hasDimensions ||
        (clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom)

      if (isInside) {
        let pt = screenToCanvas(clientX, clientY, rect)
        if (snapToGrid) {
          pt = { x: Math.round(pt.x / 20) * 20, y: Math.round(pt.y / 20) * 20 }
        }
        const batchNodes = snippets.map((s: any, idx: number) =>
          buildNodeFromSnippet(s, pt, idx * 24)
        )
        addNodes(batchNodes)
      }
    }

    window.addEventListener('lumina:canvas-drop-item', handleDroppedExplorerItem as EventListener)
    return () => {
      window.removeEventListener('lumina:canvas-drop-item', handleDroppedExplorerItem as EventListener)
    }
  }, [screenToCanvas, buildNodeFromSnippet, addNodes, snapToGrid, containerRef])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      let pt = screenToCanvas(e.clientX, e.clientY, rect)
      if (snapToGrid) {
        pt = { x: Math.round(pt.x / 20) * 20, y: Math.round(pt.y / 20) * 20 }
      }

      // 1. Check if dropped from ConvasShapes palette
      const luminaShapeData = e.dataTransfer.getData('application/lumina-shape')
      if (luminaShapeData) {
        try {
          const { shapeType, width = 140, height = 100, color = 'default' } = JSON.parse(luminaShapeData)
          let newX = pt.x - width / 2
          let newY = pt.y - height / 2
          if (snapToGrid) {
            newX = Math.round(newX / 20) * 20
            newY = Math.round(newY / 20) * 20
          } else {
            newX = Math.round(newX)
            newY = Math.round(newY)
          }
          const newNode = addNode({
            type: 'shape',
            shape: shapeType,
            title: '',
            text: '',
            x: newX,
            y: newY,
            width,
            height,
            color: color || 'default'
          })
          setEditingNodeId(newNode.id)
          setEditingField('text')
          return
        } catch (err) {}
      }

      // 2. Check if dropped from Lumina FileExplorer (HTML5 dataTransfer)
      const luminaSnippetData = e.dataTransfer.getData('application/lumina-snippet')
      if (luminaSnippetData) {
        try {
          const snippet = JSON.parse(luminaSnippetData)
          const node = buildNodeFromSnippet(snippet, pt)
          addNode(node)
          return
        } catch (err) {}
      }

      // 3. Check if dropped from external OS filesystem (Windows Explorer, Desktop)
      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        Promise.all(
          files.map(async (file, idx) => {
            const offset = idx * 24
            const fileName = file.name || ''
            const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(fileName)
            const isImg =
              file.type.startsWith('image/') ||
              /\.(png|jpe?g|svg|webp|gif|bmp|ico)$/i.test(fileName)

            if (isPdf) {
              const filePath = (file as any).path
              return normalizeNode({
                type: 'pdf',
                title: fileName,
                text: filePath || fileName,
                url: filePath ? `file://${filePath.replace(/\\/g, '/')}` : undefined,
                x: pt.x + offset - 140,
                y: pt.y + offset - 80,
                width: 280,
                height: 160,
                color: 'red'
              })
            }

            if (isImg) {
              const dataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader()
                reader.onload = (re) => resolve((re.target?.result as string) || '')
                reader.onerror = () => resolve('')
                reader.readAsDataURL(file)
              })

              return normalizeNode({
                type: 'image',
                title: fileName,
                text: '',
                url: dataUrl || (file as any).path,
                x: pt.x + offset - 140,
                y: pt.y + offset - 100,
                width: 280,
                height: 200,
                color: 'cyan'
              })
            }

            // Plain text or markdown document drop
            const textContent = await file.text().catch(() => '')
            return normalizeNode({
              type: 'file',
              title: fileName,
              text: textContent,
              x: pt.x + offset - 130,
              y: pt.y + offset - 70,
              width: 260,
              height: 140,
              color: 'green'
            })
          })
        ).then((newNodes) => {
          const validNodes = newNodes.filter(Boolean) as CanvasNode[]
          if (validNodes.length > 0) {
            addNodes(validNodes)
            onToast?.(`Added ${validNodes.length} item${validNodes.length > 1 ? 's' : ''} to canvas`, 'success')
          }
        })
      }
    },
    [containerRef, screenToCanvas, snapToGrid, addNode, addNodes, buildNodeFromSnippet, setEditingNodeId, setEditingField, onToast]
  )

  return {
    handleDragOver,
    handleDrop
  }
}
