import React, { memo, useState, useRef } from 'react'
import { Settings } from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'
import { useSettingsStore } from '../../../core/store/useSettingsStore'
import SettingDropdown from './SettingDropdown'

const SidebarFooter = memo(({ onThemeClick, onSettingsClick }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const footerRef = useRef(null)
  const googleUser = useSettingsStore((state) => state.settings?.googleUser)

  return (
    <div className="sidebar-footer-section" ref={footerRef}>
      <ToolTip text="Account & Settings">
        <button 
          className="sidebar-icon-btn" 
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: googleUser ? '100%' : 'auto',
            justifyContent: googleUser ? 'flex-start' : 'center',
            padding: googleUser ? '4px 8px' : '',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: 'transparent'
          }}
        >
          {googleUser?.picture ? (
            <img src={googleUser.picture} alt="Profile" style={{ width: '18px', height: '18px', borderRadius: '50%' }} />
          ) : (
            <Settings size={14} />
          )}
          {googleUser?.name && (
            <span style={{ fontSize: '11px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {googleUser.name}
            </span>
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
