import React, { memo, useState, useRef } from 'react'
import Profile from '../../profile/Profile'
import SettingDropdown from './SettingDropdown'

export interface SidebarFooterProps {
  onThemeClick?: () => void
  onSettingsClick?: () => void
}

const SidebarFooter: React.FC<SidebarFooterProps> = memo(({ onThemeClick, onSettingsClick }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const footerRef = useRef<HTMLDivElement | null>(null)

  const toggleDropdown = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setIsDropdownOpen((prev) => !prev)
  }

  return (
    <div style={{ position: 'relative', width: '100%', flexShrink: 0 }} ref={footerRef}>
      <Profile
        onClick={toggleDropdown}
        showLogout={false}
        fallbackName="Settings"
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
