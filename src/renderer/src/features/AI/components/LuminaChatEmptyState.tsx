import React from 'react'
import { Sparkles, Database, Network, FileEdit, Lightbulb, FileText } from 'lucide-react'

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
 * Empty state screen when a chat session has no messages yet.
 */
export const ChatEmptyState: React.FC<ChatEmptyStateProps> = React.memo(
  ({ selectedNote, selectedSnippet, onSendSuggestion, onSendPrompt }) => {
    const note = selectedNote || selectedSnippet

    return (
      <div className="chat-empty lumina-chat-empty-modern">
        <div className="chat-empty-hero">
          <h2 className="chat-empty-title">
            How can I assist your thinking today?
          </h2>
          <p className="chat-empty-subtitle">
            Ask questions about your workspace notes, query the index, audit links, or draft new ideas.
          </p>
        </div>

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

export default ChatEmptyState
