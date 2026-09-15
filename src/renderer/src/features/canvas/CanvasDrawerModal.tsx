/**
 * ============================================================================
 * Lumina Canvas Drawer Modal (CanvasDrawerModal)
 * ============================================================================
 * Opens the authentic Lumina Spatial Canvas in a smooth bottom-drawer / modal overlay.
 * Uses the exact same CanvasTabPane & CanvasView component that opens on the tab,
 * with zero code duplication, full vault persistence, and instant switching
 * between any .canvas file in the user's workspace.
 * ============================================================================
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  X,
  ExternalLink,
  Plus,
  ChevronDown,
  LayoutGrid,
  FileText
} from 'lucide-react'
import { useWorkspaceStore } from '../../core/store/workspaceStore'
import { CanvasTabPane } from './CanvasTabPane'
import ToolTip from '../../components/atoms/ToolTip'
import './css/canvas.css'

export interface CanvasDrawerModalProps {
  isOpen?: boolean
  onClose?: () => void
}

export const CanvasDrawerModal: React.FC<CanvasDrawerModalProps> = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [activeSnippetId, setActiveSnippetId] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)

  const snippets = useWorkspaceStore((state) => state.snippets)
  const selectedSnippet = useWorkspaceStore((state) => state.selectedSnippet)
  const setSelectedSnippet = useWorkspaceStore((state) => state.setSelectedSnippet)
  const saveSnippet = useWorkspaceStore((state) => state.saveSnippet)

  // Filter all canvas snippets in the workspace vault
  const canvasSnippets = useMemo(() => {
    return snippets.filter(
      (s: any) =>
        s.type === 'canvas' ||
        s.language === 'canvas' ||
        s.fileName?.endsWith('.canvas')
    )
  }, [snippets])

  // Determine current active canvas snippet
  const currentSnippet = useMemo(() => {
    if (activeSnippetId) {
      const found = canvasSnippets.find((s: any) => s.id === activeSnippetId)
      if (found) return found
    }
    // Fall back to selected snippet if it is a canvas
    if (
      selectedSnippet &&
      (selectedSnippet.type === 'canvas' ||
        selectedSnippet.fileName?.endsWith('.canvas'))
    ) {
      return selectedSnippet
    }
    // Fall back to first available canvas in workspace
    if (canvasSnippets.length > 0) {
      return canvasSnippets[0]
    }
    return null
  }, [activeSnippetId, selectedSnippet, canvasSnippets])

  // Listen for toggle-canvas-drawer or open-canvas-drawer event
  useEffect(() => {
    const handleToggle = (e: Event) => {
      const customEvt = e as CustomEvent<{ snippetId?: string }>
      if (customEvt.detail?.snippetId) {
        setActiveSnippetId(customEvt.detail.snippetId)
        setIsOpen(true)
      } else {
        setIsOpen((prev) => !prev)
      }
    }

    window.addEventListener('toggle-canvas-drawer', handleToggle)
    window.addEventListener('open-canvas-drawer', handleToggle)
    return () => {
      window.removeEventListener('toggle-canvas-drawer', handleToggle)
      window.removeEventListener('open-canvas-drawer', handleToggle)
    }
  }, [])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setIsOpen(false)
        setShowPicker(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isOpen])

  // Create new canvas snippet directly in the workspace vault
  const handleCreateNewCanvas = useCallback(async () => {
    try {
      const defaultCanvasData = {
        nodes: [
          {
            id: `card-${Date.now()}`,
            type: 'text',
            title: 'Idea',
            text: 'Write notes or add shapes...',
            x: 140,
            y: 120,
            width: 220,
            height: 140,
            color: 'default'
          }
        ],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
      }

      const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()
      const title = `Canvas ${canvasSnippets.length + 1}`
      const newSnippet = {
        id,
        title,
        fileName: `${title}.canvas`,
        code: JSON.stringify(defaultCanvasData, null, 2),
        language: 'canvas',
        type: 'canvas',
        tags: '',
        folderId: '',
        timestamp: Date.now(),
        isPinned: false,
        isLearned: false
      }

      await saveSnippet(newSnippet)
      setActiveSnippetId(id)
      setShowPicker(false)
    } catch (err) {
      console.error('[CanvasDrawerModal] Failed to create canvas:', err)
    }
  }, [canvasSnippets.length, saveSnippet])

  // Open this canvas as a full tab in the workspace editor
  const handleOpenAsTab = useCallback(() => {
    if (currentSnippet) {
      setSelectedSnippet(currentSnippet)
      setIsOpen(false)
      setShowPicker(false)
    }
  }, [currentSnippet, setSelectedSnippet])

  // Auto-create initial canvas if vault has none when drawer opened
  useEffect(() => {
    if (isOpen && canvasSnippets.length === 0 && !currentSnippet) {
      handleCreateNewCanvas()
    }
  }, [isOpen, canvasSnippets.length, currentSnippet, handleCreateNewCanvas])

  if (!isOpen) return null

  return (
    <div
      className="canvas-drawer-overlay"
      onClick={() => {
        setIsOpen(false)
        setShowPicker(false)
      }}
    >
      <div
        className="canvas-drawer-container"
        onClick={(e) => {
          e.stopPropagation()
          if (showPicker) setShowPicker(false)
        }}
      >
        {/* Floating Top Control Bar */}
        <div className="canvas-drawer-header">
          <div className="canvas-drawer-title-group" style={{ position: 'relative' }}>
            <button
              type="button"
              className="canvas-drawer-selector-btn"
              onClick={(e) => {
                e.stopPropagation()
                setShowPicker((v) => !v)
              }}
            >
              <LayoutGrid size={14} className="canvas-drawer-icon" />
              <span className="canvas-drawer-title">
                {currentSnippet?.title || 'Canvas'}
              </span>
              <ChevronDown size={12} className="canvas-drawer-caret" />
            </button>

            {/* Canvas Picker Dropdown */}
            {showPicker && (
              <div
                className="canvas-drawer-picker-dropdown"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="canvas-drawer-picker-header">
                  <span>Workspace Canvases</span>
                  <button
                    type="button"
                    className="canvas-drawer-new-btn"
                    onClick={handleCreateNewCanvas}
                    title="Create new canvas file"
                  >
                    <Plus size={13} />
                    <span>New</span>
                  </button>
                </div>

                <div className="canvas-drawer-picker-list">
                  {canvasSnippets.map((cs: any) => (
                    <button
                      key={cs.id}
                      type="button"
                      className={`canvas-drawer-picker-item ${
                        cs.id === currentSnippet?.id ? 'active' : ''
                      }`}
                      onClick={() => {
                        setActiveSnippetId(cs.id)
                        setShowPicker(false)
                      }}
                    >
                      <FileText size={13} />
                      <span className="picker-item-title">{cs.title}</span>
                    </button>
                  ))}
                  {canvasSnippets.length === 0 && (
                    <div className="canvas-drawer-picker-empty">
                      No canvases yet. Click New to create one.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="canvas-drawer-header-actions">
            {/* Open in Full Editor Tab */}
            <ToolTip text="Open in Editor Tab" position="bottom">
              <button
                type="button"
                className="canvas-drawer-action-btn"
                onClick={handleOpenAsTab}
              >
                <ExternalLink size={13} />
                <span>Open in Tab</span>
              </button>
            </ToolTip>

            {/* Close Button */}
            <ToolTip text="Close Drawer (Esc)" position="bottom">
              <button
                type="button"
                className="canvas-drawer-action-btn close-btn"
                onClick={() => setIsOpen(false)}
              >
                <X size={15} />
              </button>
            </ToolTip>
          </div>
        </div>

        {/* Main Canvas View Body */}
        <div className="canvas-drawer-body">
          {currentSnippet ? (
            <CanvasTabPane
              key={currentSnippet.id}
              snippet={currentSnippet}
              onSave={saveSnippet}
              isSelected={true}
              isDrawer={true}
            />
          ) : (
            <div className="canvas-drawer-loading">
              <span>Loading canvas...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CanvasDrawerModal
