import React from 'react'
import {
  RefreshCw,
  Download,
  ArrowUpCircle,
  ExternalLink,
  Sparkles
} from 'lucide-react'
import { useUpdateStore } from '../../core/store/UpdateSetting'
import { useWorkspaceStore } from '../../core/store/workspaceStore'
import { useAppVersion } from './hook/useAppVersion'
import { PulseLoader } from '../../components/PulseLoader'

/**
 * SettingUpdate Component
 * Clean Islands UI settings panel for checking, downloading,
 * and installing Lumina desktop application updates.
 */
export const SettingUpdate: React.FC = () => {
  const { status, progress, updateInfo, error, download, install, check } = useUpdateStore()
  const appVersion = useAppVersion()

  const isChecking = status === 'checking'
  const isDownloading = status === 'downloading'
  const isReady = status === 'ready'
  const isAvailable = status === 'available'
  const isUpToDate = status === 'not-available' || status === 'idle'
  const isError = status === 'error'

  const handleAction = () => {
    if (isAvailable) {
      download()
    } else if (isReady) {
      install()
    } else {
      check()
    }
  }

  const handleOpenReleases = () => {
    window.open('https://github.com/Saboor-Hamedi/lumina/releases', '_blank', 'noopener,noreferrer')
  }

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '0 MB'
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  const errorMessage =
    typeof error === 'string'
      ? error
      : error?.message || 'Could not reach update server. Check your internet connection.'

  return (
    <div className="settings-pane">
      <div className="settings-pane-header">
        <div className="settings-pane-header-info">
          <h2 className="settings-pane-title">Updates</h2>
          <p className="settings-pane-subtitle">
            Manage application updates and view release notes.
          </p>
        </div>
      </div>

      <section style={{ marginBottom: '20px' }}>
        <div className="settings-row">
          <div className="row-info">
            <div className="row-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Lumina Desktop</span>
              <span className="value-badge">v{appVersion || '2.1.1'}</span>
            </div>
            <div className="row-hint">
              {isChecking && 'Checking GitHub release servers for newer versions...'}
              {isAvailable && `A new version (v${updateInfo?.version || 'new'}) is ready to download.`}
              {isDownloading &&
                `Downloading update... ${Math.round(progress?.percent || 0)}% (${formatBytes(progress?.transferred)} of ${formatBytes(progress?.total)})`}
              {isReady && 'Update downloaded. Restart Lumina to complete installation.'}
              {isError && errorMessage}
              {isUpToDate && !isChecking && 'You are running the latest version of Lumina.'}
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAction}
            disabled={isChecking || isDownloading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              minWidth: '140px',
              height: '30px',
              minHeight: '30px',
              maxHeight: '30px',
              padding: '0 14px',
              fontSize: '12px',
              fontWeight: 600,
              boxSizing: 'border-box',
              flexShrink: 0
            }}
          >
            {isChecking ? (
              <>
                <PulseLoader size="xs" inline delayMs={0} message="" tone="current" />
                <span>Checking...</span>
              </>
            ) : isDownloading ? (
              <>
                <Download size={13} />
                <span>{Math.round(progress?.percent || 0)}%</span>
              </>
            ) : isReady ? (
              <>
                <ArrowUpCircle size={13} />
                <span>Restart &amp; Install</span>
              </>
            ) : isAvailable ? (
              <>
                <Download size={13} />
                <span>Download v{updateInfo?.version || 'Update'}</span>
              </>
            ) : (
              <>
                <RefreshCw size={13} />
                <span>Check for Updates</span>
              </>
            )}
          </button>
        </div>

        <div className="settings-row">
          <div className="row-info">
            <div className="row-label">Release Notes &amp; Changelog</div>
            <div className="row-hint">Read what changed in recent releases.</div>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                useWorkspaceStore.getState().openReleaseNotesTab()
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                height: '30px',
                padding: '0 12px',
                fontSize: '12px'
              }}
            >
              <Sparkles size={12} />
              <span>What&apos;s New</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleOpenReleases}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                height: '30px',
                padding: '0 12px',
                fontSize: '12px'
              }}
            >
              <ExternalLink size={12} />
              <span>View on GitHub</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default React.memo(SettingUpdate)
