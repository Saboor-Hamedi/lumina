import React, { useState, useEffect, useRef, useCallback } from 'react'
import InlineGraph from '../../graph/InlineGraph'
import { useWorkspaceStore } from '../../../core/store/workspaceStore'
import { useKeyboardShortcuts } from '../../../core/shortcuts'
import MetaActions from './MetaActions'
import MetaTools from './MetaTools'
import type { Snippet } from '../../../core/editor/types'

export interface MetaActionBarProps {
  snippet?: Snippet | null
  title?: string
  isDirty?: boolean
  onInlineAI?: () => void
  editorMenu?: React.ReactNode
  showMenu?: boolean
  showMenuWhenTitleHidden?: boolean
  showTools?: boolean
  position?: 'bottom' | 'top' | 'inline'
  onPreview?: () => void
  onOpenExportDialog?: () => void
  onToggleInspector?: () => void
}

/**
 * MetaActionBar
 *
 * Dedicated component for quick editor action buttons and anchored dropdown:
 * - Quick Actions: Ask AI, Voice, Drive Push, Local Graph toggle, Learned button, Progress badge
 * - Options Dropdown: Anchored directly to the Options button on the right side
 * - Inline Local Graph popover
 */
export const MetaActionBar: React.FC<MetaActionBarProps> = React.memo(
  ({
    snippet,
    title = '',
    isDirty = false,
    onInlineAI,
    editorMenu,
    showTools = false,
    position = 'bottom',
    onPreview,
    onOpenExportDialog,
    onToggleInspector
  }) => {
    const [showLocalGraph, setShowLocalGraph] = useState(false)
    const [showMoreDropdown, setShowMoreDropdown] = useState(false)
    const containerRef = useRef<HTMLDivElement | null>(null)
    const graphTriggerRef = useRef<HTMLButtonElement | null>(null)

    useKeyboardShortcuts({
      onEscape: (showLocalGraph || showMoreDropdown)
        ? () => {
            const wasGraphOpen = showLocalGraph
            setShowLocalGraph(false)
            setShowMoreDropdown(false)
            if (wasGraphOpen) {
              setTimeout(() => {
                graphTriggerRef.current?.focus()
              }, 10)
            }
            return true
          }
        : null,
      onToggleLocalGraph: () => {
        setShowMoreDropdown(false)
        setShowLocalGraph((prev) => !prev)
      }
    })

    useEffect(() => {
      const handleToggle = () => {
        setShowMoreDropdown(false)
        setShowLocalGraph((prev) => !prev)
      }
      window.addEventListener('toggle-local-graph', handleToggle)
      return () => {
        window.removeEventListener('toggle-local-graph', handleToggle)
      }
    }, [])

    useEffect(() => {
      if (!showLocalGraph && !showMoreDropdown) return

      const handleOutsideClick = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setShowLocalGraph(false)
          setShowMoreDropdown(false)
        }
      }

      document.addEventListener('mousedown', handleOutsideClick, true)
      return () => {
        document.removeEventListener('mousedown', handleOutsideClick, true)
      }
    }, [showLocalGraph, showMoreDropdown])

    const handleGraphNavigate = useCallback((id: string) => {
      useWorkspaceStore.getState().setActiveTabId(id)
      setShowLocalGraph(false)
    }, [])

    if (!snippet) return null

    return (
      <div
        ref={containerRef}
        role="region"
        aria-label="Note Actions Bar"
        className="editor-action-bar meta-action-bar"
      >
        <MetaActions
          snippet={snippet}
          title={title}
          isDirty={isDirty}
          onInlineAI={onInlineAI}
          showLocalGraph={showLocalGraph}
          setShowLocalGraph={setShowLocalGraph}
          graphTriggerRef={graphTriggerRef}
          showMoreDropdown={showMoreDropdown}
          setShowMoreDropdown={setShowMoreDropdown}
          position={position}
          onPreview={onPreview}
          onOpenExportDialog={onOpenExportDialog}
          onToggleInspector={onToggleInspector}
        />

        {showTools && editorMenu && (
          <MetaTools
            snippet={snippet}
            editorMenu={editorMenu}
          />
        )}

        {/* Local Graph Popover: Opens in smart parallel direction with smooth entry animation */}
        {showLocalGraph && (
          <div
            role="dialog"
            aria-label="Linked Mentions Local Graph"
            className={`meta-graph-popover ${position === 'top' ? 'pos-top' : ''}`}
            style={{
              position: 'absolute',
              ...(position === 'bottom'
                ? { bottom: 'calc(100% + 10px)', top: 'auto' }
                : { top: 'calc(100% + 8px)', bottom: 'auto' }),
              left: '50%',
              transform: 'translateX(-50%)',
              width: position === 'inline' ? 'min(480px, 92vw)' : '100%',
              minWidth: position === 'inline' ? 'min(420px, 90vw)' : '100%',
              maxWidth: '92vw',
              background: 'var(--bg-panel, #18181c)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              zIndex: 1000,
              borderRadius: '8px',
              border: '1px solid var(--border-color, rgba(255,255,255,0.14))',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden'
            }}
          >
            <InlineGraph
              focusNodeId={snippet.id}
              onNavigate={handleGraphNavigate}
            />
          </div>
        )}
      </div>
    )
  }
)

MetaActionBar.displayName = 'MetaActionBar'
export default MetaActionBar
