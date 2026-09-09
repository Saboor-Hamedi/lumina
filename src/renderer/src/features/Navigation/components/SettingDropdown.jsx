import React, { useRef, useEffect, useState } from 'react'
import { Settings, Palette, Cloud, RefreshCw, LogOut, Check, Loader2, FileArchive, Folder, X } from 'lucide-react'
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
  const [backupMode, setBackupMode] = useState(() => {
    try {
      return localStorage.getItem('lumina_backup_mode') || 'zip'
    } catch {
      return 'zip'
    }
  })

  const handleSetBackupMode = (mode) => {
    setBackupMode(mode)
    try {
      localStorage.setItem('lumina_backup_mode', mode)
    } catch {}
  }

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
      } else if (data.stage === 'cancelled') {
        setBackupState('idle')
        setBackupProgress(0)
      } else if (data.stage === 'completed' || data.progress >= 100) {
        setBackupState('done')
        setBackupProgress(100)
        useSettingsStore.getState().updateSetting('lastSync', Date.now())
        window.dispatchEvent(
          new CustomEvent('show-toast', {
            detail: {
              message: 'Successfully backed up',
              type: 'success'
            }
          })
        )
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
      setBackupState(backupMode === 'zip' ? 'zipping' : 'uploading')
      setBackupProgress(5)
      if (window.api?.backupWorkspace) {
        const res = await window.api.backupWorkspace(backupMode)
        if (res?.cancelled) {
          setBackupState('idle')
          setBackupProgress(0)
          return
        }
        if (res?.error) {
          console.error('Backup failed:', res.error)
          setBackupState('error')
          setTimeout(() => setBackupState('idle'), 3000)
        }
      }
    } catch (err) {
      console.error('Backup error:', err)
      setBackupState('error')
      setTimeout(() => setBackupState('idle'), 3000)
    }
  }

  const handleCancelBackup = async (e) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    try {
      if (window.api?.cancelBackup) {
        await window.api.cancelBackup()
      }
    } catch (err) {
      console.error('Cancel backup error:', err)
    } finally {
      setBackupState('idle')
      setBackupProgress(0)
      window.dispatchEvent(
        new CustomEvent('show-toast', {
          detail: {
            message: 'Backup cancelled',
            type: 'info'
          }
        })
      )
    }
  }

  const isSynced = lastSync && Date.now() - lastSync < 86400000
  const isBackingUp = backupState === 'zipping' || backupState === 'uploading'

  return (
    <div
      ref={dropdownRef}
      className="setting-dropdown-menu"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 6px)',
        left: '8px',
        right: '8px',
        width: 'auto',
        backgroundColor: 'var(--bg-panel, #18181b)',
        border: '0.5px solid var(--border-dim, rgba(255, 255, 255, 0.15))',
        borderRadius: '6px',
        boxShadow: 'none',
        overflow: 'hidden',
        padding: '3px 0',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0px',
        boxSizing: 'border-box'
      }}
    >
      {/* ── Profile header (when logged in) ── */}
      {googleUser && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 8px 6px',
              borderBottom: '1px solid var(--border-dim)',
              marginBottom: '4px'
            }}
          >
            {googleUser.picture ? (
              <img
                src={googleUser.picture}
                alt="Profile"
                referrerPolicy="no-referrer"
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  flexShrink: 0
                }}
                onError={(e) => {
                  e.target.style.display = 'none'
                }}
              />
            ) : (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )}
            <div style={{ overflow: 'hidden' }}>
              <div
                style={{
                  fontSize: '11.5px',
                  fontWeight: '600',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: 'var(--text-main)'
                }}
              >
                {googleUser.name}
              </div>
              {googleUser.email && (
                <div
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-faint)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {googleUser.email}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <DropdownItem
        icon={<Settings size={14} />}
        label="Settings"
        shortcut="Ctrl+,"
        onClick={() => {
          onClose()
          onSettingsClick && onSettingsClick()
        }}
      />
      <DropdownItem
        icon={<Palette size={14} />}
        label="Theme"
        shortcut="Ctrl+T"
        onClick={() => {
          onClose()
          onThemeClick && onThemeClick()
        }}
      />

      <div style={{ height: '1px', backgroundColor: 'var(--border-dim)', margin: '4px 0' }} />

      {(status === 'available' || status === 'ready' || status === 'downloading') && (
        <DropdownItem
          icon={
            <RefreshCw
              size={14}
              style={{ animation: status === 'downloading' ? 'spin 1.5s linear infinite' : 'none' }}
            />
          }
          label={
            status === 'downloading'
              ? `Downloading... ${Math.round(progress?.percent || 0)}%`
              : 'Update Available'
          }
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
                const clientId =
                  '736587690312-33s4trbiculu5dvctb92lkl6njgc14ae.apps.googleusercontent.com'
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
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Format Selector: Zip vs No Zip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
              padding: '6px 8px',
              borderBottom: '0.5px solid var(--border-dim, rgba(255, 255, 255, 0.08))',
              marginBottom: '2px'
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--text-faint, #64748b)' }}>
              Backup format
            </span>
            <div
              style={{
                display: 'inline-flex',
                backgroundColor: 'var(--bg-primary, rgba(0, 0, 0, 0.25))',
                padding: '2px',
                borderRadius: '5px',
                gap: '2px'
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleSetBackupMode('zip')
                }}
                title="Saves as lumina-backup.zip"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 7px',
                  fontSize: '11px',
                  fontWeight: backupMode === 'zip' ? 500 : 400,
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: backupMode === 'zip' ? 'var(--bg-panel-hover, rgba(255,255,255,0.1))' : 'transparent',
                  color: backupMode === 'zip' ? 'var(--text-main, #f8fafc)' : 'var(--text-faint, #64748b)',
                  transition: 'all 0.15s ease'
                }}
              >
                <FileArchive size={11} />
                <span>Zip</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleSetBackupMode('folder')
                }}
                title="Saves directly inside lumina/ folder"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 7px',
                  fontSize: '11px',
                  fontWeight: backupMode === 'folder' ? 500 : 400,
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: backupMode === 'folder' ? 'var(--bg-panel-hover, rgba(255,255,255,0.1))' : 'transparent',
                  color: backupMode === 'folder' ? 'var(--text-main, #f8fafc)' : 'var(--text-faint, #64748b)',
                  transition: 'all 0.15s ease'
                }}
              >
                <Folder size={11} />
                <span>No Zip</span>
              </button>
            </div>
          </div>

          <div
            style={{
              position: 'relative',
              borderRadius: '2px',
              overflow: 'hidden'
            }}
          >
            {/* Animated fill track */}
            {(isBackingUp || backupState === 'done') && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    backupState === 'done'
                      ? 'rgba(34,197,94,0.08)'
                      : 'linear-gradient(90deg, var(--text-accent, #40bafa) 0%, transparent 100%)',
                  opacity: backupState === 'done' ? 1 : 0.1,
                  width: backupState === 'done' ? '100%' : `${backupProgress}%`,
                  transition: 'width 0.5s ease-out, opacity 0.3s',
                  pointerEvents: 'none'
                }}
              />
            )}

            {/* Bottom progress bar stripe */}
            {isBackingUp && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  height: '2px',
                  width: `${backupProgress}%`,
                  backgroundColor: 'var(--text-accent, #40bafa)',
                  transition: 'width 0.5s ease-out',
                  borderRadius: '0 2px 2px 0'
                }}
              />
            )}

            <div
              onClick={!isBackingUp ? handleBackup : undefined}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 8px',
                border: 'none',
                background: 'transparent',
                color:
                  backupState === 'done'
                    ? '#22c55e'
                    : backupState === 'error'
                      ? 'rgba(239,68,68,0.9)'
                      : 'var(--text-main)',
                fontSize: '12px',
                fontWeight: '500',
                cursor: isBackingUp ? 'default' : 'pointer',
                borderRadius: '0',
                textAlign: 'left',
                width: '100%',
                boxSizing: 'border-box',
                transition: 'background-color 0.15s, color 0.3s'
              }}
              onMouseEnter={(e) => {
                if (!isBackingUp) e.currentTarget.style.backgroundColor = 'var(--bg-active)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              {/* Left icon */}
              {isBackingUp ? (
                <Loader2
                  size={14}
                  style={{
                    animation: 'spin 1s linear infinite',
                    flexShrink: 0,
                    color: 'var(--text-accent)'
                  }}
                />
              ) : backupState === 'done' ? (
                <Check size={14} style={{ flexShrink: 0, color: '#22c55e' }} />
              ) : backupState === 'error' ? (
                <Cloud size={14} style={{ flexShrink: 0, color: 'rgba(239,68,68,0.9)' }} />
              ) : (
                <Cloud size={14} style={{ flexShrink: 0 }} />
              )}

              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  minWidth: 0,
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <span
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      lineHeight: 1.3
                    }}
                  >
                    {backupState === 'zipping'
                      ? 'Compressing workspace…'
                      : backupState === 'uploading'
                        ? (backupMode === 'zip' ? 'Uploading zip…' : 'Syncing files…')
                        : backupState === 'done'
                          ? 'Successfully backed up'
                          : backupState === 'error'
                            ? 'Backup failed — retry?'
                            : backupMode === 'zip'
                              ? 'Backup Workspace (Zip)'
                              : 'Backup Workspace (lumina/)'}
                  </span>
                  {isBackingUp && (
                    <span
                      style={{
                        fontSize: '10px',
                        color: 'var(--text-accent)',
                        fontWeight: 400,
                        lineHeight: 1.2,
                        marginTop: '1px'
                      }}
                    >
                      {backupState === 'zipping'
                        ? 'Compressing workspace…'
                        : backupMode === 'zip'
                          ? `Uploading… ${Math.round(backupProgress)}%`
                          : `Syncing files… ${Math.round(backupProgress)}%`}
                    </span>
                  )}
                </div>
                {/* Cancel icon button when backing up */}
                {isBackingUp ? (
                  <button
                    type="button"
                    onClick={handleCancelBackup}
                    title="Cancel backup"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '20px',
                      height: '20px',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: 'var(--text-faint, #94a3b8)',
                      cursor: 'pointer',
                      flexShrink: 0,
                      padding: 0,
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.stopPropagation()
                      e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)'
                      e.currentTarget.style.color = '#ef4444'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                      e.currentTarget.style.color = 'var(--text-faint, #94a3b8)'
                    }}
                  >
                    <X size={13} strokeWidth={2.2} />
                  </button>
                ) : (
                  backupState === 'idle' && isSynced && (
                    <Check size={11} color="var(--text-accent)" style={{ flexShrink: 0 }} />
                  )
                )}
              </div>
            </div>
          </div>
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

const DropdownItem = ({ icon, label, shortcut, onClick, highlight }) => {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '7px 8px',
        border: 'none',
        background: 'transparent',
        color: highlight ? 'var(--text-accent)' : 'var(--text-main)',
        fontSize: '12px',
        fontWeight: '500',
        cursor: 'pointer',
        borderRadius: '0',
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
      {shortcut && (
        <span
          style={{
            fontSize: '11px',
            color: 'var(--text-faint, #64748b)',
            fontFamily: 'inherit',
            marginLeft: 'auto',
            letterSpacing: '0.02em',
            userSelect: 'none'
          }}
        >
          {shortcut}
        </span>
      )}
    </button>
  )
}

export default SettingDropdown

