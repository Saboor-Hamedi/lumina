import React, { useRef, useEffect, useState } from 'react'
import { Settings, Palette, Cloud, RefreshCw, LogOut, Check, Loader2 } from 'lucide-react'
import { useSettingsStore } from '../../../core/store/useSettingsStore'
import { useUpdateStore } from '../../../core/store/useUpdateStore'

const SettingDropdown = ({ isOpen, onClose, onSettingsClick, onThemeClick, anchorRef }) => {
  const dropdownRef = useRef(null)
  const googleUser = useSettingsStore((state) => state.settings?.googleUser)
  const lastSync = useSettingsStore((state) => state.settings?.lastSync)
  const { status, progress, download, install } = useUpdateStore()

  // Backup state
  const [backupState, setBackupState] = useState('idle') // 'idle' | 'zipping' | 'uploading' | 'done' | 'error'
  const [backupProgress, setBackupProgress] = useState(0)

  // Listen to backup progress events
  useEffect(() => {
    if (!window.api?.onIndexProgress) return

    const unsubscribe = window.api.onIndexProgress((data) => {
      if (data?.type !== 'backup') return

      if (data.stage === 'scanning') {
        setBackupState('zipping')
        setBackupProgress(data.progress || 10)
      } else if (data.stage === 'uploading') {
        setBackupState('uploading')
        setBackupProgress(data.progress || 60)
      } else if (data.stage === 'completed' || data.progress >= 100) {
        setBackupState('done')
        setBackupProgress(100)
        useSettingsStore.getState().updateSetting('lastSync', Date.now())
        // Reset to idle after 3 seconds
        setTimeout(() => setBackupState('idle'), 3000)
      }
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  // Click-outside & escape to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target)
      ) {
        onClose()
      }
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose, anchorRef])

  if (!isOpen) return null

  const handleUpdateClick = () => {
    if (status === 'available') download()
    if (status === 'ready') install()
    onClose()
  }

  const handleBackup = async () => {
    if (backupState === 'zipping' || backupState === 'uploading') return // already running
    try {
      setBackupState('zipping')
      setBackupProgress(5)
      if (window.api?.backupWorkspace) {
        const res = await window.api.backupWorkspace()
        if (res?.error) {
          console.error('Backup failed:', res.error)
          setBackupState('error')
          setTimeout(() => setBackupState('idle'), 3000)
        }
        // success path handled by onIndexProgress listener above
      }
    } catch (err) {
      console.error('Backup error:', err)
      setBackupState('error')
      setTimeout(() => setBackupState('idle'), 3000)
    }
  }

  const isSynced = lastSync && Date.now() - lastSync < 86400000
  const isBackingUp = backupState === 'zipping' || backupState === 'uploading'

  return (
    <div
      ref={dropdownRef}
      className="setting-dropdown-menu"
      style={{
        position: 'absolute',
        bottom: '100%',
        left: '0',
        width: '100%',
        marginBottom: '8px',
        backgroundColor: 'var(--bg-app)',
        border: '1px solid var(--border-dim)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-popup, 0 4px 12px rgba(0,0,0,0.15))',
        padding: '4px',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: '2px'
      }}
    >
      {/* ── Profile header (when logged in) ── */}
      {googleUser && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px 6px',
              borderBottom: '1px solid var(--border-dim)',
              marginBottom: '4px'
            }}
          >
            {googleUser.picture ? (
              <img
                src={googleUser.picture}
                alt="Profile"
                referrerPolicy="no-referrer"
                style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                onError={(e) => { e.target.style.display = 'none' }}
              />
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )}
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-main)' }}>
                {googleUser.name}
              </div>
              {googleUser.email && (
                <div style={{ fontSize: '10px', color: 'var(--text-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {googleUser.email}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <DropdownItem icon={<Settings size={14} />} label="Settings" onClick={onSettingsClick} />
      <DropdownItem icon={<Palette size={14} />} label="Theme" onClick={onThemeClick} />

      <div style={{ height: '1px', backgroundColor: 'var(--border-dim)', margin: '4px 0' }} />

      {(status === 'available' || status === 'ready' || status === 'downloading') && (
        <DropdownItem
          icon={<RefreshCw size={14} style={{ animation: status === 'downloading' ? 'spin 1.5s linear infinite' : 'none' }} />}
          label={status === 'downloading' ? `Downloading... ${Math.round(progress?.percent || 0)}%` : 'Update Available'}
          onClick={handleUpdateClick}
          highlight
        />
      )}

      {!googleUser && (
        <DropdownItem
          icon={<Cloud size={14} />}
          label="Sign In to Sync"
          onClick={async () => {
            try {
              if (window.api?.loginWithGoogle) {
                const clientId = '736587690312-33s4trbiculu5dvctb92lkl6njgc14ae.apps.googleusercontent.com'
                const userInfo = await window.api.loginWithGoogle(clientId)
                if (userInfo && !userInfo.error) {
                  useSettingsStore.getState().updateSetting('googleUser', userInfo)
                }
              }
            } catch (err) {
              console.error('Login failed', err)
            } finally {
              onClose()
            }
          }}
        />
      )}

      {googleUser && (
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-sm, 4px)' }}>
          {/* Inline progress bar bg */}
          {isBackingUp && (
            <div
              style={{
                position: 'absolute',
                left: 0, top: 0, bottom: 0,
                width: `${backupProgress}%`,
                backgroundColor: 'var(--text-accent)',
                opacity: 0.12,
                transition: 'width 0.4s ease-out',
                pointerEvents: 'none',
                borderRadius: 'var(--radius-sm, 4px)'
              }}
            />
          )}
          <button
            onClick={handleBackup}
            disabled={isBackingUp}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '6px 10px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-main)',
              fontSize: '12px',
              fontWeight: '500',
              cursor: isBackingUp ? 'default' : 'pointer',
              borderRadius: 'var(--radius-sm, 4px)',
              textAlign: 'left',
              width: '100%',
              transition: 'background-color 0.1s'
            }}
            onMouseEnter={(e) => { if (!isBackingUp) e.currentTarget.style.backgroundColor = 'var(--bg-active)' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            {/* Left icon */}
            {isBackingUp ? (
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
            ) : backupState === 'done' ? (
              <Check size={14} color="var(--text-accent)" style={{ flexShrink: 0 }} />
            ) : (
              <Cloud size={14} style={{ flexShrink: 0 }} />
            )}

            {/* Label + right checkmark */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 0 }}>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {backupState === 'zipping'
                  ? 'Compressing workspace…'
                  : backupState === 'uploading'
                  ? `Uploading… ${Math.round(backupProgress)}%`
                  : backupState === 'done'
                  ? 'Backup complete!'
                  : backupState === 'error'
                  ? 'Backup failed — retry?'
                  : 'Backup Workspace to Drive'}
              </span>
              {/* Synced checkmark — only show when idle and synced recently */}
              {backupState === 'idle' && isSynced && (
                <Check size={12} color="var(--text-accent)" style={{ flexShrink: 0, marginLeft: '4px' }} />
              )}
            </div>
          </button>
        </div>
      )}

      {googleUser && (
        <DropdownItem
          icon={<LogOut size={14} />}
          label="Sign Out"
          onClick={() => {
            useSettingsStore.getState().updateSetting('googleUser', null)
            onClose()
          }}
        />
      )}
    </div>
  )
}

const DropdownItem = ({ icon, label, onClick, highlight }) => {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '6px 10px',
        border: 'none',
        background: 'transparent',
        color: highlight ? 'var(--text-accent)' : 'var(--text-main)',
        fontSize: '12px',
        fontWeight: '500',
        cursor: 'pointer',
        borderRadius: 'var(--radius-sm, 4px)',
        textAlign: 'left',
        width: '100%',
        transition: 'background-color 0.1s, color 0.1s'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg-active)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent'
      }}
    >
      {icon}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>{label}</div>
    </button>
  )
}

export default SettingDropdown
