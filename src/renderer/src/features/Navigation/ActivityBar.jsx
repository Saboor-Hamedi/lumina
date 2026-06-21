import React from 'react'
import { Network, Calendar, Palette, Settings, ArrowUpCircle, RefreshCw, Files } from 'lucide-react'
import { useUpdateStore } from '../../core/store/useUpdateStore'
import { useVaultStore } from '../../core/store/useVaultStore'
import ToolTip from '../../components/atoms/ToolTip'
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
    const existing = snippets.find((s) => s.title === title || s.title === `${today}.md`)

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
    <div className="activity-bar sidebar">
      <div className="bar-top">
        <ToolTip text="Explorer (Ctrl+B)">
          <button
            className="sidebar-item"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onToggleExplorerModal?.()
            }}
          >
            <Files size={20} strokeWidth={1.5} />
          </button>
        </ToolTip>
        <ToolTip text="Graph View (Ctrl+G)">
          <button
            className="sidebar-item"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onToggleGraph?.()
            }}
          >
            <Network size={20} strokeWidth={1.5} />
          </button>
        </ToolTip>
        <ToolTip text="Today's Note">
          <button className="sidebar-item" onClick={handleDailyNote}>
            <Calendar size={20} strokeWidth={1.5} />
          </button>
        </ToolTip>
      </div>

      <div className="bar-bottom">
        {(status === 'available' ||
          status === 'downloading' ||
          status === 'ready' ||
          status === 'error' ||
          status === 'checking') && (
          <ToolTip text={
              status === 'downloading'
                ? `Downloading... ${Math.round(progress?.percent || 0)}%`
                : status === 'error'
                  ? 'Update failed'
                  : 'Update Lumina'
            }>
          <button
            className={`sidebar-item update-btn ${status === 'downloading' ? 'loading' : ''} ${status === 'ready' ? 'ready' : ''} ${status === 'error' ? 'error' : ''}`}
            onClick={
              status === 'error'
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
              <ArrowUpCircle size={20} />
            )}
            {status === 'downloading' && (
              <div className="update-progress-mini">
                <div className="progress-inner" style={{ height: `${progress?.percent || 0}%` }} />
              </div>
            )}
          </button>
          </ToolTip>
        )}

        <ToolTip text="Theme">
          <button className="sidebar-item" onClick={onThemeClick}>
            <Palette size={20} strokeWidth={1.5} />
          </button>
        </ToolTip>

        <ToolTip text="Settings (Ctrl+,)">
          <button className="sidebar-item" onClick={onSettingsClick}>
            <Settings size={20} strokeWidth={1.5} />
          </button>
        </ToolTip>
      </div>
    </div>
  )
}

export default ActivityBar
