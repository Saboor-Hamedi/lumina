import { Files, Search, Settings, Network, ArrowUpCircle, RefreshCw, Palette, Calendar } from 'lucide-react'
import { useUpdateStore } from '../../core/store/useUpdateStore'
import { useVaultStore } from '../../core/store/useVaultStore'
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
const ActivityBar = ({ activeTab, onTabChange, onSettingsClick, onThemeClick = () => {}, onToggleSidebar, isLeftSidebarOpen, onToggleGraph }) => {
  const { status, progress, download, install } = useUpdateStore()
  const { snippets, saveSnippet, setSelectedSnippet } = useVaultStore()

  const handleDailyNote = async () => {
    const today = new Date().toISOString().split('T')[0]
    const title = today
    const existing = snippets.find(s => s.title === title || s.title === `${today}.md`)

    if (existing) {
      setSelectedSnippet(existing)
    } else {
      const newNote = {
        id: crypto.randomUUID(),
        title: title,
        code: `# ${today}\n\n`,
        language: 'markdown',
        timestamp: Date.now()
      }
      await saveSnippet(newNote)
      setSelectedSnippet(newNote)
    }
    onTabChange('files')
  }

  const handleUpdateClick = () => {
    if (status === 'available') download()
    if (status === 'ready') install()
  }

  return (
    <div className="activity-bar">
      <div className="bar-top">
        <button
          className={`bar-item ${activeTab === 'files' ? 'active' : ''}`}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (onToggleSidebar) {
              onToggleSidebar()
            }
            onTabChange('files')
          }}
          title="Explorer (Toggle sidebar)"
        >
          <Files size={24} strokeWidth={1.5} />
        </button>
        <button
          className={`bar-item ${activeTab === 'search' ? 'active' : ''}`}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (activeTab === 'search' && onToggleSidebar) {
              onToggleSidebar()
            } else {
              onTabChange('search')
              if (!isLeftSidebarOpen && onToggleSidebar) {
                onToggleSidebar()
              }
            }
          }}
          title="Search (Toggle sidebar)"
        >
          <Search size={24} strokeWidth={1.5} />
        </button>
        <button
          className="bar-item"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onToggleGraph?.()
          }}
          title="Graph View"
        >
          <Network size={24} strokeWidth={1.5} />
        </button>
        <button
          className="bar-item"
          onClick={handleDailyNote}
          title="Today's Note"
        >
          <Calendar size={24} strokeWidth={1.5} />
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
        <button
          className="bar-item"
          title="Themes"
          onClick={onThemeClick}
          style={{ color: 'var(--icon-primary, var(--text-accent))' }}
        >
          <Palette size={22} strokeWidth={1.5} />
        </button>
        <button className="bar-item" title="Settings" onClick={onSettingsClick}>
          <Settings size={22} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}

export default ActivityBar
