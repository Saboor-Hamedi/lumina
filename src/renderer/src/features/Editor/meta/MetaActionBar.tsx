import React, { useState, useEffect, useRef } from 'react'
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
}

/**
 * MetaActionBar
 *
 * Dedicated component for quick editor action buttons and controls:
 * - Quick Actions: Ask AI, Voice, Drive Push, Local Graph toggle, Learned button
 * - Tools: Progress tracker, Note options menu
 * - Inline Local Graph portal
 */
export const MetaActionBar: React.FC<MetaActionBarProps> = React.memo(
  ({
    snippet,
    title = '',
    isDirty = false,
    onInlineAI,
    editorMenu,
    showMenu = true,
    showMenuWhenTitleHidden = true
  }) => {
    const [showLocalGraph, setShowLocalGraph] = useState(false)
    const containerRef = useRef<HTMLDivElement | null>(null)

    useKeyboardShortcuts({
      onEscape: showLocalGraph
        ? () => {
            setShowLocalGraph(false)
            return true
          }
        : null
    })

    useEffect(() => {
      if (!showLocalGraph) return

      const handleOutsideClick = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setShowLocalGraph(false)
        }
      }

      document.addEventListener('mousedown', handleOutsideClick, true)
      return () => {
        document.removeEventListener('mousedown', handleOutsideClick, true)
      }
    }, [showLocalGraph])

    if (!snippet) return null

    const shouldShowMenu = showMenu || showMenuWhenTitleHidden

    return (
      <div
        ref={containerRef}
        className="editor-action-bar meta-action-bar"
      >
        <MetaActions
          snippet={snippet}
          title={title}
          isDirty={isDirty}
          onInlineAI={onInlineAI}
          showLocalGraph={showLocalGraph}
          setShowLocalGraph={setShowLocalGraph}
        />

        {shouldShowMenu && (
          <MetaTools
            snippet={snippet}
            editorMenu={editorMenu}
          />
        )}

        {showLocalGraph && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '8px',
              width: '100%',
              zIndex: 50,
              borderRadius: '8px',
              border: '1px solid var(--border-color, rgba(255,255,255,0.05))',
              overflow: 'hidden'
            }}
          >
            <InlineGraph
              focusNodeId={snippet.id}
              onNavigate={(id: string) => {
                useWorkspaceStore.getState().setActiveTabId(id)
                setShowLocalGraph(false)
              }}
            />
          </div>
        )}
      </div>
    )
  }
)

MetaActionBar.displayName = 'MetaActionBar'
export default MetaActionBar
