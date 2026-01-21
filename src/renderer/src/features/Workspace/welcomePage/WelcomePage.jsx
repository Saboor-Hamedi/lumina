import React from 'react'
import { Plus, FileText, Clock, ArrowRight } from 'lucide-react'
import { useVaultStore } from '../../../core/store/useVaultStore'
import './WelcomePage.css'

/**
 * Minimal welcome surface:
 * - Top bar with "Lumina" and New/Search icons
 * - Simple list of up to 3 recent notes
 */
const WelcomePage = ({ onNew }) => {
  const { snippets, setSelectedSnippet } = useVaultStore()

  const recent = [...snippets]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 3)

  const handleOpenPalette = () => {
    window.dispatchEvent(new CustomEvent('toggle-palette'))
  }

  const getTimeAgo = (timestamp) => {
    const diff = Date.now() - timestamp
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`
    return `${Math.floor(days / 30)} months ago`
  }

  return (
    <div className="welcome-page">
      <div className="welcome-background-art"></div>
      <div className="welcome-inner">
        {/* Compact Header with Actions and Title */}
        <div className="welcome-header">
          <button
            type="button"
            className="welcome-new-icon"
            onClick={onNew}
            title="New Note (Ctrl+N)"
          >
            <Plus size={18} />
          </button>
          <h1 className="welcome-title">
            <span className="welcome-title-accent">Lumina</span>
          </h1>
        </div>

        {/* Main Content: Recent Notes + Stats Side by Side */}
        <div className="welcome-main-content">
          {/* Recent Notes Section */}
          <div className="welcome-recent-section">
            <div className="welcome-section-header">
              <div className="welcome-section-title">
                <FileText size={16} />
                <h2>Recent Notes</h2>
              </div>
              {recent.length > 0 && (
                <button
                  type="button"
                  className="welcome-view-all"
                  onClick={() => window.dispatchEvent(new CustomEvent('toggle-palette', { detail: { showAll: true } }))}
                >
                  View All
                  <ArrowRight size={12} />
                </button>
              )}
            </div>

            {recent.length === 0 ? (
              <div className="welcome-empty-state">
                <div className="empty-state-icon">
                  <FileText size={32} />
                </div>
                <h3>No notes yet</h3>
                <button
                  type="button"
                  className="welcome-empty-action"
                  onClick={onNew}
                >
                  <Plus size={14} />
                  Create First Note
                </button>
              </div>
            ) : (
              <div className="welcome-grid">
                {recent.map((s) => (
                  <div
                    key={s.id}
                    className="welcome-card"
                    onClick={() => setSelectedSnippet(s)}
                  >
                    <div className="card-header">
                      <div className="card-icon">
                        <FileText size={16} />
                      </div>
                      <button
                        type="button"
                        className="card-open-button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedSnippet(s)
                        }}
                      >
                        <ArrowRight size={14} />
                      </button>
                    </div>
                    <h3 className="card-title">{s.title || 'Untitled'}</h3>
                    <p className="card-preview">
                      {s.code?.substring(0, 60) || 'No content'}
                    </p>
                    <div className="card-footer">
                      <div className="card-meta">
                        <Clock size={12} />
                        <span>{getTimeAgo(s.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats Sidebar */}
          <div className="welcome-stats-sidebar">
            <div className="stat-item">
              <div className="stat-value">{snippets.length}</div>
              <div className="stat-label">Total Notes</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">
                {snippets.filter(s => s.tags && s.tags.trim()).length}
              </div>
              <div className="stat-label">Tagged</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">
                {new Set(snippets.flatMap(s => (s.tags || '').split(',').filter(Boolean))).size}
              </div>
              <div className="stat-label">Tags</div>
            </div>
            <div className="welcome-footer-compact">
              <div className="footer-hint">
                <kbd>Ctrl</kbd> + <kbd>K</kbd> for commands
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WelcomePage
