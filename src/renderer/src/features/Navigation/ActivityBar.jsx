import { Files, Search, Settings, Network, ArrowUpCircle, RefreshCw } from 'lucide-react'
import { useUpdateStore } from '../../core/store/useUpdateStore'
import { useVaultStore } from '../../core/store/useVaultStore'
import { GRAPH_TAB_ID } from '../../core/store/useVaultStore'
import './ActivityBar.css'

/**
 * ActivityBar Component
 * Sidebar navigation with file explorer, search, graph view, and settings.
 * 
 * Graph view opens as a tab when clicked (not just switching view).
 * This allows users to switch between graph and notes seamlessly via tabs.
 * 
 * Explorer icon toggles the left sidebar (like VSCode).
 */
const ActivityBar = ({ activeTab, onTabChange, onSettingsClick, onToggleSidebar, isLeftSidebarOpen }) => {
  const { status, progress, download, install } = useUpdateStore()
  const { openGraphTab, activeTabId } = useVaultStore()

  const handleUpdateClick = () => {
    if (status === 'available') download()
    if (status === 'ready') install()
  }

  return (
    <div className="activity-bar">
      <div className="bar-top">
        <button
          className={`bar-item ${(isLeftSidebarOpen && activeTab === 'files') || activeTabId === GRAPH_TAB_ID ? 'active' : ''}`}
          onClick={() => {
            // Toggle sidebar (VSCode-like behavior)
            if (onToggleSidebar) {
              onToggleSidebar()
            }
            // Also switch to files view if not already
            if (activeTab !== 'files') {
              onTabChange('files')
            }
          }}
          title="Explorer (Toggle sidebar)"
        >
          <Files size={24} strokeWidth={1.5} />
        </button>
        <button
          className={`bar-item ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => onTabChange('search')}
          title="Search"
        >
          <Search size={24} strokeWidth={1.5} />
        </button>
        <button
          className={`bar-item ${activeTabId === GRAPH_TAB_ID ? 'active' : ''}`}
          onClick={() => {
            // Open graph as a tab instead of just switching view
            openGraphTab()
            // Also activate explorer tab when graph is opened
            onTabChange('files')
          }}
          title="Graph View (Opens as tab)"
        >
          <Network size={24} strokeWidth={1.5} />
        </button>
      </div>

      <div className="bar-bottom">
        {(status === 'available' ||
          status === 'downloading' ||
          status === 'ready' ||
          status === 'error' ||
          status === 'idle' ||
          status === 'checking') && (
          <button
            className={`bar-item update-btn ${status === 'downloading' ? 'loading' : ''} ${status === 'ready' ? 'ready' : ''} ${status === 'error' ? 'error' : ''}`}
            title={
              status === 'downloading'
                ? `Downloading... ${Math.round(progress?.percent || 0)}%`
                : status === 'error'
                  ? 'Update failed'
                  : 'Update Lumina'
            }
            onClick={
              status === 'error' || status === 'idle'
                ? () => useUpdateStore.getState().check()
                : handleUpdateClick
            }
          >
            {status === 'ready' || status === 'checking' ? (
              <RefreshCw
                size={22}
                className={`spin-slow ${status === 'checking' ? 'checking-spin' : ''}`}
                style={{ opacity: status === 'checking' ? 0.5 : 1 }}
              />
            ) : status === 'error' ? (
              <div style={{ color: '#ef4444' }}>
                <ArrowUpCircle size={22} />
              </div>
            ) : (
              <ArrowUpCircle
                size={22}
                color="var(--text-accent)"
                style={{ opacity: status === 'idle' ? 0.3 : 1 }}
              />
            )}
            {status === 'downloading' && (
              <div className="update-progress-mini">
                <div className="progress-inner" style={{ height: `${progress?.percent || 0}%` }} />
              </div>
            )}
          </button>
        )}
        <button className="bar-item" title="Settings" onClick={onSettingsClick}>
          <Settings size={22} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}

export default ActivityBar
