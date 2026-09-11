import React, { useState } from 'react'
import { Copy, Check, X, Sparkles, FileText } from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'

export const RightSidebarFooter = ({ selectedSnippet, rightSidebarTab, onClose }) => {
  const [copied, setCopied] = useState(false)

  const wordCount = selectedSnippet?.code
    ? selectedSnippet.code.trim().split(/\s+/).filter(Boolean).length
    : 0

  const handleCopy = (e) => {
    e.stopPropagation()
    if (!selectedSnippet?.code) return
    navigator.clipboard.writeText(selectedSnippet.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="inspector-footer-section">
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
        {rightSidebarTab === 'chat' ? (
          <>
            <Sparkles size={12} style={{ color: 'var(--text-accent)', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)' }}>
              Lumina AI
            </span>
          </>
        ) : selectedSnippet ? (
          <>
            <FileText size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {wordCount} {wordCount === 1 ? 'word' : 'words'}
            </span>
          </>
        ) : (
          <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)' }}>
            Inspector
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        {selectedSnippet?.code && rightSidebarTab !== 'chat' && (
          <ToolTip text={copied ? 'Copied!' : 'Copy Markdown'} position="top">
            <button
              className="inspector-footer-btn"
              onClick={handleCopy}
              aria-label="Copy Markdown"
              type="button"
            >
              {copied ? <Check size={12} color="var(--text-accent)" /> : <Copy size={12} />}
            </button>
          </ToolTip>
        )}

        {onClose && (
          <ToolTip text="Close Inspector" position="top">
            <button
              className="inspector-footer-btn"
              onClick={onClose}
              aria-label="Close Inspector"
              type="button"
            >
              <X size={12} />
            </button>
          </ToolTip>
        )}
      </div>
    </div>
  )
}

export default React.memo(RightSidebarFooter)
