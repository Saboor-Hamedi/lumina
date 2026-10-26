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
  showTools?: boolean
  position?: 'bottom' | 'top' | 'inline'
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
    showTools = true,
    showMenuWhenTitleHidden = true,
    position = 'inline'
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

        {shouldShowMenu && showTools !== false && (
          <MetaTools
            snippet={snippet}
            editorMenu={editorMenu}
          />
        )}

        {showLocalGraph && (
          <div
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
