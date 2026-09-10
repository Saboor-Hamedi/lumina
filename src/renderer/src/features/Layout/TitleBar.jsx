import React from 'react'
import { Square, X, Minus, Search, MessageSquare, PanelLeftClose, PanelLeftOpen, CircleUser } from 'lucide-react'
import { useWorkspaceStore } from '../../core/store/workspaceStore'
import { useCurrentUser } from '../../core/hooks/useCurrentUser'
import logoUrl from '../../assets/logo.png'
import ToolTip from '../../components/atoms/ToolTip'
import UpdateDetails from '../../components/update/UpdateDetails'
import AccentColor from '../theme/AccentColor'
import { useFontSettings } from '../../core/hooks/useFontSettings'
import '../../assets/titlebar.css'

const TitleBar = ({ onToggleAIChat }) => {
  const handleMinimize = () => window.api?.minimize()
  const handleToggleMaximize = () => window.api?.toggleMaximize()
  const handleClose = () => window.api?.closeWindow()

  const [version, setVersion] = React.useState('')
  const [isAccentOpen, setIsAccentOpen] = React.useState(false)
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
                      <CircleUser
                        size={12}
                        style={{ color: themeAccentColor || 'var(--text-accent, #40bafa)' }}
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
