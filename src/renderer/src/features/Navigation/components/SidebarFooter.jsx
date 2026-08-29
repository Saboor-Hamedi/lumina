import React, { memo, useState, useRef } from 'react'
import { Settings } from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'
import AppVersion from '../../../components/AppVersion'
import { useSettingsStore } from '../../../core/store/useSettingsStore'
import SettingDropdown from './SettingDropdown'

const SidebarFooter = memo(({ onThemeClick, onSettingsClick }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const footerRef = useRef(null)
  const googleUser = useSettingsStore((state) => state.settings?.googleUser)

  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      className="sidebar-footer-section"
      ref={footerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        boxSizing: 'border-box',
        background: isHovered ? 'rgba(150, 150, 150, 0.1)' : 'transparent',
        transition: 'background 0.15s ease',
        cursor: 'pointer'
      }}
    >
      <ToolTip text="Account & Settings">
        <button
          className="sidebar-icon-btn"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 8px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: isHovered ? 'var(--text-main)' : 'var(--text-muted)',
            transition: 'color 0.15s ease'
          }}
        >
          {googleUser ? (
            googleUser.picture ? (
              <img
                src={googleUser.picture}
                alt="Profile"
                referrerPolicy="no-referrer"
                style={{
                  width: '26px',
                  height: '26px',
                  minWidth: '26px',
                  minHeight: '26px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  aspectRatio: '1 / 1',
                  flexShrink: 0,
                  display: 'block'
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
              >
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            )
          ) : (
            <Settings size={16} />
          )}
          {googleUser?.name && (
            <span
              style={{
                fontSize: '12px',
                fontWeight: '500',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '120px'
              }}
            >
              {googleUser.name}
            </span>
          )}
        </button>
      </ToolTip>

      <div style={{ opacity: 0.5, paddingRight: '4px' }}>
        <AppVersion />
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
