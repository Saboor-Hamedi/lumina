import React from 'react'
import { Square, X, Minus, Search, MessageSquare, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useVaultStore } from '../../core/store/workspaceStore'
import logoUrl from '../../assets/logo.png'
import ToolTip from '../../components/atoms/ToolTip'
import UpdateDetails from '../../components/update/UpdateDetails'
import '../../assets/titlebar.css'

const TitleBar = ({ onToggleAIChat }) => {
  const handleMinimize = () => window.api?.minimize()
  const handleToggleMaximize = () => window.api?.toggleMaximize()
  const handleClose = () => window.api?.closeWindow()

  const [version, setVersion] = React.useState('')
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = React.useState(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('lumina_left_sidebar_open')
      if (saved !== null) return saved === 'true'
    }
    return true
  })
  const selectedSnippet = useVaultStore((s) => s.selectedSnippet)
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
        <div className="app-logo-wrapper" style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
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
          <ToolTip text="Minimize" position="bottom">
            <button onClick={handleMinimize} className="control-btn">
              <Minus size={14} strokeWidth={2} />
            </button>
          </ToolTip>
          <ToolTip text="Maximize" position="bottom">
            <button onClick={handleToggleMaximize} className="control-btn">
              <Square size={14} strokeWidth={2} />
            </button>
          </ToolTip>
          <ToolTip text="Close" position="bottom">
            <button onClick={handleClose} className="control-btn close">
              <X size={14} strokeWidth={2} />
            </button>
          </ToolTip>
        </div>
      </div>
    </div>
  )
}

export default TitleBar
