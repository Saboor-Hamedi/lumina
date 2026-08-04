import React, { useRef, useEffect } from 'react'
import { Settings, Palette, Cloud, RefreshCw } from 'lucide-react'
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

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
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
        bottom: '60px',
        left: '10px',
        width: '240px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        padding: '8px',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '8px',
          borderBottom: '1px solid var(--border-color)',
          marginBottom: '4px'
        }}
      >
        {googleUser?.picture ? (
          <img
            src={googleUser.picture}
            alt="Profile"
            style={{ width: '32px', height: '32px', borderRadius: '50%' }}
          />
        ) : (
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white'
            }}
          >
            <Cloud size={16} />
          </div>
        )}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div
            style={{
              fontSize: '13px',
              fontWeight: '600',
              color: 'var(--text-primary)',
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
                color: 'var(--text-secondary)',
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
        icon={<Settings size={16} />}
        label="Settings"
        onClick={() => {
          onSettingsClick()
          onClose()
        }}
      />

      <DropdownItem
        icon={<Palette size={16} />}
        label="Change Theme"
        onClick={() => {
          onThemeClick()
          onClose()
        }}
      />

      {(status === 'available' || status === 'ready' || status === 'downloading') && (
        <DropdownItem
          icon={<RefreshCw size={16} className={status === 'downloading' ? 'spin-slow' : ''} />}
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
          icon={<Cloud size={16} />}
          label="Sign In to Sync"
          onClick={() => {
            onSettingsClick()
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
        gap: '12px',
        padding: '8px 12px',
        border: 'none',
        background: 'transparent',
        color: highlight ? 'var(--primary-color)' : 'var(--text-primary)',
        fontSize: '13px',
        cursor: 'pointer',
        borderRadius: '6px',
        textAlign: 'left',
        width: '100%',
        transition: 'background-color 0.2s'
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

export default SettingDropdown
