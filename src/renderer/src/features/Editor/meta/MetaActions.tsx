import React, { useRef, useEffect, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, Network, MoreHorizontal, Copy, Download } from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'
import ProgressTracker, { LearnedButton } from '../../roadmap/ProgressTracker'
import VoiceButton from '../../voice'
import MetaDrivePush from './MetaDrivePush'
import { useSettingsStore } from '../../../core/store/SettingStore'
import type { Snippet } from '../../../core/editor/types'

export interface MetaActionsProps {
  snippet?: Snippet | null
  title?: string
  isDirty?: boolean
  onInlineAI?: () => void
  showLocalGraph: boolean
  setShowLocalGraph: React.Dispatch<React.SetStateAction<boolean>>
  graphTriggerRef?: React.RefObject<HTMLButtonElement | null>
  showMoreDropdown: boolean
  setShowMoreDropdown: React.Dispatch<React.SetStateAction<boolean>>
  position?: 'bottom' | 'top' | 'inline'
  onOpenExportDialog?: () => void
  onToggleInspector?: () => void
}

/**
 * MetaActions / MetaMenu — Compact Portaled Note Menu
 *
 * Single sleek button that opens a clean, flat popover menu with:
 * - Quick tools row (Voice, Drive Push, Learned, Progress)
 * - Ask AI, Local Graph, Copy as Plain Text, Export…
 */
