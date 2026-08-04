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
            <img 
              src={googleUser.picture} 
              alt="Profile" 
              style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover' }} 
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.insertAdjacentHTML('afterend', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>')
              }}
            />
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
