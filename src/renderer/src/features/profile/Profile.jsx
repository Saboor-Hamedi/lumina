/**
 * =========================================================================
 * Profile Component (`Profile.jsx`)
 * =========================================================================
 *
 * Robust, sleek user profile component matching the compact sidebar footer design.
 * Displays user avatar, name, application version, and sign in / sign out actions.
 *
 * Used in:
 * 1. TitleBar.jsx (via AccentColor.jsx dropdown)
 * 2. SidebarFooter.jsx (Sidebar bottom section)
 * 3. SettingDropdown.jsx (Settings menu)
 * =========================================================================
 */

import React, { useState, useEffect, memo } from 'react'
import { User, LogOut } from 'lucide-react'
import { useCurrentUser } from '../../core/hooks/useCurrentUser'
import Version from '../../components/Version'
import ToolTip from '../../components/atoms/ToolTip'
import './profile.css'

export const Profile = memo(({
  onActionComplete,
  accentColor,
  showLogout = true,
  fallbackName,
  fallbackIcon,
  className = '',
  style = {},
  onClick
}) => {
  const { user, isLoggedIn, login, logout, isLoading } = useCurrentUser()
  const [imgError, setImgError] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    setImgError(false)
  }, [user?.picture])

  const handleLogin = async (e) => {
    e.stopPropagation()
    const res = await login()
    if (res?.success && onActionComplete) {
      onActionComplete()
    }
  }

  const handleLogout = async (e) => {
    e.stopPropagation()
    const res = await logout()
    if (res?.success && onActionComplete) {
      onActionComplete()
    }
  }

  const handleClick = (e) => {
    if (onClick) {
      onClick(e)
    } else if (!isLoggedIn) {
      handleLogin(e)
    }
  }

  const activeAccent = accentColor || 'var(--text-accent, #40bafa)'
  const displayName = isLoggedIn && user
    ? (user.name || user.email || 'Google User')
    : (fallbackName || (isLoading ? 'Signing in…' : 'Sign in with Google'))

  return (
    <div style={{ position: 'relative', width: '100%', flexShrink: 0 }}>
      <div
        className={`sidebar-footer-section ${className}`.trim()}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
        style={{
          position: 'relative',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          gap: '8px',
          height: '34px',
          minHeight: '34px',
          margin: 0,
          borderRadius: '6px',
          border: '0.5px solid var(--border-dim, rgba(255, 255, 255, 0.15))',
          background: isHovered ? 'var(--bg-active)' : 'transparent',
          boxSizing: 'border-box',
          padding: '0 8px',
          transition: 'background-color 0.15s ease, border-color 0.15s ease',
          ...style
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            minWidth: 0,
            flex: '1 1 0%'
          }}
        >
          <div
            className="profile-avatar-wrap"
            style={{
              borderColor: activeAccent,
              borderWidth: '1.5px',
              borderStyle: 'solid'
            }}
          >
            {isLoggedIn && user?.picture && !imgError ? (
              <img
                alt="Profile"
                referrerPolicy="no-referrer"
                src={user.picture}
                className="profile-avatar-img"
                onError={() => setImgError(true)}
              />
            ) : fallbackIcon ? (
              fallbackIcon
            ) : (
              <div className="profile-avatar-fallback">
                <User
                  size={18}
                  strokeWidth={2}
                  style={{
                    color: 'var(--text-muted, #94a3b8)',
                    flexShrink: 0
                  }}
                />
              </div>
            )}
          </div>

          <ToolTip
            text={
              isLoggedIn && user
                ? (user.email && user.name ? `${user.name} • ${user.email}` : user.name || user.email || 'Google User')
                : (fallbackName || (isLoading ? 'Signing in…' : 'Sign in with Google'))
            }
            position="top"
          >
            <span
              style={{
                fontSize: '11.5px',
                fontWeight: '500',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                color: isHovered ? 'var(--text-main)' : 'var(--text-muted)',
                transition: 'color 0.15s ease',
                flex: '1 1 0%',
                minWidth: 0
              }}
            >
              {displayName}
            </span>
          </ToolTip>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            paddingRight: '2px',
            flexShrink: 0
          }}
        >
          <div style={{ opacity: 0.5 }}>
            <Version />
          </div>

          {isLoggedIn && showLogout && (
            <ToolTip text="Sign out of Google" position="top">
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Sign out of Google"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isHovered ? 'var(--text-muted)' : 'transparent',
                  pointerEvents: isHovered ? 'auto' : 'none',
                  transition: 'color 0.15s ease, background-color 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.stopPropagation()
                  e.currentTarget.style.color = '#ef4444'
                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)'
                }}
                onMouseLeave={(e) => {
                  e.stopPropagation()
                  e.currentTarget.style.color = 'var(--text-muted)'
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <LogOut size={12} strokeWidth={2} />
              </button>
            </ToolTip>
          )}
        </div>
      </div>
    </div>
  )
})

Profile.displayName = 'Profile'

export default Profile
