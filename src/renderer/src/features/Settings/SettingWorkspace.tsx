import React from 'react'
import { Folder } from 'lucide-react'
import { useSettingsStore } from '../../core/store/SettingStore'
import { useWorkspace } from './hook/useWorkspace'

/**
 * SettingWorkspace Component
 * Sleek, clean workspace path manager.
 */
export const SettingWorkspace: React.FC = () => {
  const { settings } = useSettingsStore()
  const { handleSwitchWorkspace, handleOpenFolder } = useWorkspace()

  const currentWorkspacePath =
    settings.workspacePath || settings.vaultPath || 'No workspace selected (using default)'

  return (
    <div className="settings-pane">
      <div className="settings-pane-header">
        <div className="settings-pane-header-info">
          <h2 className="settings-pane-title">Workspace Configuration</h2>
          <p className="settings-pane-subtitle">
            Local note storage directory and environment.
          </p>
        </div>
      </div>

      <section>
        <h3>Storage Location</h3>
        <div className="setting-block workspace-storage-card">
          <div className="row-info" style={{ marginBottom: '12px' }}>
            <div className="row-label">Storage Location</div>
            <div className="row-hint">
              Local directory where your markdown notes and assets are stored.
            </div>
          </div>

          <div className="vault-path-display">
            <Folder size={15} className="vault-icon" />
            <span className="path-text">{currentWorkspacePath}</span>
          </div>

          <div className="vault-actions">
            <button className="btn btn-secondary" onClick={handleOpenFolder} type="button">
              Open in Explorer
            </button>
            <button className="btn btn-primary" onClick={handleSwitchWorkspace} type="button">
              Change Location
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default React.memo(SettingWorkspace)
