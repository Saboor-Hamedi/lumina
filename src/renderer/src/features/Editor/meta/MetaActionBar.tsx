import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useWorkspaceStore } from '../../../core/store/workspaceStore'
import { useKeyboardShortcuts } from '../../../core/shortcuts'
import { PulseLoader } from '../../../components/PulseLoader'
import MetaActions from './MetaActions'
import MetaTools from './MetaTools'
import type { Snippet } from '../../../core/editor/types'

const InlineGraph = React.lazy(() => import('../../graph/InlineGraph'))

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
        const target = e.target as HTMLElement | null
        if (!target) return
        if (
          containerRef.current?.contains(target) ||
          target.closest('.meta-compact-menu-portal') ||
          target.closest('.meta-graph-popover-portal')
        ) {
          return
        }
        setShowLocalGraph(false)
        setShowMoreDropdown(false)
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
          onOpenExportDialog={onOpenExportDialog}
          onToggleInspector={onToggleInspector}
        />

        {showTools && editorMenu && (
          <MetaTools
            snippet={snippet}
            editorMenu={editorMenu}
          />
        )}

        {/* Local Graph Popover: Portaled to body so it always renders cleanly above cover banners */}
        {showLocalGraph &&
          createPortal(
            <div
              role="dialog"
              aria-label="Linked Mentions Local Graph"
              className="meta-graph-popover meta-graph-popover-portal"
              style={{
                position: 'fixed',
                top: '86px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 'min(520px, 92vw)',
                maxWidth: '92vw',
                background: 'var(--surface-3, var(--bg-panel, #18181c))',
                zIndex: 16000,
                borderRadius: 'var(--radius-lg, 10px)',
                border: '1px solid var(--border-strong, var(--border-color, rgba(255,255,255,0.14)))',
                boxShadow: 'var(--elev-dialog, 0 18px 48px rgba(0, 0, 0, 0.35))',
                overflow: 'hidden'
              }}
            >
              <React.Suspense
                fallback={
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: 220
                    }}
                  >
                    <PulseLoader size="sm" />
                  </div>
                }
              >
                <InlineGraph
                  focusNodeId={snippet.id}
                  onNavigate={handleGraphNavigate}
                />
              </React.Suspense>
            </div>,
            document.body
          )}
      </div>
    )
  }
)

MetaActionBar.displayName = 'MetaActionBar'
export default MetaActionBar
