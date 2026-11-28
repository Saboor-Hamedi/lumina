import React from 'react'
import { Folder, FolderOpen, Trash2, ArrowUpRight } from 'lucide-react'
import { useSettingsStore } from '../../core/store/SettingStore'
import {
  useWorkspace,
  formatWorkspacePath,
  getWorkspaceSourceLabel
} from './hook/useWorkspace'

/**
 * SettingWorkspace Component
 * Sleek, clean workspace path manager sharing the DRY `useWorkspace` hook.
 */
export const SettingWorkspace: React.FC = () => {
  const { settings } = useSettingsStore()
  const {
    currentWorkspace,
    otherWorkspaces,
    isSwitching,
    handleSwitchWorkspace,
    handleOpenWorkspaceByPath,
    handleRemoveRecentWorkspace,
    handleOpenFolder
  } = useWorkspace()

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
            <div className="row-label">
              Active Workspace
              {currentSourceLabel && (
                <span
                  style={{
                    marginLeft: '8px',
                    fontSize: '11px',
                    fontWeight: 500,
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: 'var(--bg-hover)',
                    color: 'var(--text-muted)'
                  }}
                >
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
          <h3>Recent Workspaces</h3>
          <div className="setting-block" style={{ padding: '6px' }}>
            {otherWorkspaces.map((ws) => {
              const sourceLabel = getWorkspaceSourceLabel(ws.source)
              return (
                <div
                  key={ws.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    opacity: ws.exists ? 1 : 0.55
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                    <FolderOpen size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '13px',
                          fontWeight: 500,
                          color: 'var(--text-main)'
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ws.name}
                        </span>
                        {sourceLabel && (
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              background: 'var(--bg-hover)',
                              color: 'var(--text-muted)',
                              flexShrink: 0
                            }}
                          >
                            {sourceLabel}
                          </span>
                        )}
                        {!ws.exists && (
                          <span style={{ fontSize: '10px', color: 'var(--text-faint)' }}>
                            (Missing)
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        title={ws.path}
                      >
                        {formatWorkspacePath(ws.path, 58)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      disabled={!ws.exists || isSwitching}
                      onClick={() => void handleOpenWorkspaceByPath(ws.path, ws.name)}
                    >
                      <span>Open</span>
                      <ArrowUpRight size={12} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '4px 6px' }}
                      title="Remove from recent workspaces"
                      aria-label={`Remove ${ws.name} from recent workspaces`}
                      onClick={() => void handleRemoveRecentWorkspace(ws.path)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

export default React.memo(SettingWorkspace)
