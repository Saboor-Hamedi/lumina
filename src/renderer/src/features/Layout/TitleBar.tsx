/**
 * =========================================================================
 * TitleBar Component (`TitleBar.tsx`)
 * =========================================================================
 *
 * Custom Tauri frameless application title bar for Lumina.
 *
 * Architecture & Features:
 * - Left pane: Left sidebar toggle, app logo, and update status indicator.
 * - Center pane: Unified "Ask anything or Search..." quick-trigger input (Ctrl + P / Cmd + P).
 * - Right pane: User avatar / accent color quick controls & native-feel window buttons (Minimize, Maximize, Close).
 * - Memoized and typed with strict TypeScript safety.
 * =========================================================================
 */

import React, { useState, useEffect, useCallback, memo } from 'react'
import { Square, X, Minus, Search, PanelLeftOpen, PanelLeftClose, User } from 'lucide-react'
import { useCurrentUser } from '../../core/hooks/useCurrentUser'
import ToolTip from '../../components/atoms/ToolTip'
import UpdateButton from '../../components/update/UpdateButton'
import WorkspaceSwitcher from './WorkspaceSwitcher'
import AccentColor from '../theme/AccentColor'
import { useFontSettings } from '../../core/hooks/useFontSettings'
import { useSettingStore } from '../../core/store/SettingStore'
import { CalendarToggle } from '../calendar'
import { minimizeWindow, toggleMaximizeWindow, closeWindow } from '../../core/tauriBridge'
import '../../assets/titlebar.css'

export interface TitleBarProps {
  className?: string
  isHidden?: boolean
}

