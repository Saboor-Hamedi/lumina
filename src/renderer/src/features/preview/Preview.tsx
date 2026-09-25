/**
 * =========================================================================
 * Preview Modal Component (`Preview.tsx`)
 * =========================================================================
 *
 * Fullscreen / floating modal dialog providing instant preview of note contents,
 * images, and PDFs with rich editor rendering, smooth dragging, window maximization,
 * and live word count statistics.
 *
 * Features:
 * - Fluid draggable window using requestAnimationFrame
 * - Maximize & restore window toggle synced with SettingStore
 * - Real-time word count calculation
 * - Active snippet live content resolution (drafts, code, images, pdfs)
 * - Esc key handler via useKeyboardShortcuts
 * - Glassmorphism backdrop and clean modal styling
 *
 * Fully typed in TypeScript for maximum safety.
 * =========================================================================
 */

import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { FileText, Square, Copy, X } from 'lucide-react'
import { PreviewCommandPalette } from '../commandpalette/PreviewCommandPalette'
import ToolTip from '../../components/atoms/ToolTip'
import './preview.css'
import { useKeyboardShortcuts } from '../../core/shortcuts'
import { useWorkspaceStore } from '../../core/store/workspaceStore'
import { useSettingsStore } from '../../core/store/SettingStore'

export interface PreviewProps {
  /** Whether the preview modal is currently visible */
  isOpen: boolean
  /** Callback fired to close the modal */
  onClose: () => void
  /** Optional title to display in the header breadcrumb */
  title?: string
  /** Fallback raw markdown content if no snippetId is provided */
  content?: string
  /** Optional ID of the snippet/note being previewed */
  snippetId?: string
}

export const Preview: React.FC<PreviewProps> = ({
  isOpen,
  onClose,
  title,
  content,
  snippetId
}) => {
  const isMaximized = useSettingsStore((s) => s.settings?.previewModalMaximized ?? false)
  const [isDraggingModal, setIsDraggingModal] = useState<boolean>(false)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const modalPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const rafId = useRef<number | null>(null)

  const handleToggleMaximize = useCallback((): void => {
    const { settings, updateSettings } = useSettingsStore.getState()
    updateSettings({ previewModalMaximized: !(settings?.previewModalMaximized ?? false) })
  }, [])

  // Drag logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      if (!isDraggingModal || isMaximized) return

      const newX = e.clientX - dragStart.current.x
      const newY = e.clientY - dragStart.current.y
      modalPos.current = { x: newX, y: newY }

      if (rafId.current) cancelAnimationFrame(rafId.current)

      rafId.current = requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0)`
        }
      })
    }

    const handleMouseUp = (): void => {
      setIsDraggingModal(false)
      if (rafId.current) cancelAnimationFrame(rafId.current)
      if (containerRef.current && !isMaximized) {
        containerRef.current.style.transition = '0.2s cubic-bezier(0.16, 1, 0.3, 1)'
      }
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [isMaximized, isDraggingModal])

  const handleModalHeaderMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>): void => {
      if (isMaximized) return
      const target = e.target as HTMLElement | null
      if (target?.closest('button')) return
      setIsDraggingModal(true)

      if (containerRef.current) {
        containerRef.current.style.transition = 'none'
      }

      dragStart.current = {
        x: e.clientX - modalPos.current.x,
        y: e.clientY - modalPos.current.y
      }
    },
    [isMaximized]
  )

  useEffect(() => {
    if (isMaximized) {
      modalPos.current = { x: 0, y: 0 }
      if (containerRef.current) {
        containerRef.current.style.transform = 'none'
      }
    }
  }, [isMaximized, isOpen])

  useKeyboardShortcuts({
    onEscape: isOpen
      ? () => {
          onClose()
          return true
        }
      : undefined
  })

  const draft = useWorkspaceStore((state) => (snippetId ? state.drafts?.[snippetId] : undefined))
  const activeSnippet = useWorkspaceStore((state) =>
    snippetId
      ? (state.notes || []).find((s) => s.id === snippetId)
      : null
  )

  const liveContent = useMemo(() => {
    if (activeSnippet?.type === 'image') {
      const relPath =
        activeSnippet.relativePath ||
        (activeSnippet.folderId
          ? `${activeSnippet.folderId}/${activeSnippet.fileName}`
          : activeSnippet.fileName)
      return `![${activeSnippet.title || activeSnippet.fileName}](${relPath})`
    }
    if (activeSnippet?.type === 'pdf') {
      const relPath =
        activeSnippet.relativePath ||
        (activeSnippet.folderId
          ? `${activeSnippet.folderId}/${activeSnippet.fileName}`
          : activeSnippet.fileName)
      return `[📄 ${activeSnippet.title || activeSnippet.fileName}](${relPath})`
    }
    return draft !== undefined
      ? draft
      : activeSnippet?.code !== undefined
        ? activeSnippet.code
        : content || ''
  }, [activeSnippet, draft, content])

  if (!isOpen) return null

  const wordCount = liveContent ? liveContent.split(/\s+/).filter(Boolean).length : 0

  return createPortal(
    <div className="preview-overlay-glass" onClick={onClose}>
      <div
        ref={containerRef}
        className={`preview-modal-container modal-container${isMaximized ? ' maximized' : ''}`}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        style={{
          flexDirection: 'column',
          width: isMaximized ? '100vw' : '900px',
          height: isMaximized ? '100vh' : '76vh',
          maxWidth: isMaximized ? 'none' : '94vw',
          minHeight: isMaximized ? 'none' : '480px',
          maxHeight: isMaximized ? 'none' : '78vh',
          transform: isMaximized
            ? 'none'
            : `translate3d(${modalPos.current.x}px, ${modalPos.current.y}px, 0)`,
          transition: '0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 30px 60px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
          borderRadius: isMaximized ? '0' : '12px',
          position: 'relative',
          willChange: 'transform'
        }}
      >
        <div
          className="preview-modal-header"
          onMouseDown={handleModalHeaderMouseDown}
          style={{ cursor: isMaximized ? 'default' : 'grab' }}
        >
          <div className="preview-header-left">
            <span className="preview-header-title">
              Preview
            </span>
            {title && (
              <>
                <span className="preview-header-divider">/</span>
                <span className="preview-header-subtitle" title={title}>
                  {title}
                </span>
              </>
            )}
          </div>

          <div className="preview-header-right">
            <div className="preview-header-stat">
              <FileText size={12} />
              <span>{wordCount} words</span>
            </div>
            <ToolTip text={isMaximized ? 'Restore Window' : 'Maximize Window'} position="bottom">
              <button
                type="button"
                className="preview-window-btn"
                onClick={handleToggleMaximize}
                aria-label={isMaximized ? 'Restore Window' : 'Maximize Window'}
              >
                {isMaximized ? (
                  <Copy size={13} strokeWidth={2} />
                ) : (
                  <Square size={13} strokeWidth={2} />
                )}
              </button>
            </ToolTip>
            <ToolTip text="Close (Esc)" position="bottom">
              <button
                type="button"
                className="preview-close-btn"
                onClick={onClose}
                aria-label="Close Preview (Esc)"
              >
                <X size={17} />
              </button>
            </ToolTip>
          </div>
        </div>

        <PreviewCommandPalette content={liveContent} onClose={onClose} />
      </div>
    </div>,
    document.getElementById('modal-root') || document.body
  )
}

export default Preview
