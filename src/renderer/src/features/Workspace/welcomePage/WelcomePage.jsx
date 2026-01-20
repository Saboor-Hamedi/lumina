import React from 'react'
import { Plus, Search, FileText, Clock, ArrowRight } from 'lucide-react'
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
        {/* Hero Section */}
        <div className="welcome-hero">
          <div className="welcome-hero-content">
            <h1 className="welcome-title">
              <span className="welcome-title-accent">Lumina</span>
            </h1>
            <p className="welcome-subtitle">
              A minimal space for your thoughts, ideas, and notes.
            </p>
            <div className="welcome-hero-actions">
              <button
                type="button"
                className="welcome-primary-button"
                onClick={onNew}
              >
                <Plus size={18} />
                <span>New Note</span>
              </button>
              <button
                type="button"
                className="welcome-secondary-button"
                onClick={handleOpenPalette}
              >
                <Search size={18} />
                <span>Search Notes</span>
              </button>
            </div>
          </div>
        </div>

        {/* Recent Notes Section */}
        <div className="welcome-recent-section">
          <div className="welcome-section-header">
            <div className="welcome-section-title">
              <FileText size={18} />
              <h2>Recent Notes</h2>
            </div>
            {recent.length > 0 && (
              <button
                type="button"
                className="welcome-view-all"
                onClick={() => window.dispatchEvent(new CustomEvent('toggle-palette', { detail: { showAll: true } }))}
              >
                View All
                <ArrowRight size={14} />
              </button>
            )}
          </div>

          {recent.length === 0 ? (
            <div className="welcome-empty-state">
              <div className="empty-state-icon">
                <FileText size={48} />
              </div>
              <h3>No notes yet</h3>
              <p>Create your first note to get started</p>
              <button
                type="button"
                className="welcome-empty-action"
                onClick={onNew}
              >
                <Plus size={18} />
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
                      <FileText size={20} />
                    </div>
                    <button
                      type="button"
                      className="card-open-button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedSnippet(s)
                      }}
                    >
                      <ArrowRight size={16} />
                    </button>
                  </div>
                  <h3 className="card-title">{s.title || 'Untitled'}</h3>
                  <p className="card-preview">
                    {s.content?.substring(0, 120) || 'No content'}...
                  </p>
                  <div className="card-footer">
                    <div className="card-meta">
                      <Clock size={14} />
                      <span>{getTimeAgo(s.timestamp)}</span>
                    </div>
                    <div className="card-tag">
                      {s.tags?.[0] || 'Note'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="welcome-stats">
          <div className="stat-item">
            <div className="stat-value">{snippets.length}</div>
            <div className="stat-label">Total Notes</div>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-item">
            <div className="stat-value">
              {snippets.filter(s => s.tags?.length > 0).length}
            </div>
            <div className="stat-label">Tagged</div>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-item">
            <div className="stat-value">
              {new Set(snippets.flatMap(s => s.tags || [])).size}
            </div>
            <div className="stat-label">Unique Tags</div>
          </div>
        </div>

        {/* Footer with quick actions */}
        <footer className="welcome-footer">
          <div className="footer-actions">
            <button
              type="button"
              className="footer-action-button"
              onClick={() => window.dispatchEvent(new CustomEvent('toggle-palette', { detail: { command: 'import' } }))}
            >
              Import Notes
            </button>
            <button
              type="button"
              className="footer-action-button"
              onClick={() => window.dispatchEvent(new CustomEvent('toggle-palette', { detail: { command: 'export' } }))}
            >
              Export All
            </button>
          </div>
          <div className="footer-hint">
            Press <kbd>Ctrl</kbd> + <kbd>K</kbd> to open command palette
          </div>
        </footer>
      </div>
    </div>
  )
}

export default WelcomePage
