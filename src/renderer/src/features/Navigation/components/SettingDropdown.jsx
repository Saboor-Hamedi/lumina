import React, { useRef, useEffect } from 'react'
import { Settings, Palette, Cloud, RefreshCw, LogOut } from 'lucide-react'
import { useSettingsStore } from '../../../core/store/useSettingsStore'
import { useUpdateStore } from '../../../core/store/useUpdateStore'

const SettingDropdown = ({ isOpen, onClose, onSettingsClick, onThemeClick, anchorRef }) => {
  const dropdownRef = useRef(null)
  const googleUser = useSettingsStore((state) => state.settings?.googleUser)
  const { status, progress, download, install } = useUpdateStore()

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
      if (e.key === 'Escape') {
        onClose()
      }
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

  return (
    <div
      ref={dropdownRef}
      className="setting-dropdown-menu"
      style={{
        position: 'absolute',
        bottom: '36px', // Above the footer
        left: '12px',
        width: '240px',
        backgroundColor: 'var(--bg-app)',
        border: '1px solid var(--border-dim)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-popup, 0 4px 12px rgba(0,0,0,0.15))',
        padding: '6px',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        color: 'var(--text-main)'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '8px',
          borderBottom: '1px solid var(--border-dim)',
          marginBottom: '4px'
        }}
      >
        {googleUser?.picture ? (
          <img
            src={googleUser.picture}
            alt="Profile"
            style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.insertAdjacentHTML('afterend', '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 2px;"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>')
            }}
          />
        ) : (
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: 'var(--text-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}
          >
            <Cloud size={14} />
          </div>
        )}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: '600',
              color: 'var(--text-main)',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden'
            }}
          >
            {googleUser?.name || 'Not signed in'}
          </div>
          {googleUser?.email && (
            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflow: 'hidden'
              }}
            >
              {googleUser.email}
            </div>
          )}
        </div>
      </div>

      <DropdownItem
        icon={<Settings size={14} />}
        label="Settings"
        onClick={() => {
          onSettingsClick()
          onClose()
        }}
      />

      <DropdownItem
        icon={<Palette size={14} />}
        label="Change Theme"
        onClick={() => {
          onThemeClick()
          onClose()
        }}
      />

      {(status === 'available' || status === 'ready' || status === 'downloading') && (
        <DropdownItem
          icon={<RefreshCw size={14} className={status === 'downloading' ? 'spin-slow' : ''} />}
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
        <DropdownItem 
          icon={<Cloud size={14} />} 
          label="Backup Workspace to Drive" 
          onClick={async () => { 
            try {
              if (window.api?.backupWorkspace) {
                const res = await window.api.backupWorkspace()
                if (res?.error) {
                  console.error('Backup failed:', res.error)
                  // Could trigger a toast here
                } else {
                  console.log('Backup successful')
                }
              }
            } catch (err) {
              console.error('Backup error:', err)
            } finally {
              onClose()
            }
          }} 
        />
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
        if (!highlight) e.currentTarget.style.color = 'var(--text-main)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent'
        e.currentTarget.style.color = highlight ? 'var(--text-accent)' : 'var(--text-main)'
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

export default SettingDropdown
