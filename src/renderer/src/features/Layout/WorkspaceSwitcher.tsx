/**
 * =========================================================================
 * WorkspaceSwitcher Component (`WorkspaceSwitcher.tsx`)
 * =========================================================================
 *
 * Self-contained TitleBar workspace switcher dropdown with Lumina avatar.
 * Reuses the DRY `useWorkspace` hook shared with Settings → Storage Location.
 * Supports switching between Lumina workspaces, Obsidian vaults, and Notion
 * export directories with a smooth skeleton-loader transition.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import { ChevronDown, Check, FolderOpen, FolderPlus, X, ExternalLink, Search } from 'lucide-react'
import {
  useWorkspace,
  formatWorkspacePath,
  getWorkspaceSourceLabel
} from '../Settings/hook/useWorkspace'
import ToolTip from '../../components/atoms/ToolTip'
import './WorkspaceSwitcher.css'

const MAX_VISIBLE_RECENT = 4

export interface WorkspaceSwitcherProps {
  isHidden?: boolean
}

const LuminaAvatarEmblem: React.FC = () => (
  <span className="ws-switcher-avatar" aria-hidden="true">
    <svg width="13" height="13" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M24 5L41 16V32L24 43L7 32V16L24 5Z"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="24" r="5" fill="var(--text-accent, #8b5cf6)" />
    </svg>
  </span>
)

export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = memo(({ isHidden = false }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [filterQuery, setFilterQuery] = useState('')
  const [highlightedIdx, setHighlightedIdx] = useState<number>(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const {
    currentWorkspace,
    otherWorkspaces,
    isSwitching,
    refreshWorkspaces,
    handleSwitchWorkspace,
    handleOpenWorkspaceByPath,
    handleRemoveRecentWorkspace,
    handleOpenFolder
  } = useWorkspace()

  const showFilter = otherWorkspaces.length > MAX_VISIBLE_RECENT

  const filteredWorkspaces = useMemo(() => {
    const q = filterQuery.trim().toLowerCase()
    if (!q) return otherWorkspaces
    return otherWorkspaces.filter(
      (ws) =>
        ws.name.toLowerCase().includes(q) ||
        ws.path.toLowerCase().includes(q) ||
        (ws.source && ws.source.toLowerCase().includes(q))
    )
  }, [otherWorkspaces, filterQuery])

  useEffect(() => {
    if (isHidden) setIsOpen(false)
  }, [isHidden])

  // Global keyboard shortcut (Ctrl/Cmd + Alt + W) and Command Palette event
  useEffect(() => {
    const handleToggleEvent = () => {
      if (isHidden || isSwitching) return
      setIsOpen((prev) => !prev)
    }
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (isHidden || isSwitching) return
      const isMod = e.ctrlKey || e.metaKey
      if (isMod && e.altKey && !e.shiftKey && e.key.toLowerCase() === 'w') {
        e.preventDefault()
        e.stopPropagation()
        setIsOpen((prev) => !prev)
      }
    }
    window.addEventListener('toggle-workspace-switcher', handleToggleEvent)
    window.addEventListener('keydown', handleGlobalKeyDown, true)
    return () => {
      window.removeEventListener('toggle-workspace-switcher', handleToggleEvent)
      window.removeEventListener('keydown', handleGlobalKeyDown, true)
    }
  }, [isHidden, isSwitching])

  useEffect(() => {
    if (!isOpen) {
      setFilterQuery('')
      setHighlightedIdx(-1)
      return
    }
    void refreshWorkspaces()

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [isOpen, refreshWorkspaces])

  useEffect(() => {
    setHighlightedIdx(-1)
  }, [filterQuery])

  const handleToggle = useCallback(() => {
    if (isSwitching) return
    setIsOpen((prev) => !prev)
  }, [isSwitching])

  const handleOpenPicker = useCallback(async () => {
    setIsOpen(false)
    await handleSwitchWorkspace()
  }, [handleSwitchWorkspace])

  const handleSelectRecent = useCallback(
    async (path: string, name: string) => {
      setIsOpen(false)
      await handleOpenWorkspaceByPath(path, name)
    },
    [handleOpenWorkspaceByPath]
  )

  const handleDropdownKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (filteredWorkspaces.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlightedIdx((prev) => {
          const next = prev < filteredWorkspaces.length - 1 ? prev + 1 : 0
          const row = listRef.current?.children[next] as HTMLElement | undefined
          row?.scrollIntoView({ block: 'nearest' })
          return next
        })
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightedIdx((prev) => {
          const next = prev > 0 ? prev - 1 : filteredWorkspaces.length - 1
          const row = listRef.current?.children[next] as HTMLElement | undefined
          row?.scrollIntoView({ block: 'nearest' })
          return next
        })
      } else if (e.key === 'Enter' && highlightedIdx >= 0) {
        const target = filteredWorkspaces[highlightedIdx]
        if (target && target.exists && !isSwitching) {
          e.preventDefault()
          void handleSelectRecent(target.path, target.name)
        }
      }
    },
    [filteredWorkspaces, highlightedIdx, isSwitching, handleSelectRecent]
  )

  const displayName = currentWorkspace?.name || 'Lumina'
  const currentSource = getWorkspaceSourceLabel(currentWorkspace?.source)

  return (
    <div className="ws-switcher-container" ref={containerRef}>
      <ToolTip
        text={
          currentWorkspace?.path ? (
            <span className="ws-switcher-tooltip-path">
              {formatWorkspacePath(currentWorkspace.path, 34)}
            </span>
          ) : (
            'Switch workspace'
          )
        }
        position="bottom"
        disabled={isOpen}
      >
        <button
          type="button"
          className={`ws-switcher-trigger${isOpen ? ' is-open' : ''}`}
          onClick={handleToggle}
          disabled={isSwitching}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-label={`Workspace switcher: ${displayName}`}
          data-testid="workspace-switcher-btn"
        >
          <LuminaAvatarEmblem />
          <span className="ws-switcher-label">{displayName}</span>
          <ChevronDown size={12} strokeWidth={2} className="ws-switcher-chevron" />
        </button>
      </ToolTip>

      {isOpen && (
        <div
          className="ws-switcher-dropdown"
          role="menu"
          aria-label="Workspaces"
          onKeyDown={handleDropdownKeyDown}
        >
          <div className="ws-switcher-section-label">Current Workspace</div>
          <div className="ws-switcher-current-card">
            <div className="ws-switcher-current-main">
              <LuminaAvatarEmblem />
              <div className="ws-switcher-item-text">
                <div className="ws-switcher-item-title-row">
                  <span className="ws-switcher-item-name">{displayName}</span>
                  {currentSource && (
                    <span className={`ws-switcher-badge is-${currentWorkspace?.source || 'lumina'}`}>
                      {currentSource}
                    </span>
                  )}
                </div>
                {currentWorkspace?.path && (
                  <div className="ws-switcher-item-path" title={currentWorkspace.path}>
                    {formatWorkspacePath(currentWorkspace.path, 38)}
                  </div>
                )}
              </div>
            </div>
            <div className="ws-switcher-current-actions">
              <span className="ws-switcher-active-check" title="Active workspace">
                <Check size={13} strokeWidth={2.4} />
              </span>
              <button
                type="button"
                className="ws-switcher-icon-btn"
                title="Open folder in Explorer"
                aria-label="Open workspace folder in Explorer"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsOpen(false)
                  handleOpenFolder()
                }}
              >
                <ExternalLink size={12} />
              </button>
            </div>
          </div>

          {otherWorkspaces.length > 0 && (
            <>
              <div className="ws-switcher-divider" />
              <div className="ws-switcher-section-header">
                <span className="ws-switcher-section-label">Recent Workspaces</span>
                {otherWorkspaces.length > MAX_VISIBLE_RECENT && (
                  <span className="ws-switcher-count-pill">{otherWorkspaces.length}</span>
                )}
              </div>
              {showFilter && (
                <div className="ws-switcher-search-wrap">
                  <Search size={11} className="ws-switcher-search-icon" aria-hidden="true" />
                  <input
                    type="text"
                    className="ws-switcher-search-input"
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    placeholder="Filter projects…"
                    aria-label="Filter recent workspaces"
                  />
                  {filterQuery && (
                    <button
                      type="button"
                      className="ws-switcher-search-clear"
                      aria-label="Clear filter"
                      onClick={() => setFilterQuery('')}
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              )}
              <div
                ref={listRef}
                className={`ws-switcher-list${filteredWorkspaces.length > MAX_VISIBLE_RECENT ? ' is-scrollable' : ''}`}
              >
                {filteredWorkspaces.length === 0 ? (
                  <div className="ws-switcher-empty">No matching workspaces</div>
                ) : (
                  filteredWorkspaces.map((ws, idx) => {
                    const sourceLabel = getWorkspaceSourceLabel(ws.source)
                    return (
                      <div
                        key={ws.path}
                        className={`ws-switcher-row${!ws.exists ? ' is-missing' : ''}${idx === highlightedIdx ? ' is-highlighted' : ''}`}
                        onMouseEnter={() => setHighlightedIdx(idx)}
                      >
                        <button
                          type="button"
                          role="menuitem"
                          className="ws-switcher-item-btn"
                          disabled={!ws.exists || isSwitching}
                          onClick={() => void handleSelectRecent(ws.path, ws.name)}
                        >
                          <span className="ws-switcher-row-icon" aria-hidden="true">
                            <FolderOpen size={13} />
                          </span>
                          <span className="ws-switcher-item-text">
                            <span className="ws-switcher-item-title-row">
                              <span className="ws-switcher-item-name">{ws.name}</span>
                              {sourceLabel && (
                                <span className={`ws-switcher-badge is-${ws.source}`}>
                                  {sourceLabel}
                                </span>
                              )}
                              {!ws.exists && <span className="ws-switcher-missing-tag">Missing</span>}
                            </span>
                            <span className="ws-switcher-item-path" title={ws.path}>
                              {formatWorkspacePath(ws.path, 38)}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          className="ws-switcher-remove-btn"
                          title="Remove from recent list"
                          aria-label={`Remove ${ws.name} from recent workspaces`}
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleRemoveRecentWorkspace(ws.path)
                          }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </>
          )}

          <div className="ws-switcher-divider" />
          <div className="ws-switcher-footer">
            <button
              type="button"
              role="menuitem"
              className="ws-switcher-action-btn"
              onClick={() => void handleOpenPicker()}
            >
              <FolderPlus size={14} className="ws-switcher-action-icon" />
              <span className="ws-switcher-action-text">
                <span className="ws-switcher-action-title">Open Folder or Vault…</span>
                <span className="ws-switcher-action-sub">Lumina, Obsidian, or Notion directory</span>
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
})

WorkspaceSwitcher.displayName = 'WorkspaceSwitcher'
export default WorkspaceSwitcher
