import React, { useMemo, useState } from 'react'
import { Folder, FolderOpen, Trash2, ArrowUpRight, Search, X } from 'lucide-react'
import { useSettingsStore } from '../../core/store/SettingStore'
import {
  useWorkspace,
  formatWorkspacePath,
  getWorkspaceSourceLabel
} from './hook/useWorkspace'
import '../Layout/WorkspaceSwitcher.css'

const MAX_VISIBLE_RECENT = 4

/**
 * SettingWorkspace Component
 * Sleek, clean workspace path manager sharing the DRY `useWorkspace` hook.
 */
export const SettingWorkspace: React.FC = () => {
  const { settings } = useSettingsStore()
  const [filterQuery, setFilterQuery] = useState('')
  const {
    currentWorkspace,
    otherWorkspaces,
    isSwitching,
    handleSwitchWorkspace,
    handleOpenWorkspaceByPath,
    handleRemoveRecentWorkspace,
    handleOpenFolder
  } = useWorkspace()

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

  const currentWorkspacePath =
    currentWorkspace?.path ||
    settings.workspacePath ||
    settings.vaultPath ||
    'No workspace selected (using default)'
  const currentSourceLabel = getWorkspaceSourceLabel(currentWorkspace?.source)

  return (
    <div className="settings-pane">
      <div className="settings-pane-header">
        <div className="settings-pane-header-info">
          <h2 className="settings-pane-title">Workspace Configuration</h2>
          <p className="settings-pane-subtitle">
            Local note storage directory — works with Lumina, Obsidian vaults, and Notion exports.
          </p>
        </div>
      </div>

      <section>
        <h3>Storage Location</h3>
        <div className="setting-block workspace-storage-card">
          <div className="row-info" style={{ marginBottom: '12px' }}>
            <div className="row-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <span>Active Workspace</span>
              {currentSourceLabel && (
                <span className={`ws-switcher-badge is-${currentWorkspace?.source || 'lumina'}`}>
                  {currentSourceLabel}
                </span>
              )}
            </div>
            <div className="row-hint">
              Open any local folder, Obsidian vault, or Notion export directory. External YAML
              frontmatter is stripped automatically and mapped into Note Properties.
            </div>
          </div>

          <div className="vault-path-display">
            <Folder size={15} className="vault-icon" />
            <span className="path-text" title={currentWorkspacePath}>
              {currentWorkspacePath}
            </span>
          </div>

          <div className="vault-actions">
            <button
              className="btn btn-secondary"
              onClick={() => handleOpenFolder()}
              type="button"
              disabled={isSwitching}
            >
              Open in Explorer
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSwitchWorkspace}
              type="button"
              disabled={isSwitching}
            >
              Change Location
            </button>
          </div>
        </div>
      </section>

      {otherWorkspaces.length > 0 && (
        <section style={{ marginTop: '20px' }}>
          <div className="ws-settings-section-head">
            <h3>
              <span>Recent Workspaces</span>
              {otherWorkspaces.length > MAX_VISIBLE_RECENT && (
                <span className="ws-switcher-count-pill">{otherWorkspaces.length}</span>
              )}
            </h3>
            {otherWorkspaces.length > MAX_VISIBLE_RECENT && (
              <div className="ws-settings-search-wrap">
                <Search size={11} className="ws-switcher-search-icon" aria-hidden="true" />
                <input
                  type="text"
                  className="ws-switcher-search-input"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Filter workspaces…"
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
          </div>
          <div className="setting-block" style={{ padding: '6px' }}>
            <div
              className={`ws-settings-recent-list${filteredWorkspaces.length > MAX_VISIBLE_RECENT ? ' is-scrollable' : ''}`}
            >
              {filteredWorkspaces.length === 0 ? (
                <div className="ws-switcher-empty">No matching workspaces</div>
              ) : (
                filteredWorkspaces.map((ws) => {
                  const sourceLabel = getWorkspaceSourceLabel(ws.source)
                  return (
                    <div
                      key={ws.path}
                      className={`ws-settings-recent-row${!ws.exists ? ' is-missing' : ''}`}
                    >
                      <div className="ws-settings-recent-main">
                        <span className="ws-settings-recent-icon" aria-hidden="true">
                          <FolderOpen size={14} />
                        </span>
                        <div className="ws-settings-recent-info">
                          <div className="ws-settings-recent-title">
                            <span className="ws-settings-recent-name">{ws.name}</span>
                            {sourceLabel && (
                              <span className={`ws-switcher-badge is-${ws.source}`}>
                                {sourceLabel}
                              </span>
                            )}
                            {!ws.exists && <span className="ws-switcher-missing-tag">Missing</span>}
                          </div>
                          <div className="ws-settings-recent-path" title={ws.path}>
                            {formatWorkspacePath(ws.path, 58)}
                          </div>
                        </div>
                      </div>
                      <div className="ws-settings-recent-actions">
                        <button
                          type="button"
                          className="btn btn-secondary ws-settings-open-btn"
                          disabled={!ws.exists || isSwitching}
                          onClick={() => void handleOpenWorkspaceByPath(ws.path, ws.name)}
                        >
                          <span>Open</span>
                          <ArrowUpRight size={12} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary ws-settings-remove-btn"
                          title="Remove from recent workspaces"
                          aria-label={`Remove ${ws.name} from recent workspaces`}
                          onClick={() => void handleRemoveRecentWorkspace(ws.path)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

export default React.memo(SettingWorkspace)
