import React, { memo, useState, useRef } from 'react'
import { Settings } from 'lucide-react'
import Profile from '../../profile/Profile'
import SettingDropdown from './SettingDropdown'

const SidebarFooter = memo(({ onThemeClick, onSettingsClick }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const footerRef = useRef(null)

  const toggleDropdown = (e) => {
    if (e) e.stopPropagation()
    setIsDropdownOpen((prev) => !prev)
  }

  return (
    <div style={{ position: 'relative', width: '100%', flexShrink: 0 }} ref={footerRef}>
      <Profile
        onClick={toggleDropdown}
        showLogout={false}
        fallbackName="Settings"
        fallbackIcon={<Settings size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
        style={{ margin: '4px 8px 8px 8px' }}
      />

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
