import React from 'react'
import { Network, Calendar, Palette, Settings, ArrowUpCircle, RefreshCw, Files } from 'lucide-react'
import { useUpdateStore } from '../../core/store/useUpdateStore'
import { useVaultStore } from '../../core/store/useVaultStore'
import './ActivityBar.css'

/**
 * Floating ActivityBar Component
 */
const ActivityBar = ({ onSettingsClick, onThemeClick, onToggleGraph, onToggleExplorerModal }) => {
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
  }

  const handleUpdateClick = () => {
    if (status === 'available') download()
    if (status === 'ready') install()
  }

  return (
    <div className="activity-bar floating">
      <div className="bar-top">
        <button
          className="bar-item"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onToggleExplorerModal?.()
          }}
          title="Explorer"
        >
          <Files size={20} strokeWidth={1.5} />
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
          <Network size={20} strokeWidth={1.5} />
        </button>
        <button
          className="bar-item"
          onClick={handleDailyNote}
          title="Today's Note"
        >
          <Calendar size={20} strokeWidth={1.5} />
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
                size={20}
                className={`spin-slow ${status === 'checking' ? 'checking-spin' : ''}`}
                style={{ opacity: status === 'checking' ? 0.5 : 1 }}
              />
            ) : status === 'error' ? (
              <div style={{ color: '#ef4444' }}>
                <ArrowUpCircle size={20} />
              </div>
            ) : (
              <ArrowUpCircle
                size={20}
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
          onClick={onThemeClick}
          title="Theme"
        >
          <Palette size={20} strokeWidth={1.5} />
        </button>

        <button
          className="bar-item"
          onClick={onSettingsClick}
          title="Settings"
        >
          <Settings size={20} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}

export default ActivityBar
