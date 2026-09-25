/**
 * =========================================================================
 * Welcome Component (`Welcome.tsx`)
 * =========================================================================
 *
 * The initial landing and dashboard canvas displayed when no note or workspace
 * item is currently selected in Lumina.
 *
 * Features:
 * - Ambient Lumina SVG watermark / constellation graphic
 * - Hero welcome typography and value proposition
 * - Quick action grid cards:
 *     - "Create a new note" (Ctrl + N)
 *     - "Quick Search" (Ctrl + P)
 *     - "Toggle Sidebar" (Ctrl + B)
 *     - "Lumina AI Assistant" (Ctrl + Shift + \)
 * - Top-right action buttons for Documentation (Ctrl + D) and Guide
 *
 * Fully typed with TypeScript for guaranteed runtime stability.
 * =========================================================================
 */

import React from 'react'
import { FileText, Search, Sparkles, FolderTree, Command, Book, Compass } from 'lucide-react'
import ToolTip from './components/atoms/ToolTip'
import './assets/welcome.css'

export interface WelcomeProps {
  /** Callback triggered to create a new note */
  onNew?: () => void
  /** Callback triggered to open the documentation panel or view */
  onOpenDocs?: () => void
  /** Callback triggered to open the Lumina interactive guide */
  onOpenGuide?: () => void
  /** Callback triggered to toggle open/close the Lumina AI chat drawer */
  onToggleAIChat?: () => void
}

export const Welcome: React.FC<WelcomeProps> = ({
  onNew,
  onOpenDocs,
  onOpenGuide,
  onToggleAIChat
}) => {
  const handlePalette = (): void => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true }))
  }

  const handleAIChat = (): void => {
    if (onToggleAIChat) {
      onToggleAIChat()
    } else {
      window.dispatchEvent(new CustomEvent('open-ai-chat'))
    }
  }

  return (
    <div className="welcome-page">
      {/* Top-Right Action Buttons */}
      <div className="welcome-top-actions">
        {onOpenDocs && (
          <ToolTip text="Documentation (Ctrl + D)" position="bottom">
            <button
              type="button"
              className="welcome-top-btn"
              onClick={onOpenDocs}
              aria-label="Documentation (Ctrl + D)"
            >
              <Book size={13} className="welcome-top-btn-icon" />
              <span>Docs</span>
            </button>
          </ToolTip>
        )}
        {onOpenGuide && (
          <ToolTip text="Lumina Guide" position="bottom">
            <button
              type="button"
              className="welcome-top-btn"
              onClick={onOpenGuide}
              aria-label="Lumina Guide"
            >
              <Compass size={13} className="welcome-top-btn-icon" />
              <span>Guide</span>
            </button>
          </ToolTip>
        )}
      </div>

      <div className="welcome-watermark">
        <svg
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
          className="lumina-watermark-svg"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="neonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--text-accent, #40bafa)" stopOpacity="0.9" />
              <stop offset="100%" stopColor="var(--text-accent, #40bafa)" stopOpacity="0.3" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Abstract Network 'L' */}
          <path
            d="M 25 15 L 25 80 L 80 80"
            fill="none"
            stroke="url(#neonGradient)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow)"
            opacity="0.8"
          />

          {/* Sub-connections for graph effect */}
          <path
            d="M 25 45 L 50 30 M 25 80 L 15 65 M 50 80 L 70 50"
            fill="none"
            stroke="var(--text-accent, #40bafa)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="4 6"
            opacity="0.4"
          />

          {/* Nodes */}
          <circle cx="25" cy="15" r="5" fill="var(--text-accent, #40bafa)" filter="url(#glow)" />
          <circle cx="25" cy="45" r="3.5" fill="var(--text-accent, #40bafa)" filter="url(#glow)" />
          <circle cx="25" cy="80" r="6" fill="var(--text-accent, #40bafa)" filter="url(#glow)" />
          <circle cx="50" cy="80" r="4" fill="var(--text-accent, #40bafa)" filter="url(#glow)" />
          <circle cx="80" cy="80" r="5" fill="var(--text-accent, #40bafa)" filter="url(#glow)" />

          {/* Satellite nodes */}
          <circle cx="50" cy="30" r="2.5" fill="var(--text-accent, #40bafa)" opacity="0.6" />
          <circle cx="15" cy="65" r="2" fill="var(--text-accent, #40bafa)" opacity="0.6" />
          <circle cx="70" cy="50" r="2.5" fill="var(--text-accent, #40bafa)" opacity="0.6" />
        </svg>
      </div>

      {/* All content sits inside the watermark area, spread top to bottom */}
      <div className="welcome-inner-centered">
        {/* Title pushed toward top */}
        <div className="welcome-header-hero">
          <h1 className="hero-title">Lumina</h1>
          <p className="hero-subtitle">
            Your personal AI-powered workspace for ideas, research, and writing.
          </p>
        </div>

        {/* Buttons + hint pushed toward bottom */}
        <div className="welcome-bottom-group">
          <div className="welcome-actions-grid">
            <button type="button" className="welcome-action-card" onClick={onNew}>
              <div className="action-card-icon" style={{ color: 'var(--text-accent, #40bafa)' }}>
                <FileText size={12} />
              </div>
              <div className="action-card-content">
                <h3>Create a new note</h3>
                <p>Start writing instantly</p>
              </div>
              <div className="action-shortcut">Ctrl + N</div>
            </button>

            <button type="button" className="welcome-action-card" onClick={handlePalette}>
              <div className="action-card-icon" style={{ color: 'var(--text-accent, #40bafa)' }}>
                <Search size={12} />
              </div>
              <div className="action-card-content">
                <h3>Quick Search</h3>
                <p>Find any note or command</p>
              </div>
              <div className="action-shortcut">Ctrl + P</div>
            </button>

            <button
              type="button"
              className="welcome-action-card"
              onClick={() =>
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }))
              }
            >
              <div className="action-card-icon" style={{ color: 'var(--text-accent, #40bafa)' }}>
                <FolderTree size={12} />
              </div>
              <div className="action-card-content">
                <h3>Toggle Sidebar</h3>
                <p>Browse your workspace</p>
              </div>
              <div className="action-shortcut">Ctrl + B</div>
            </button>

            <button type="button" className="welcome-action-card" onClick={handleAIChat}>
              <div className="action-card-icon" style={{ color: 'var(--text-accent, #40bafa)' }}>
                <Sparkles size={12} />
              </div>
              <div className="action-card-content">
                <h3>Lumina AI Assistant</h3>
                <p>Chat with your knowledge</p>
              </div>
              <div className="action-shortcut">Ctrl+Shift+\</div>
            </button>
          </div>

          <div className="welcome-footer-hint">
            <Command size={13} />
            <span>
              Press <strong>Ctrl+P</strong> anywhere to open Quick Search
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Welcome
