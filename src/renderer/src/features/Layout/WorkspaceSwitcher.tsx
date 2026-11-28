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

import React, { useState, useEffect, useRef, useCallback, memo } from 'react'
import { ChevronDown, Check, FolderOpen, FolderPlus, X, ExternalLink } from 'lucide-react'
import {
  useWorkspace,
  formatWorkspacePath,
  getWorkspaceSourceLabel
} from '../Settings/hook/useWorkspace'
import ToolTip from '../../components/atoms/ToolTip'
import './WorkspaceSwitcher.css'

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
  const containerRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (isHidden) setIsOpen(false)
  }, [isHidden])

  useEffect(() => {
    if (!isOpen) return
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
        <div className="ws-switcher-dropdown" role="menu" aria-label="Workspaces">
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
              <div className="ws-switcher-section-label">Recent Workspaces</div>
              <div className="ws-switcher-list">
                {otherWorkspaces.map((ws) => {
                  const sourceLabel = getWorkspaceSourceLabel(ws.source)
                  return (
                    <div
                      key={ws.path}
                      className={`ws-switcher-row${!ws.exists ? ' is-missing' : ''}`}
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
                })}
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
