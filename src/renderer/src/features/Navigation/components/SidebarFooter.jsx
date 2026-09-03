import React, { memo, useState, useRef } from 'react'
import { Settings } from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'
import Version from '../../../components/Version'
import { useSettingsStore } from '../../../core/store/useSettingsStore'
import SettingDropdown from './SettingDropdown'

const SidebarFooter = memo(({ onThemeClick, onSettingsClick }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const footerRef = useRef(null)
  const googleUser = useSettingsStore((state) => state.settings?.googleUser)
  const [isHovered, setIsHovered] = useState(false)

  const toggleDropdown = (e) => {
    e.stopPropagation()
    setIsDropdownOpen((prev) => !prev)
  }

  return (
    <div
      className="sidebar-footer-section"
      ref={footerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={toggleDropdown}
      style={{
        position: 'relative',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        gap: '8px'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          minWidth: 0,
          flex: 1,
          overflow: 'hidden'
        }}
      >
        {googleUser ? (
          googleUser.picture ? (
            <img
              src={googleUser.picture}
              alt="Profile"
              referrerPolicy="no-referrer"
              style={{
                width: '24px',
                height: '24px',
                minWidth: '24px',
                minHeight: '24px',
                borderRadius: '50%',
                objectFit: 'cover',
                aspectRatio: '1 / 1',
                flexShrink: 0,
                display: 'block',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
              onError={(e) => {
                e.target.style.display = 'none'
                e.target.insertAdjacentHTML(
                  'afterend',
                  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>'
                )
              }}
            />
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          )
        ) : (
          <Settings size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        )}
        <span
          style={{
            fontSize: '11.5px',
            fontWeight: '500',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: isHovered ? 'var(--text-main)' : 'var(--text-muted)',
            transition: 'color 0.15s ease',
            flex: 1,
            minWidth: 0
          }}
          title={googleUser?.name || 'Settings'}
        >
          {googleUser?.name || 'Settings'}
        </span>
      </div>

      <div style={{ opacity: 0.5, paddingRight: '2px', flexShrink: 0 }}>
        <Version />
      </div>

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
