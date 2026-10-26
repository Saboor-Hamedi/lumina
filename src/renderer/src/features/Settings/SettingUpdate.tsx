import React from 'react'
import {
  RefreshCw,
  Download,
  ArrowUpCircle,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Zap,
  Sparkles
} from 'lucide-react'
import { useUpdateStore } from '../../core/store/UpdateSetting'
import { useAppVersion } from './hook/useAppVersion'

/**
 * SettingUpdate Component
 * Dedicated full settings panel for checking, downloading,
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

  return (
    <div className="settings-pane">
      <div className="settings-pane-header">
        <div className="settings-pane-header-info">
          <h2 className="settings-pane-title">Updates</h2>
          <p className="settings-pane-subtitle">
            Manage Lumina software updates, view release channels, and check for new features.
          </p>
        </div>
      </div>

      {/* Main Update Status Hero Card */}
      <section style={{ marginBottom: '24px' }}>
        <div
          className="settings-card"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-card)',
            borderRadius: '12px',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '10px',
                  background: isReady || isAvailable
                    ? 'rgba(var(--text-accent-rgb, 139, 92, 246), 0.15)'
                    : isError
                      ? 'rgba(239, 68, 68, 0.15)'
                      : 'var(--bg-active, rgba(255, 255, 255, 0.06))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isReady || isAvailable
                    ? 'var(--text-accent, #8b5cf6)'
                    : isError
                      ? '#ef4444'
                      : 'var(--text-accent, #40bafa)',
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                  flexShrink: 0
                }}
              >
                {isReady ? (
                  <ArrowUpCircle size={24} />
                ) : isDownloading ? (
                  <Download size={22} className="animate-bounce" />
                ) : isChecking ? (
                  <RefreshCw size={22} className="animate-spin" />
                ) : isAvailable ? (
                  <Sparkles size={22} />
                ) : isError ? (
                  <AlertCircle size={22} />
                ) : (
                  <CheckCircle2 size={24} style={{ color: '#22c55e' }} />
                )}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>
                    Lumina Desktop
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: 'var(--bg-active, rgba(255, 255, 255, 0.08))',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border-dim)'
                    }}
                  >
                    v{appVersion || '1.0.82'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {isChecking && 'Checking GitHub release servers for newer versions...'}
                  {isAvailable && `A new version (v${updateInfo?.version || 'new'}) is ready to download.`}
                  {isDownloading &&
                    `Downloading update... ${Math.round(progress?.percent || 0)}% (${formatBytes(progress?.transferred)} of ${formatBytes(progress?.total)})`}
                  {isReady && 'Update downloaded successfully. Restart Lumina to complete installation.'}
                  {isError && (error?.message || 'Could not reach update server. Check your internet connection.')}
                  {isUpToDate && !isChecking && 'You are running the latest version of Lumina.'}
                </div>
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
                gap: '8px',
                padding: '8px 18px',
                fontSize: '12.5px',
                fontWeight: 600,
                borderRadius: '8px',
                height: '34px',
                cursor: isChecking || isDownloading ? 'default' : 'pointer',
                background: isReady
                  ? '#22c55e'
                  : 'var(--text-accent, #8b5cf6)',
                color: '#ffffff',
                border: 'none',
                boxShadow: '0 2px 8px var(--shadow-soft, rgba(0, 0, 0, 0.2))',
                flexShrink: 0
              }}
            >
              {isChecking ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Checking...</span>
                </>
              ) : isDownloading ? (
                <>
                  <Download size={14} className="animate-bounce" />
                  <span>{Math.round(progress?.percent || 0)}%</span>
                </>
              ) : isReady ? (
                <>
                  <ArrowUpCircle size={14} />
                  <span>Restart & Install</span>
                </>
              ) : isAvailable ? (
                <>
                  <Download size={14} />
                  <span>Download v{updateInfo?.version || 'Update'}</span>
                </>
              ) : (
                <>
                  <RefreshCw size={14} />
                  <span>Check for Updates</span>
                </>
              )}
            </button>
          </div>

          {/* Download Progress Bar */}
          {isDownloading && (
            <div style={{ marginTop: '4px' }}>
              <div
                style={{
                  width: '100%',
                  height: '6px',
                  borderRadius: '3px',
                  background: 'var(--bg-active, rgba(255, 255, 255, 0.1))',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, Math.max(0, progress?.percent || 0))}%`,
                    background: 'var(--text-accent, #8b5cf6)',
                    borderRadius: '3px',
                    transition: 'width 0.2s ease'
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Release Channel & Settings Section */}
      <section style={{ marginBottom: '24px' }}>
        <h3>Release Information</h3>
        <div className="settings-row">
          <div className="row-info">
            <div className="row-label">Update Channel</div>
            <div className="row-hint">Production channel with automated cryptographic signature verification.</div>
          </div>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ShieldCheck size={14} style={{ color: '#22c55e' }} />
            <span>Stable (Official)</span>
          </span>
        </div>

        <div className="settings-row">
          <div className="row-info">
            <div className="row-label">Release Notes & Changelog</div>
            <div className="row-hint">View what's new in recent builds and GitHub releases.</div>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleOpenReleases}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ExternalLink size={13} />
            <span>View on GitHub</span>
          </button>
        </div>
      </section>
    </div>
  )
}

export default React.memo(SettingUpdate)