export const TitleBar: React.FC<TitleBarProps> = memo(({ isHidden = false }) => {
  const handleMinimize = useCallback(() => minimizeWindow(), [])
  const handleToggleMaximize = useCallback(() => toggleMaximizeWindow(), [])
  const handleClose = useCallback(() => closeWindow(), [])

  const [isAccentOpen, setIsAccentOpen] = useState<boolean>(false)
  const { themeAccentColor, updateThemeAccentColor } = useFontSettings()
  const { user, isLoggedIn } = useCurrentUser()
  const [imgError, setImgError] = useState<boolean>(false)

  useEffect(() => {
    if (isHidden) {
      setIsAccentOpen(false)
    }
  }, [isHidden])

  useEffect(() => {
    setImgError(false)
  }, [user?.picture])

  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState<boolean>(() => {
    return useSettingStore.getState().settings?.sidebar?.isLeftOpen ?? true
  })

  const [isMaximized, setIsMaximized] = useState<boolean>(false)

  const isMac =
    typeof navigator !== 'undefined' &&
    /mac/i.test(navigator.platform || navigator.userAgent)

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-window-maximized', String(isMaximized))
    }
  }, [isMaximized])

  useEffect(() => {
    if ((window as any).api?.isMaximized) {
      (window as any).api.isMaximized().then(setIsMaximized).catch(() => {})
    }

    const unsubMax = (window as any).api?.onMaximizedChange?.((max: boolean) => {
      setIsMaximized(max)
    })

    const handleLeftSidebarChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ open?: boolean }>
      if (typeof customEvent.detail?.open === 'boolean') {
        setIsLeftSidebarOpen(customEvent.detail.open)
      }
    }
    window.addEventListener('left-sidebar-toggle', handleLeftSidebarChange)
    return () => {
      window.removeEventListener('left-sidebar-toggle', handleLeftSidebarChange)
      if (typeof unsubMax === 'function') unsubMax()
    }
  }, [])

  const handleToggleLeftSidebar = useCallback(() => {
    window.dispatchEvent(new CustomEvent('toggle-left-sidebar'))
  }, [])

  return (
    <div
      className={`title-bar${isMac ? ' is-mac' : ''}${isHidden ? ' zen-hidden' : ''}`}
      aria-hidden={isHidden || undefined}
      data-testid="title-bar"
      data-tauri-drag-region
    >
      <div className="title-bar-inner" data-tauri-drag-region>
      <div className="title-left" data-tauri-drag-region>
        <ToolTip text={isLeftSidebarOpen ? 'Close Sidebar' : 'Open Sidebar'} position="bottom">
          <button
            type="button"
            onClick={handleToggleLeftSidebar}
            className="control-btn titlebar-sidebar-toggle-btn"
            aria-label={isLeftSidebarOpen ? 'Close Sidebar' : 'Open Sidebar'}
          >
            {isLeftSidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
          </button>
        </ToolTip>
        <div className="app-logo-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'relative', flexShrink: 0 }}>
          <WorkspaceSwitcher isHidden={isHidden} />
          <UpdateButton />
        </div>
      </div>

      <div className="title-center" data-tauri-drag-region>
        <ToolTip text={isMac ? 'Search or Ask AI (⌘P)' : 'Search or Ask AI (Ctrl + P)'} position="bottom">
          <div
            className="unified-search-bar"
            onClick={() => window.dispatchEvent(new CustomEvent('open-ask-anything'))}
          >
            <span className="search-icon">
              <Search size={13} />
            </span>
            <span className="search-placeholder">Ask anything or Search...</span>
            <div className="search-shortcuts-wrap">
              <kbd className="titlebar-kbd">{isMac ? '⌘' : 'Ctrl'}</kbd>
              <span className="titlebar-kbd-plus">+</span>
              <kbd className="titlebar-kbd">P</kbd>
            </div>
          </div>
        </ToolTip>
      </div>

      <div className="title-right" data-tauri-drag-region>
        <div className="window-controls" data-testid="window-controls">
          <CalendarToggle />
          <div className="accent-titlebar-container">
            <ToolTip
              text={
                isLoggedIn && (user?.name || user?.email)
                  ? `${user.name || user.email} • Appearance & Controls`
                  : 'Appearance & Quick Controls'
              }
              position="bottom"
            >
              <button
                type="button"
                className="accent-titlebar-btn"
                onClick={() => setIsAccentOpen((prev) => !prev)}
                aria-label="Appearance and quick controls"
              >
                <div
                  className="accent-titlebar-avatar-wrap"
                  style={{
                    borderColor: themeAccentColor || 'var(--text-accent)',
                    borderWidth: '1.5px',
                    borderStyle: 'solid'
                  }}
                >
                  {isLoggedIn && user?.picture && !imgError ? (
                    <img
                      src={user.picture}
                      alt={user.name || 'User'}
                      className="accent-titlebar-avatar-img"
                      referrerPolicy="no-referrer"
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    <div className="accent-titlebar-avatar-fallback">
                      <User
                        size={16}
                        strokeWidth={2}
                        style={{ color: 'var(--text-muted)', flexShrink: 0 }}
                      />
                    </div>
                  )}
                </div>
              </button>
            </ToolTip>
            {isAccentOpen && (
              <AccentColor
                isOpen={isAccentOpen}
                onClose={() => setIsAccentOpen(false)}
                initialColor={themeAccentColor}
                defaultColor={themeAccentColor || undefined}
                onSelect={(color: string) => {
                  updateThemeAccentColor(color)
                }}
                previewProperty="--text-accent"
                title="Theme Accent"
                variant="dropdown"
              />
            )}
          </div>
          {!isMac && (
            <>
              <span className="titlebar-controls-divider" aria-hidden="true" />
              <button type="button" onClick={handleMinimize} className="control-btn" aria-label="Minimize">
                <Minus size={14} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={handleToggleMaximize}
                className="control-btn"
                aria-label={isMaximized ? 'Restore' : 'Maximize'}
              >
                {isMaximized ? (
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3.5" y="1.5" width="6" height="6" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M1.5 3.5V9.5H7.5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <Square size={11} strokeWidth={1.7} />
                )}
              </button>
              <button type="button" onClick={handleClose} className="control-btn close" aria-label="Close">
                <X size={14} strokeWidth={2} />
              </button>
            </>
          )}
        </div>
      </div>
      </div>

    </div>
  )
})

TitleBar.displayName = 'TitleBar'

export default TitleBar
