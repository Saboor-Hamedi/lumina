import React, { useRef, useEffect, useCallback } from 'react'
import { Sparkles, Network, MoreHorizontal, Edit3, FileText, Copy, Download, Layout } from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'
import ProgressTracker, { LearnedButton } from '../../roadmap/ProgressTracker'
import VoiceButton from '../../voice'
import MetaDrivePush from './MetaDrivePush'
import type { Snippet } from '../../../core/editor/types'

export interface MetaActionsProps {
  snippet?: Snippet | null
  title?: string
  isDirty?: boolean
  onInlineAI?: () => void
  showLocalGraph: boolean
  setShowLocalGraph: React.Dispatch<React.SetStateAction<boolean>>
  showMoreDropdown: boolean
  setShowMoreDropdown: React.Dispatch<React.SetStateAction<boolean>>
  position?: 'bottom' | 'top' | 'inline'
  onPreview?: () => void
  onOpenExportDialog?: () => void
  onToggleInspector?: () => void
}

/**
 * MetaActions
 *
 * Quick action buttons in the meta bar:
 * - Ask AI (Ctrl+K)
 * - Voice Input
 * - Google Drive Push / Backup
 * - Local Graph (Linked Mentions) toggle
 * - Learned status toggle & progress track badge
 * - Options button & accessible right-aligned menu dropdown
 */
