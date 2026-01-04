import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, Clock, FileText, Copy, Download, FileCode } from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import './PreviewModal.css'

const PreviewModal = ({ isOpen, onClose, content, onNavigate, title: snippetTitle }) => {
  const [shadowRoot, setShadowRoot] = useState(null)

  // Calculate statistics
  const stats = useMemo(() => {
    if (!content) return { words: 0, time: 0 }
    // Strip HTML tags for word count
    const text = content.replace(/<[^>]*>/g, ' ')
    const words = text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length
    const time = Math.max(1, Math.ceil(words / 200)) // 200 wpm
    return { words, time }
  }, [content])

  // 1. Hooks MUST be at the top level
  useKeyboardShortcuts(
    isOpen
      ? {
          onEscape: onClose
        }
      : {}
  )

  const onHostRef = useCallback((node) => {
    if (node && !node.shadowRoot) {
      const root = node.attachShadow({ mode: 'open' })
      setShadowRoot(root)
    }
  }, [])

  useEffect(() => {
    if (!shadowRoot) return

    const handleClick = (e) => {
      const wikiLink = e.target.closest('.preview-wikilink')
      if (wikiLink && onNavigate) {
        const title = wikiLink.getAttribute('data-title')
        onNavigate(title)
        onClose()
      }
    }

    shadowRoot.addEventListener('click', handleClick)
    return () => shadowRoot.removeEventListener('click', handleClick)
  }, [shadowRoot, onNavigate, onClose])

  if (!isOpen) return null

  const handleCopyHTML = () => {
    navigator.clipboard.writeText(content)
  }

  return (
    <div className="modal-overlay preview-overlay-glass" onClick={onClose}>
      <div
        className="modal-container preview-container premium-preview-card"
        style={{ width: '92vw', height: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pane-header">
          <div className="preview-header-left">
            <div className="modal-title-stack preview-breadcrumb">
              <span className="preview-indicator-tag">MARKDOWN</span>
              <span className="preview-filename-text">{snippetTitle || 'Untitled'}</span>
            </div>
          </div>

          <div className="preview-header-center">
            <div className="preview-stats-bar">
              <div className="preview-stat-item">
                <FileText size={12} />
                <span>{stats.words} words</span>
              </div>
              <div className="preview-stat-sep" />
              <div className="preview-stat-item">
                <Clock size={12} />
                <span>{stats.time} min read</span>
              </div>
            </div>
          </div>

          <div className="preview-header-right">
            <div className="preview-actions-group">
              <button className="preview-action-btn" onClick={handleCopyHTML} title="Copy HTML">
                <Copy size={16} />
              </button>
            </div>
            <button className="modal-close" onClick={onClose} title="Close">
              <X size={18} />
            </button>
          </div>
        </header>

        <div
          className="preview-body seamless-scrollbar"
          ref={onHostRef}
          style={{ flex: 1, overflow: 'auto', background: 'var(--bg-app)' }}
        >
          {shadowRoot &&
            createPortal(
              <div className="preview-inner-canvas">
                <style>{previewStyles}</style>
                <article dangerouslySetInnerHTML={{ __html: content }} />
              </div>,
              shadowRoot
            )}
        </div>
      </div>
    </div>
  )
}

const previewStyles = `
  :host {
    display: block;
    font-family: var(--font-editor, 'Inter', -apple-system, sans-serif);
    line-height: 1.8;
    color: var(--text-main);
    -webkit-font-smoothing: antialiased;
  }
  .preview-inner-canvas {
    padding: 4rem 10% 8rem 10%;
    max-width: 900px;
    margin: 0 auto;
  }
  article {
    animation: contentFadeIn 0.5s ease-out;
  }
  @keyframes contentFadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  h1 { 
    font-size: 3em; 
    font-weight: 800; 
    margin-bottom: 0.8em; 
    letter-spacing: -0.02em;
    color: var(--text-main);
  }
  h2 { 
    font-size: 1.8em; 
    font-weight: 700; 
    margin-top: 2.5em; 
    margin-bottom: 1em;
    color: var(--text-main);
    opacity: 0.9;
  }
  h3 {
    font-size: 1.4em;
    font-weight: 600;
    margin-top: 2em;
    margin-bottom: 0.8em;
  }
  p { margin-bottom: 1.6em; font-size: 1.05rem; opacity: 0.9; }
  
  pre { 
    background: rgba(var(--text-accent-rgb), 0.03);
    padding: 2em; 
    border-radius: 12px; 
    border: 1px solid var(--border-subtle); 
    overflow-x: auto; 
    margin: 2em 0;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
  }
  code { 
    font-family: inherit; 
    background: rgba(var(--text-accent-rgb), 0.1); 
    padding: 0.2em 0.5em; 
    border-radius: 6px; 
    font-size: 0.9em; 
    color: var(--text-accent);
  }
  pre code {
    background: transparent;
    padding: 0;
    color: inherit;
  }

  blockquote {
    border-left: 4px solid var(--text-accent);
    background: rgba(var(--text-accent-rgb), 0.05);
    padding: 1.5em 2em;
    margin: 2em 0;
    border-radius: 0 8px 8px 0;
    font-style: italic;
    font-size: 1.1em;
    color: var(--text-muted);
  }

  ul, ol { margin-bottom: 2em; padding-left: 1.5em; }
  li { margin-bottom: 0.8em; }

  hr {
    border: none;
    height: 1px;
    background: var(--border-dim);
    margin: 4rem 0;
  }

  img {
    max-width: 100%;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    margin: 2em 0;
  }

  .preview-wikilink {
    color: var(--text-accent);
    text-decoration: none;
    cursor: pointer;
    font-weight: 600;
    border-bottom: 1px dashed rgba(var(--text-accent-rgb), 0.3);
    transition: all 0.2s;
  }
  .preview-wikilink:hover {
    border-bottom-style: solid;
    background: rgba(var(--text-accent-rgb), 0.05);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 2em 0;
    font-size: 0.95em;
  }
  th {
    text-align: left;
    padding: 12px;
    background: rgba(var(--text-accent-rgb), 0.05);
    border-bottom: 2px solid var(--border-dim);
  }
  td {
    padding: 12px;
    border-bottom: 1px solid var(--border-dim);
  }
`

export default PreviewModal