export const MetaActions: React.FC<MetaActionsProps> = React.memo(
  ({
    snippet,
    title = '',
    isDirty = false,
    onInlineAI,
    showLocalGraph,
    setShowLocalGraph,
    graphTriggerRef,
    showMoreDropdown,
    setShowMoreDropdown,
    onOpenExportDialog
  }) => {
    const triggerBtnRef = useRef<HTMLButtonElement | null>(null)
    const menuRef = useRef<HTMLDivElement | null>(null)
    const [menuCoords, setMenuCoords] = useState<{ top: number; right: number } | null>(null)

    useEffect(() => {
      if (!showMoreDropdown) {
        setMenuCoords(null)
        return
      }
      if (triggerBtnRef.current) {
        const rect = triggerBtnRef.current.getBoundingClientRect()
        const top = rect.bottom + 6
        const right = Math.max(8, window.innerWidth - rect.right)
        setMenuCoords({ top, right })
      }
      const onPointerDown = (e: MouseEvent) => {
        const target = e.target as Node | null
        if (
          target &&
          !menuRef.current?.contains(target) &&
          !triggerBtnRef.current?.contains(target)
        ) {
          setShowMoreDropdown(false)
        }
      }
      const onResize = () => setShowMoreDropdown(false)
      document.addEventListener('mousedown', onPointerDown, true)
      window.addEventListener('resize', onResize)
      return () => {
        document.removeEventListener('mousedown', onPointerDown, true)
        window.removeEventListener('resize', onResize)
      }
    }, [showMoreDropdown, setShowMoreDropdown])

    const handleMenuKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!menuRef.current) return
        const items = Array.from(menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        const currentIndex = items.indexOf(document.activeElement as HTMLElement)

        if (e.key === 'ArrowDown') {
          e.preventDefault()
          items[(currentIndex + 1) % items.length]?.focus()
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          items[(currentIndex - 1 + items.length) % items.length]?.focus()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          setShowMoreDropdown(false)
          triggerBtnRef.current?.focus()
        }
      },
      [setShowMoreDropdown]
    )

    const handleItemKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>, action: () => void) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          action()
        }
      },
      []
    )

    const handleCopyPlainText = useCallback(async () => {
      setShowMoreDropdown(false)
      try {
        if (snippet?.code) {
          await navigator.clipboard.writeText(snippet.code)
          window.dispatchEvent(
            new CustomEvent('show-toast', {
              detail: { message: 'Markdown copied to clipboard', type: 'success' }
            })
          )
        }
      } catch (err) {
        console.error(err)
        window.dispatchEvent(
          new CustomEvent('show-toast', {
            detail: { message: 'Failed to copy to clipboard', type: 'error' }
          })
        )
      }
    }, [snippet?.code, setShowMoreDropdown])

    if (!snippet) return null
    const localGraphKey = useSettingsStore((s) => s.settings?.shortcuts?.['localGraph']) || 'Alt+G'

    return (
      <div className="meta-compact-root">
        <ToolTip text="Note Actions" position="bottom">
          <button
            ref={triggerBtnRef}
            type="button"
            className={`meta-compact-trigger ${showMoreDropdown ? 'active' : ''}`}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowLocalGraph(false)
              setShowMoreDropdown((v) => !v)
            }}
            aria-label="Note Actions"
            aria-haspopup="menu"
            aria-expanded={showMoreDropdown}
          >
            <MoreHorizontal size={14} />
          </button>
        </ToolTip>

        {showMoreDropdown &&
          menuCoords &&
          createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label="Note Menu"
              className="native-dropdown-menu meta-compact-menu-portal"
              style={{
                top: `${menuCoords.top}px`,
                right: `${menuCoords.right}px`,
                left: 'auto'
              }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={handleMenuKeyDown}
            >
              {/* Quick tools row */}
              <div className="meta-compact-tools-row">
                <VoiceButton id="editor-voice" />
                <MetaDrivePush snippet={snippet} title={title} isDirty={isDirty} />
                <LearnedButton snippet={snippet} note={snippet} />
                <ProgressTracker snippetId={snippet?.id} noteId={snippet?.id} />
              </div>

              <div className="dropdown-divider" role="separator" />

              <div
                role="menuitem"
                tabIndex={0}
                className="dropdown-item"
                onClick={() => {
                  setShowMoreDropdown(false)
                  if (onInlineAI) {
                    onInlineAI()
                  } else {
                    window.dispatchEvent(new CustomEvent('open-inline-ai'))
                  }
                }}
                onKeyDown={(e) =>
                  handleItemKeyDown(e, () => {
                    setShowMoreDropdown(false)
                    if (onInlineAI) onInlineAI()
                    else window.dispatchEvent(new CustomEvent('open-inline-ai'))
                  })
                }
              >
                <span className="menu-label">Ask AI</span>
                <span className="shortcut-label">Ctrl+K</span>
                <Sparkles size={13} className="menu-icon-right" />
              </div>

              <div
                ref={graphTriggerRef as any}
                role="menuitem"
                tabIndex={0}
                className="dropdown-item"
                onClick={() => {
                  setShowMoreDropdown(false)
                  setShowLocalGraph((prev) => !prev)
                }}
                onKeyDown={(e) =>
                  handleItemKeyDown(e, () => {
                    setShowMoreDropdown(false)
                    setShowLocalGraph((prev) => !prev)
                  })
                }
              >
                <span className="menu-label">Local Graph</span>
                <span className="shortcut-label">{localGraphKey}</span>
                <Network size={13} className="menu-icon-right" />
              </div>

              <div className="dropdown-divider" role="separator" />

              <div
                role="menuitem"
                tabIndex={0}
                className="dropdown-item"
                onClick={handleCopyPlainText}
                onKeyDown={(e) => handleItemKeyDown(e, handleCopyPlainText)}
              >
                <span className="menu-label">Copy as Plain Text</span>
                <Copy size={13} className="menu-icon-right" />
              </div>

              <div
                role="menuitem"
                tabIndex={0}
                className="dropdown-item"
                onClick={() => {
                  setShowMoreDropdown(false)
                  if (onOpenExportDialog) {
                    onOpenExportDialog()
                  } else {
                    window.dispatchEvent(new CustomEvent('open-export-dialog'))
                  }
                }}
                onKeyDown={(e) =>
                  handleItemKeyDown(e, () => {
                    setShowMoreDropdown(false)
                    if (onOpenExportDialog) onOpenExportDialog()
                    else window.dispatchEvent(new CustomEvent('open-export-dialog'))
                  })
                }
              >
                <span className="menu-label">Export…</span>
                <Download size={13} className="menu-icon-right" />
              </div>
            </div>,
            document.body
          )}
      </div>
    )
  }
)

MetaActions.displayName = 'MetaActions'
export default MetaActions
