import React, { memo, useState, useRef } from 'react'
import { User } from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'
import { useSettingsStore } from '../../../core/store/useSettingsStore'
import SettingDropdown from './SettingDropdown'

const SidebarFooter = memo(({ onThemeClick, onSettingsClick }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const footerRef = useRef(null)
  const googleUser = useSettingsStore((state) => state.settings?.googleUser)

  return (
    <div
      className="sidebar-footer-section"
      ref={footerRef}
      style={{ position: 'relative', display: 'flex', justifyContent: 'center', padding: '16px 0' }}
    >
      <ToolTip text="Account & Settings">
        <button
          className="sidebar-profile-btn"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            padding: 0,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid transparent',
            transition: 'border-color 0.2s'
          }}
        >
          {googleUser?.picture ? (
            <img
              src={googleUser.picture}
              alt="Profile"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: 'var(--bg-tertiary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)'
              }}
            >
              <User size={20} />
            </div>
          )}
        </button>
      </ToolTip>

      <SettingDropdown
        isOpen={isDropdownOpen}
        onClose={() => setIsDropdownOpen(false)}
        onSettingsClick={onSettingsClick}
        onThemeClick={onThemeClick}
        anchorRef={footerRef}
      />
    </div>
  )
})

SidebarFooter.displayName = 'SidebarFooter'

export default SidebarFooter
