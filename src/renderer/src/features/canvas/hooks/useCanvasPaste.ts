/**
 * ============================================================================
 * Lumina Canvas Paste Hook (useCanvasPaste.ts)
 * ============================================================================
 * Handles clipboard paste interactions for the infinite canvas:
 * - Internal canvas node paste (Ctrl+V / Cmd+V) when nodes were copied
 * - System image paste (screenshots, copied image files, web images)
 * - Safe input bypass (does not interfere when typing in inputs/textareas)
 * - Automatic image persistence to vault via window.api.saveImage
 * - Instant resilient data URL preview for zero-delay rendering
 * ============================================================================
 */

import { useEffect, useCallback } from 'react'
import { CanvasNode, CanvasViewport } from '../types'
import { normalizeNode } from '../utils/canvasUtils'

export interface UseCanvasPasteOptions {
  containerRef: React.RefObject<HTMLDivElement | null>
  screenToCanvas: (
    screenX: number,
    screenY: number,
    containerRect?: DOMRect | null
  ) => { x: number; y: number }
  viewport: CanvasViewport
  mouseCanvasPos?: { x: number; y: number }
  snapToGrid: boolean
  addNode: (node: Partial<CanvasNode> & { id?: string }) => CanvasNode
  hasCopiedNodes: () => boolean
  pasteNodes: () => string[]
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void
}

export function useCanvasPaste({
  containerRef,
  screenToCanvas,
  viewport: _viewport,
  mouseCanvasPos,
  snapToGrid,
  addNode,
  hasCopiedNodes,
  pasteNodes,
  onToast
}: UseCanvasPasteOptions) {
  const pasteImagePayload = useCallback(
    async (file: File | null, rawBuffer?: Uint8Array | ArrayBuffer) => {
      try {
        let dataUrl = ''
        let bufferToSave: Uint8Array | null = null
        let fileName = ''

        if (file) {
          const ext = file.type ? file.type.split('/')[1] || 'png' : 'png'
          fileName =
            file.name && file.name !== 'image.png' && file.name !== 'image.jpeg'
              ? file.name
              : `canvas-image-${Date.now()}.${ext}`

          try {
            if (typeof file.arrayBuffer === 'function') {
              const arrayBuffer = await file.arrayBuffer()
              bufferToSave = new Uint8Array(arrayBuffer)
            }
          } catch (e) {}

          dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve((reader.result as string) || '')
            reader.onerror = () => resolve('')
            try {
              reader.readAsDataURL(file)
            } catch (e) {
              resolve('')
            }
          })

          if (!dataUrl && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
            try {
              dataUrl = URL.createObjectURL(file)
            } catch (e) {}
          }
        } else if (rawBuffer) {
          bufferToSave = rawBuffer instanceof Uint8Array ? rawBuffer : new Uint8Array(rawBuffer)
          fileName = `canvas-image-${Date.now()}.png`

          try {
            let binary = ''
            for (let i = 0; i < bufferToSave.byteLength; i++) {
              binary += String.fromCharCode(bufferToSave[i])
            }
            const base64 = window.btoa(binary)
            dataUrl = `data:image/png;base64,${base64}`
          } catch (e) {}
        }

        if (!dataUrl && !bufferToSave && !file) return

        let relativePath = ''
        if (bufferToSave && (window as any).api?.saveImage) {
          try {
            relativePath = await (window as any).api.saveImage(bufferToSave, fileName)
          } catch (saveErr) {
            console.warn('[useCanvasPaste] Failed to save image to vault:', saveErr)
          }
        }

        // Determine drop location on canvas
        const rect = containerRef.current?.getBoundingClientRect()
        let pt: { x: number; y: number }

        if (mouseCanvasPos && (mouseCanvasPos.x !== 0 || mouseCanvasPos.y !== 0)) {
          pt = { x: mouseCanvasPos.x, y: mouseCanvasPos.y }
        } else {
          const w = rect?.width || 800
          const h = rect?.height || 600
          const cx = rect ? rect.left + w / 2 : w / 2
          const cy = rect ? rect.top + h / 2 : h / 2
          pt = screenToCanvas(cx, cy, rect)
        }

        let x = Math.round(pt.x - 140)
        let y = Math.round(pt.y - 100)
        if (snapToGrid) {
          x = Math.round(x / 20) * 20
          y = Math.round(y / 20) * 20
        }

        const safeTitle = (fileName || 'Image').replace(/\.[^/.]+$/, '')

        addNode(
          normalizeNode({
            type: 'image',
            title: safeTitle,
            text: relativePath || '',
            file: relativePath || undefined,
            url: dataUrl || (relativePath ? `asset://local/${relativePath}` : undefined),
            x,
            y,
            width: 280,
            height: 200,
            color: 'cyan'
          })
        )

        onToast?.('Pasted image onto canvas', 'success')
      } catch (err) {
        console.error('[useCanvasPaste] Error pasting image:', err)
      }
    },
    [containerRef, screenToCanvas, mouseCanvasPos, snapToGrid, addNode, onToast]
  )

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // 1. Do not intercept if user is typing in an active text input or editor
      const activeEl = document.activeElement as HTMLElement | null
      const activeTag = (activeEl?.tagName || '').toLowerCase()
      const isInputActive =
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        Boolean(activeEl?.isContentEditable) ||
        Boolean(activeEl?.closest?.('[contenteditable="true"], .ProseMirror, .cm-editor, input, textarea'))

      if (isInputActive) return

      // 2. Only proceed if canvas container is present
      if (!containerRef.current) return

      // 3. If internal canvas nodes were copied, paste them
      if (hasCopiedNodes()) {
        e.preventDefault()
        e.stopPropagation()
        pasteNodes()
        return
      }

      // 4. Check for clipboard image items or files
      const items = Array.from(e.clipboardData?.items || [])
      const imageItem = items.find((it) => it.kind === 'file' && it.type.startsWith('image/'))
      const directFiles = Array.from(e.clipboardData?.files || []).filter((f) =>
        f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|bmp|ico)$/i.test(f.name)
      )

      const imageFile = (imageItem ? imageItem.getAsFile() : null) || directFiles[0]

      if (imageFile) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        await pasteImagePayload(imageFile)
        return
      }

      // 5. Electron IPC fallback: read image directly from clipboard buffer
      if ((window as any).api?.readClipboardImageBuffer) {
        try {
          const buffer = await (window as any).api.readClipboardImageBuffer()
          if (buffer && buffer.length > 0) {
            e.preventDefault()
            e.stopPropagation()
            e.stopImmediatePropagation()
            await pasteImagePayload(null, buffer)
            return
          }
        } catch (err) {
          console.warn('[useCanvasPaste] Clipboard image buffer fallback failed:', err)
        }
      }
    }

    window.addEventListener('paste', handlePaste, true)
    return () => {
      window.removeEventListener('paste', handlePaste, true)
    }
  }, [containerRef, hasCopiedNodes, pasteNodes, pasteImagePayload])
}
