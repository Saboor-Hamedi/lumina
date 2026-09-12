import React from 'react'
import { Square, X, Minus, Search, MessageSquare, PanelLeftOpen, PanelLeftClose, User, Mail } from 'lucide-react'
import { useWorkspaceStore } from '../../core/store/workspaceStore'
import { useCurrentUser } from '../../core/hooks/useCurrentUser'
import logoUrl from '../../assets/logo.png'
import ToolTip from '../../components/atoms/ToolTip'
import UpdateDetails from '../../components/update/UpdateDetails'
import AccentColor from '../theme/AccentColor'
import { useFontSettings } from '../../core/hooks/useFontSettings'
import { EmailContainer, playNewEmailTone } from '../email'
import '../../assets/titlebar.css'

const TitleBar = ({ onToggleAIChat }) => {
  const handleMinimize = () => window.api?.minimize()
  const handleToggleMaximize = () => window.api?.toggleMaximize()
  const handleClose = () => window.api?.closeWindow()

  const [version, setVersion] = React.useState('')
  const [isAccentOpen, setIsAccentOpen] = React.useState(false)
  const [isMailOpen, setIsMailOpen] = React.useState(false)
  const { themeAccentColor, updateThemeAccentColor } = useFontSettings()
  const { user, isLoggedIn } = useCurrentUser()
  const [imgError, setImgError] = React.useState(false)

  React.useEffect(() => {
    setImgError(false)
  }, [user?.picture])

  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = React.useState(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('lumina_left_sidebar_open')
      if (saved !== null) return saved === 'true'
    }
    return true
  })
  const selectedSnippet = useWorkspaceStore((s) => s.selectedSnippet)
  const isMac = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('mac')

  const [unreadEmailCount, setUnreadEmailCount] = React.useState(0)
  const prevUnreadCountRef = React.useRef(-1)

  // Poll for unread emails and trigger desktop notifications if new mail arrives
  React.useEffect(() => {
    if (!isLoggedIn) {
      setUnreadEmailCount(0)
      prevUnreadCountRef.current = -1
      return
    }

    let isMounted = true

    // Request Web Notification permission if needed
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      try {
        Notification.requestPermission()
      } catch {}
    }

    const checkUnread = async () => {
      try {
        if (window.api?.getUnreadEmailCount) {
          const res = await window.api.getUnreadEmailCount()
          if (!isMounted) return
          const newCount = res?.count || 0
          setUnreadEmailCount(newCount)

          // If new unread mail arrived and increased count, trigger notification if not muted
          if (prevUnreadCountRef.current >= 0 && newCount > prevUnreadCountRef.current) {
            const isMuted = localStorage.getItem('lumina_email_notifications') === 'false'
            if (!isMuted) {
              const title = 'New Email'
              const body = 'New Email'

              // Play gentle email chime tone via isolated sound service
              playNewEmailTone()

              // 1. Native Electron OS Notification
              if (window.api?.showEmailNotification) {
                window.api.showEmailNotification({ title, body })
              }
              // 2. Web Notification API fallback
              if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                try {
                  new Notification(title, { body })
                } catch {}
              }
              // 3. In-app toast banner
              window.dispatchEvent(
                new CustomEvent('show-toast', {
                  detail: { message: '📬 New Email', type: 'info', duration: 3500 }
                })
              )
            }
          }
          prevUnreadCountRef.current = newCount
        }
      } catch (err) {
        // Silently catch in polling loop
      }
    }

    checkUnread()
    // Poll every 15 seconds for real-time live inbox updates
    const interval = setInterval(checkUnread, 15000)

    // Listen for instant refresh events
    const handleEmailRefresh = () => checkUnread()
    window.addEventListener('refresh-unread-count', handleEmailRefresh)

    return () => {
      isMounted = false
      clearInterval(interval)
      window.removeEventListener('refresh-unread-count', handleEmailRefresh)
    }
  }, [isLoggedIn])

  React.useEffect(() => {
    if (window.api?.getVersion) {
      window.api.getVersion().then(setVersion)
    }

    const handleLeftSidebarChange = (e) => {
      if (typeof e.detail?.open === 'boolean') {
        setIsLeftSidebarOpen(e.detail.open)
      }
    }
    window.addEventListener('left-sidebar-toggle', handleLeftSidebarChange)
    return () => {
      window.removeEventListener('left-sidebar-toggle', handleLeftSidebarChange)
    }
  }, [])

  // Listen for open/close email events triggered from shortcuts or notifications
  React.useEffect(() => {
    const handleOpenEmail = () => setIsMailOpen(true)
    const handleCloseEmail = () => setIsMailOpen(false)
    window.addEventListener('open-email', handleOpenEmail)
    window.addEventListener('close-email', handleCloseEmail)
    return () => {
      window.removeEventListener('open-email', handleOpenEmail)
      window.removeEventListener('close-email', handleCloseEmail)
    }
  }, [])

  const handleToggleLeftSidebar = () => {
    window.dispatchEvent(new CustomEvent('toggle-left-sidebar'))
  }

  return (
    <div className="title-bar" data-testid="title-bar">
      <div className="title-left">
        <ToolTip text={isLeftSidebarOpen ? "Close Sidebar" : "Open Sidebar"} position="bottom">
          <button
            onClick={handleToggleLeftSidebar}
            className="control-btn titlebar-sidebar-toggle-btn"
          >
            {isLeftSidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
          </button>
        </ToolTip>
        <div className="app-logo-wrapper" style={{ display: 'flex', alignItems: 'center', position: 'relative', flexShrink: 0 }}>
          <div className="app-logo">
            <div
              style={{
                width: 14,
                height: 14,
                backgroundColor: 'var(--text-accent)',
                maskImage: `url(${logoUrl})`,
                WebkitMaskImage: `url(${logoUrl})`,
                maskSize: 'contain',
                WebkitMaskSize: 'contain',
                maskRepeat: 'no-repeat',
                WebkitMaskRepeat: 'no-repeat',
                maskPosition: 'center',
                WebkitMaskPosition: 'center'
              }}
            />
            <span className="app-name" data-testid="app-name">
              Lumina
            </span>
          </div>

          <UpdateDetails />
        </div>
      </div>

      <div className="title-center">
        <ToolTip text={isMac ? "Search or Ask AI (⌘P)" : "Search or Ask AI (Ctrl + P)"} position="bottom">
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

      <div className="title-right">
        <div className="window-controls" data-testid="window-controls">
          <div className="mail-titlebar-container">
            <ToolTip text={unreadEmailCount > 0 ? `Lumina Mail (${unreadEmailCount} unread)` : "Lumina Mail"} position="bottom">
              <button
                type="button"
                onClick={() => setIsMailOpen((prev) => !prev)}
                className="control-btn mail-control-btn"
                style={{ color: isMailOpen || unreadEmailCount > 0 ? 'var(--text-accent)' : 'var(--text-faint, #64748b)' }}
                aria-label="Open Lumina Mail"
              >
                <Mail size={14} strokeWidth={2} />
                {unreadEmailCount > 0 && (
                  <span className="mail-unread-badge">
                    {unreadEmailCount >= 1000000
                      ? `${(unreadEmailCount / 1000000).toFixed(1).replace(/\.0$/, '')}M`
                      : unreadEmailCount >= 1000
                      ? `${(unreadEmailCount / 1000).toFixed(1).replace(/\.0$/, '')}K`
                      : unreadEmailCount > 99
                      ? '99+'
                      : unreadEmailCount}
                  </span>
                )}
              </button>
            </ToolTip>
            <EmailContainer
              isOpen={isMailOpen}
              onClose={() => setIsMailOpen(false)}
            />
          </div>
          <ToolTip text={isMac ? "Toggle AI Chat (⌘ + Shift + \\)" : "Toggle AI Chat (Ctrl + Shift + \\)"} position="bottom">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-ai-chat'))}
              className="control-btn"
              style={{ color: 'var(--text-accent)' }}
            >
              <MessageSquare size={14} strokeWidth={2} />
            </button>
          </ToolTip>
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
                    borderColor: themeAccentColor || 'var(--text-accent, #40bafa)',
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
                        style={{ color: 'var(--text-muted, #94a3b8)', flexShrink: 0 }}
                      />
                    </div>
                  )}
                </div>
              </button>
            </ToolTip>
            <AccentColor
              isOpen={isAccentOpen}
              onClose={() => setIsAccentOpen(false)}
              initialColor={themeAccentColor}
              defaultColor="#40bafa"
              onSelect={(color) => {
                updateThemeAccentColor(color)
              }}
              previewProperty="--text-accent"
              title="Theme Accent"
              variant="dropdown"
            />
          </div>
          <button onClick={handleMinimize} className="control-btn" aria-label="Minimize">
            <Minus size={14} strokeWidth={2} />
          </button>
          <button onClick={handleToggleMaximize} className="control-btn" aria-label="Maximize">
            <Square size={14} strokeWidth={2} />
          </button>
          <button onClick={handleClose} className="control-btn close" aria-label="Close">
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default TitleBar
