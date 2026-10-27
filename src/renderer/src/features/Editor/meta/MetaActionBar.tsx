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

    useKeyboardShortcuts({
      onEscape: (showLocalGraph || showMoreDropdown)
        ? () => {
            setShowLocalGraph(false)
            setShowMoreDropdown(false)
            return true
          }
        : null
    })

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

        {/* Local Graph Popover: Opens in smart parallel direction */}
        {showLocalGraph && (
          <div
            role="dialog"
            aria-label="Linked Mentions Local Graph"
            style={{
              position: 'absolute',
              ...(position === 'bottom'
                ? { bottom: 'calc(100% + 10px)', top: 'auto' }
                : { top: 'calc(100% + 8px)', bottom: 'auto' }),
              left: '50%',
              transform: 'translateX(-50%)',
              width: 'min(420px, 90vw)',
              zIndex: 50,
              borderRadius: '8px',
              border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
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
