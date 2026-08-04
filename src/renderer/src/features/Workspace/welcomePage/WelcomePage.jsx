import React from 'react'
import { FileText, Search, Sparkles, FolderTree, Command } from 'lucide-react'
import icon from '../../../assets/icon.png'
import './WelcomePage.css'

const WelcomePage = ({ onNew }) => {
  const handlePalette = () =>
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true }))
  const handleAIChat = () =>
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '\\', ctrlKey: true, shiftKey: true }))

  return (
    <div className="welcome-page">
      <div className="welcome-watermark">
        <img src={icon} alt="Lumina Watermark" />
      </div>

      <div className="welcome-inner-centered">
        <div className="welcome-header-hero">
          <h1 className="hero-title">What are you thinking about today?</h1>
          <p className="hero-subtitle">
            Your personal AI-powered workspace for ideas, research, and writing.
          </p>
        </div>

        <div className="welcome-actions-grid">
          <button className="welcome-action-card" onClick={onNew}>
            <div className="action-card-icon" style={{ color: 'var(--text-accent, #3b82f6)' }}>
              <FileText size={16} />
            </div>
            <div className="action-card-content">
              <h3>Create a new note</h3>
              <p>Start writing instantly</p>
            </div>
            <div className="action-shortcut">Ctrl + N</div>
          </button>

          <button className="welcome-action-card" onClick={handlePalette}>
            <div className="action-card-icon" style={{ color: '#10b981' }}>
              <Search size={16} />
            </div>
            <div className="action-card-content">
              <h3>Quick Search</h3>
              <p>Find any note or command</p>
            </div>
            <div className="action-shortcut">Ctrl + P</div>
          </button>

          <button
            className="welcome-action-card"
            onClick={() =>
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }))
            }
          >
            <div className="action-card-icon" style={{ color: '#f59e0b' }}>
              <FolderTree size={16} />
            </div>
            <div className="action-card-content">
              <h3>Toggle Sidebar</h3>
              <p>Browse your workspace</p>
            </div>
            <div className="action-shortcut">Ctrl + B</div>
          </button>

          <button className="welcome-action-card" onClick={handleAIChat}>
            <div className="action-card-icon" style={{ color: '#8b5cf6' }}>
              <Sparkles size={16} />
            </div>
            <div className="action-card-content">
              <h3>AI Assistant</h3>
              <p>Chat with your knowledge</p>
            </div>
            <div className="action-shortcut">Ctrl+Shift+I</div>
          </button>
        </div>

        <div className="welcome-footer-hint">
          <Command size={14} />
          <span>
            Press <strong>Ctrl+P</strong> anywhere to open Quick Search
          </span>
        </div>
      </div>
    </div>
  )
}

export default WelcomePage
