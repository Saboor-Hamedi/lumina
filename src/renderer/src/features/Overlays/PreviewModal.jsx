import React, { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import './PreviewModal.css'

const PreviewModal = ({ isOpen, onClose, content }) => {
  const [shadowRoot, setShadowRoot] = useState(null)

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

  // 2. Early return AFTER hooks
  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container preview-container"
        style={{ width: '90vw', height: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pane-header">
          <div style={{ fontSize: '12px', fontWeight: 700, opacity: 0.6 }}>LIVE PREVIEW</div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div
          className="preview-body"
          ref={onHostRef}
          style={{ flex: 1, overflow: 'auto', background: 'var(--bg-app)' }}
        >
          {shadowRoot &&
            createPortal(
              <div className="preview-inner">
                <style>{previewStyles}</style>
                <div dangerouslySetInnerHTML={{ __html: content }} />
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
    font-family: 'Inter', -apple-system, sans-serif;
    line-height: 1.8;
    color: var(--text-main);
  }
  .preview-inner {
    padding: 3rem 4rem;
    max-width: 800px;
    margin: 0 auto;
  }
  h1 { font-size: 2.5em; font-weight: 800; border-bottom: 2px solid var(--border-dim); padding-bottom: 0.5em; margin-bottom: 1em; }
  h2 { font-size: 1.8em; font-weight: 700; border-bottom: 1px solid var(--border-dim); padding-bottom: 0.3em; margin-top: 2em; margin-bottom: 1em; }
  pre { background: var(--bg-panel); padding: 1.5em; border-radius: 8px; border: 1px solid var(--border-dim); overflow-x: auto; margin: 1.5em 0; }
  code { font-family: 'JetBrains Mono', monospace; background: var(--bg-active); padding: 0.2em 0.4em; border-radius: 4px; font-size: 0.9em; }
  p { margin-bottom: 1.5em; }
`

export default PreviewModal
