import React from 'react'
import { Plus, History, Star, Search, Layout } from 'lucide-react'
import { useVaultStore } from '../../../core/store/useVaultStore'

/**
 * Dashboard Component
 * An intelligent, beautiful starting point when no note is active.
 * Features: Statistics, Recent Actions, and Quick Start prompts.
 */
const Dashboard = ({ onNew }) => {
  const { snippets, setSelectedSnippet } = useVaultStore()
  
  const recentSnippets = [...snippets]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 4)

  const pinnedSnippets = snippets.filter(s => s.isPinned).slice(0, 4)

  return (
    <div className="lumina-dashboard">
      <div className="dashboard-content">
        <header className="dashboard-header">
          <div className="branding">
            <h1 className="dashboard-title">Good Morning, Explorer</h1>
            <p className="dashboard-subtitle">Your vault has {snippets.length} active ideas.</p>
          </div>
          <button className="btn-dashboard-new" onClick={onNew}>
               <Plus size={18} />
               <span>New Idea</span>
          </button>
        </header>

        <div className="dashboard-grid">
          {/* Quick Stats */}
          <section className="dashboard-section compact">
             <div className="section-head">
                <Layout size={14} className="s-icon" />
                <span>Quick Actions</span>
             </div>
             <div className="action-cards">
                <div className="action-card" onClick={onNew}>
                    <Plus size={16} />
                    <p>Create Note</p>
                </div>
                <div className="action-card" onClick={() => window.dispatchEvent(new CustomEvent('toggle-palette'))}>
                    <Search size={16} />
                    <p>Fuzzy Search</p>
                </div>
             </div>
          </section>

          {/* Pinned Notes */}
          {pinnedSnippets.length > 0 && (
            <section className="dashboard-section">
                <div className="section-head">
                    <Star size={14} className="s-icon" />
                    <span>Pinned</span>
                </div>
                <div className="snippet-links">
                    {pinnedSnippets.map(s => (
                        <div key={s.id} className="snippet-link" onClick={() => setSelectedSnippet(s)}>
                            <span className="s-title">{s.title || 'Untitled'}</span>
                        </div>
                    ))}
                </div>
            </section>
          )}

          {/* Recent Continuity */}
          <section className="dashboard-section">
             <div className="section-head">
                <History size={14} className="s-icon" />
                <span>Resume Work</span>
             </div>
             <div className="snippet-links">
                {recentSnippets.map(s => (
                    <div key={s.id} className="snippet-link" onClick={() => setSelectedSnippet(s)}>
                        <div className="link-info">
                            <span className="s-title">{s.title || 'Untitled'}</span>
                            <span className="s-meta">{new Date(s.timestamp).toLocaleDateString()}</span>
                        </div>
                    </div>
                ))}
             </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
