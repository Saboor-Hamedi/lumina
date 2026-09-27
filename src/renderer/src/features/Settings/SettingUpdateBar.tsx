import React from 'react'
import { RefreshCw, Download, ArrowUpCircle } from 'lucide-react'
import { useUpdateStore } from '../../core/store/UpdateSetting'
import { useAppVersion } from './hook/useAppVersion'

/**
 * SettingUpdateBar Component
 * Fixed sticky update dock displayed at the bottom of Advanced settings.
 * Shows version, status indicator, and update/install trigger.
 */
export const SettingUpdateBar: React.FC = () => {
  const { status, progress, download, install, check } = useUpdateStore()
  const appVersion = useAppVersion()

  const getStatusText = () => {
    if (status === 'available') return 'New version available!'
    if (status === 'ready') return 'Ready to install & restart'
    if (status === 'downloading') {
      return `Downloading update... ${Math.round(progress?.percent || 0)}%`
    }
    if (status === 'not-available') return 'No update.'
    if (status === 'error') return 'Update failed. Please try again.'
    if (status === 'checking') return 'Checking for updates...'
    return 'Check to see if there are any updates available.'
  }

  return (
    <div className="settings-sticky-update-bar">
      <div className="settings-sticky-update-info">
        <div className="settings-update-header-title">App Updates</div>
        <div className="settings-update-meta">
          <span className="settings-update-version">Version {appVersion || '...'}</span>
          <span className="settings-update-dot">•</span>
          <span
            className="settings-update-status"
            style={{
              color:
                status === 'available' || status === 'ready'
                  ? 'var(--text-accent, #818cf8)'
                  : status === 'error'
                    ? '#ef4444'
                    : 'var(--text-muted, #94a3b8)'
            }}
          >
            {getStatusText()}
          </span>
        </div>
      </div>

      <div className="settings-sticky-update-action" style={{ flexShrink: 0 }}>
        <button
          type="button"
          className={`btn btn-primary update-action-btn ${status === 'checking' || status === 'downloading' ? 'pulse-opacity' : ''}`}
          onClick={() => {
            if (status === 'available') download()
            else if (status === 'ready') install()
            else check()
          }}
          disabled={status === 'downloading' || status === 'checking'}
        >
          {status === 'checking' && <RefreshCw size={12} className="spin" />}
          {status === 'downloading' && <Download size={12} className="pulse-opacity" />}
          {status === 'ready' && <ArrowUpCircle size={12} />}
          <span>{status === 'ready' ? 'Install & Restart' : 'Update'}</span>
        </button>
      </div>
    </div>
  )
}

export default React.memo(SettingUpdateBar)