export const MetaActions: React.FC<MetaActionsProps> = React.memo(
  ({
    snippet,
    title = '',
    isDirty = false,
    onInlineAI,
    showLocalGraph,
    setShowLocalGraph,
    showMoreDropdown,
    setShowMoreDropdown,
    position = 'bottom',
    onPreview,
    onOpenExportDialog,
    onToggleInspector
  }) => {
    const triggerBtnRef = useRef<HTMLButtonElement | null>(null)
    const menuRef = useRef<HTMLDivElement | null>(null)

    // Auto-focus first menu item when dropdown opens
    useEffect(() => {
      if (showMoreDropdown && menuRef.current) {
        const firstItem = menuRef.current.querySelector<HTMLElement>('[role="menuitem"]')
        firstItem?.focus()
      }
    }, [showMoreDropdown])

    const handleMenuKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!menuRef.current) return

      const items = Array.from(menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      const currentIndex = items.indexOf(document.activeElement as HTMLElement)

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % items.length
        items[nextIndex]?.focus()
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prevIndex = currentIndex === -1 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length
        items[prevIndex]?.focus()
      } else if (e.key === 'Home') {
        e.preventDefault()
        items[0]?.focus()
      } else if (e.key === 'End') {
        e.preventDefault()
        items[items.length - 1]?.focus()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setShowMoreDropdown(false)
        triggerBtnRef.current?.focus()
      }
    }, [setShowMoreDropdown])

    const handleItemKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>, action: () => void) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        action()
      }
    }, [])

    if (!snippet) return null
    const tooltipPos = position === 'bottom' ? 'top' : 'bottom'

    return (
      <div className="meta-header-actions">
        <ToolTip text="Ask AI (Ctrl+K)" position={tooltipPos}>
          <button
            type="button"
            className="meta-action-btn"
            onClick={(e) => {
              e.preventDefault()
              if (onInlineAI) {
                onInlineAI()
              } else {
                window.dispatchEvent(new CustomEvent('open-inline-ai'))
              }
            }}
          >
            <Sparkles size={11} style={{ opacity: 0.85 }} />
            <span>Ask AI</span>
          </button>
        </ToolTip>

        <VoiceButton id="editor-voice" />
        <MetaDrivePush snippet={snippet} title={title} isDirty={isDirty} />

        <ToolTip text="Linked Mentions" position={tooltipPos}>
          <button
            type="button"
            className={`meta-action-btn ${showLocalGraph ? 'active' : ''}`}
            onClick={(e) => {
              e.preventDefault()
              setShowMoreDropdown(false)
              setShowLocalGraph(!showLocalGraph)
            }}
          >
            <Network size={11} style={{ opacity: showLocalGraph ? 1 : 0.85 }} />
            <span>Local Graph</span>
          </button>
        </ToolTip>

        <LearnedButton snippet={snippet} note={snippet} />
        <ProgressTracker snippetId={snippet?.id} noteId={snippet?.id} />

        <div className="meta-action-divider" />

        {/* Options Anchor & Dropdown: strictly anchored to the Options button on the right side */}
        <div className="meta-options-anchor" style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
          <ToolTip text="More Options" position={tooltipPos}>
            <button
              ref={triggerBtnRef}
              type="button"
              className={`meta-action-btn meta-options-trigger ${showMoreDropdown ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault()
                setShowLocalGraph(false)
                setShowMoreDropdown(!showMoreDropdown)
              }}
              aria-label="More Options"
              aria-haspopup="menu"
              aria-expanded={showMoreDropdown}
            >
              <MoreHorizontal size={12} style={{ opacity: showMoreDropdown ? 1 : 0.85 }} />
              <span>Options</span>
            </button>
          </ToolTip>

          {showMoreDropdown && (
            <div
              ref={menuRef}
              role="menu"
              aria-label="Note Options"
              className="native-dropdown-menu meta-menu-dropdown"
              style={{
                position: 'absolute',
                ...(position === 'bottom'
                  ? { bottom: 'calc(100% + 6px)', top: 'auto' }
                  : { top: 'calc(100% + 6px)', bottom: 'auto' }),
                right: 0,
                left: 'auto',
                minWidth: '205px',
                zIndex: 1000
              }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={handleMenuKeyDown}
            >
              <div
                role="menuitem"
                tabIndex={0}
                className="dropdown-item"
                onClick={() => {
                  setShowMoreDropdown(false)
                  if (snippet) {
                    window.dispatchEvent(
                      new CustomEvent('open-rename-modal', { detail: { note: snippet } })
                    )
                  }
                }}
                onKeyDown={(e) =>
                  handleItemKeyDown(e, () => {
                    setShowMoreDropdown(false)
                    if (snippet) {
                      window.dispatchEvent(
                        new CustomEvent('open-rename-modal', { detail: { note: snippet } })
                      )
                    }
                  })
                }
              >
                <span className="menu-label">Rename Note</span>
                <span className="shortcut-label">F2</span>
                <Edit3 size={13} className="menu-icon-right" />
              </div>

              <div
                role="menuitem"
                tabIndex={0}
                className="dropdown-item"
                onClick={() => {
                  setShowMoreDropdown(false)
                  if (onPreview) {
                    onPreview()
                  } else {
                    window.dispatchEvent(new CustomEvent('toggle-preview'))
                  }
                }}
                onKeyDown={(e) =>
                  handleItemKeyDown(e, () => {
                    setShowMoreDropdown(false)
                    if (onPreview) {
                      onPreview()
                    } else {
                      window.dispatchEvent(new CustomEvent('toggle-preview'))
                    }
                  })
                }
              >
                <span className="menu-label">Preview Note</span>
                <span className="shortcut-label">Ctrl+\</span>
                <FileText size={13} className="menu-icon-right" />
              </div>

              <div className="dropdown-divider" role="separator" />

              <div
                role="menuitem"
                tabIndex={0}
                className="dropdown-item"
                onClick={async () => {
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
                  } catch (e) {
                    console.error(e)
                    window.dispatchEvent(
                      new CustomEvent('show-toast', {
                        detail: { message: 'Failed to copy to clipboard', type: 'error' }
                      })
                    )
                  }
                }}
                onKeyDown={(e) =>
                  handleItemKeyDown(e, async () => {
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
                  })
                }
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
                    if (onOpenExportDialog) {
                      onOpenExportDialog()
                    } else {
                      window.dispatchEvent(new CustomEvent('open-export-dialog'))
                    }
                  })
                }
              >
                <span className="menu-label">Export with Preview…</span>
                <Download size={13} className="menu-icon-right" />
              </div>

              <div className="dropdown-divider" role="separator" />

              <div
                role="menuitem"
                tabIndex={0}
                className="dropdown-item"
                onClick={() => {
                  setShowMoreDropdown(false)
                  if (onToggleInspector) {
                    onToggleInspector()
                  } else {
                    window.dispatchEvent(new CustomEvent('toggle-inspector'))
                  }
                }}
                onKeyDown={(e) =>
                  handleItemKeyDown(e, () => {
                    setShowMoreDropdown(false)
                    if (onToggleInspector) {
                      onToggleInspector()
                    } else {
                      window.dispatchEvent(new CustomEvent('toggle-inspector'))
                    }
                  })
                }
              >
                <span className="menu-label">Toggle Details</span>
                <span className="shortcut-label">Ctrl+I</span>
                <Layout size={13} className="menu-icon-right" />
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }
)

MetaActions.displayName = 'MetaActions'
export default MetaActions
