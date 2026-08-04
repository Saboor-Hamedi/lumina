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
    <div className="sidebar-footer-section" ref={footerRef}>
      <ToolTip text="Account & Settings">
        <button 
          className="sidebar-icon-btn" 
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          {googleUser?.picture ? (
            <img 
              src={googleUser.picture} 
              alt="Profile" 
              style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }} 
            />
          ) : (
            <User size={14} />
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
