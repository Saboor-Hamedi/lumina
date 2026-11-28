import React from 'react'
import { Database, Network, FileEdit, Lightbulb, FileText, Plus, Search, FolderOpen, Mic } from 'lucide-react'

export interface ChatEmptyStateProps {
  selectedNote?: any
  selectedSnippet?: any
  onSendSuggestion?: (note: any) => void
  onSendPrompt?: (prompt: string) => void
}

const STARTER_PROMPTS = [
  {
    icon: <Database size={13} style={{ color: 'var(--text-accent, #38bdf8)' }} />,
    title: 'Query Index',
    desc: 'List tags (#tag) and workspace structure',
    prompt: 'Query the workspace index: list all tags and active folders'
  },
  {
    icon: <Network size={13} style={{ color: '#a855f7' }} />,
    title: 'Audit Wikilinks',
    desc: 'Scan for missing references & dead links',
    prompt: 'Audit wikilinks in my notes and report any missing targets'
  },
  {
    icon: <FileEdit size={13} style={{ color: '#22c55e' }} />,
    title: 'Draft Note Outline',
    desc: 'Create structured headings & ideas',
    prompt: 'Help me draft a structured outline for a new project note'
  },
  {
    icon: <Lightbulb size={13} style={{ color: '#eab308' }} />,
    title: 'Brainstorm Connections',
    desc: 'Synthesize insights from your notes',
    prompt: 'Synthesize key ideas and suggest new connections across my notes'
  }
]

/**
 * Centered H1 greeting displayed directly above the composer on empty welcome state.
 */
export const ChatEmptyHero: React.FC = React.memo(() => (
  <div className="chat-empty-hero chat-welcome-h1-hero">
    <h1 className="chat-welcome-h1">Welcome, how can I help you?</h1>
  </div>
))
ChatEmptyHero.displayName = 'ChatEmptyHero'

/**
 * Quiet, clickable keyboard-shortcut strip displayed directly beneath the centered Composer.
 */
export const ChatWelcomeShortcuts: React.FC = React.memo(() => {
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent)
  const mod = isMac ? '⌘' : 'Ctrl+'
  const alt = isMac ? '⌥' : 'Alt+'

  const shortcuts = [
    {
      icon: <Plus size={12} />,
      label: 'New Note',
      keys: `${mod}N`,
      onClick: () => window.dispatchEvent(new CustomEvent('trigger-new-note'))
    },
    {
      icon: <Search size={12} />,
      label: 'Quick Open',
      keys: `${mod}P`,
      onClick: () => window.dispatchEvent(new CustomEvent('lumina-palette-shortcut', { detail: { mode: 'files' } }))
    },
    {
      icon: <FolderOpen size={12} />,
      label: 'Switch Workspace',
      keys: `${mod}${alt}W`,
      onClick: () => window.dispatchEvent(new CustomEvent('toggle-workspace-switcher'))
    },
    {
      icon: <Mic size={12} />,
      label: 'Voice',
      keys: isMac ? '⇧⌥V' : 'Shift+Alt+V',
      onClick: () =>
        window.dispatchEvent(new CustomEvent('toggle-voice-dictation', { detail: { target: 'composer-voice' } }))
    }
  ]

  return (
    <div className="chat-welcome-shortcuts" role="navigation" aria-label="Quick shortcuts">
      {shortcuts.map((item) => (
        <button
          key={item.label}
          type="button"
          className="chat-welcome-shortcut-pill"
          onClick={item.onClick}
        >
          {item.icon}
          <span>{item.label}</span>
          <kbd>{item.keys}</kbd>
        </button>
      ))}
    </div>
  )
})
ChatWelcomeShortcuts.displayName = 'ChatWelcomeShortcuts'

/**
 * Contextual active-note action and starter prompt cards displayed below the centered composer.
 */
export const ChatEmptySuggestions: React.FC<ChatEmptyStateProps> = React.memo(
  ({ selectedNote, selectedSnippet, onSendSuggestion, onSendPrompt }) => {
    const note = selectedNote || selectedSnippet

    return (
      <div className="chat-welcome-suggestions-inner">
        {note && onSendSuggestion && (
          <div className="chat-empty-active-note">
            <button
              type="button"
              className="chat-suggestion-btn active-note-btn"
              onClick={() => onSendSuggestion(note)}
            >
              <FileText size={12} />
              <span>Explain code & ideas in "{note.title || 'current note'}"</span>
            </button>
          </div>
        )}

        <div className="chat-empty-grid">
          {STARTER_PROMPTS.map((item, idx) => (
            <button
              key={idx}
              type="button"
              className="chat-empty-card"
              onClick={() => onSendPrompt?.(item.prompt)}
            >
              <div className="chat-empty-card-top">
                <span className="chat-empty-card-icon">{item.icon}</span>
                <span className="chat-empty-card-title">{item.title}</span>
              </div>
              <p className="chat-empty-card-desc">{item.desc}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }
)
ChatEmptySuggestions.displayName = 'ChatEmptySuggestions'

/**
 * Compact empty state screen used when Lumina Chat is docked in the narrow sidebar.
 */
export const ChatEmptyState: React.FC<ChatEmptyStateProps> = React.memo(
  ({ selectedNote, selectedSnippet, onSendSuggestion, onSendPrompt }) => {
    return (
      <div className="chat-empty lumina-chat-empty-modern">
        <div className="chat-empty-hero">
          <h1 className="chat-empty-title">
            Welcome, how can I help you?
          </h1>
          <p className="chat-empty-subtitle">
            Ask questions about your workspace notes, query the index, audit links, or draft new ideas.
          </p>
        </div>

        <ChatEmptySuggestions
          selectedNote={selectedNote}
          selectedSnippet={selectedSnippet}
          onSendSuggestion={onSendSuggestion}
          onSendPrompt={onSendPrompt}
        />
      </div>
    )
  }
)

export default ChatEmptyState
