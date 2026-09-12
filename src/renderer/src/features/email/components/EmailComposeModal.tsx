import React, { useState } from 'react'
import { X, Send, Paperclip, FileText, Loader2, Trash2 } from 'lucide-react'
import { useWorkspaceStore } from '../../../core/store/workspaceStore'
import { EmailComposeDraft, EmailAttachment } from '../types'

interface EmailComposeModalProps {
  isOpen: boolean
  onClose: () => void
  draft: EmailComposeDraft
  setDraft: React.Dispatch<React.SetStateAction<EmailComposeDraft>>
  onSend: () => void
  onAddAttachments: () => void
  onAttachNote: (title: string, content: string) => void
  onRemoveAttachment: (index: number) => void
  isSending: boolean
}

export const EmailComposeModal: React.FC<EmailComposeModalProps> = ({
  isOpen,
  onClose,
  draft,
  setDraft,
  onSend,
  onAddAttachments,
  onAttachNote,
  onRemoveAttachment,
  isSending
}) => {
  const [showCcBcc, setShowCcBcc] = useState<boolean>(false)
  const selectedSnippet = useWorkspaceStore((s) => s.selectedSnippet)

  if (!isOpen) return null

  const handleAttachCurrentNote = () => {
    if (selectedSnippet) {
      onAttachNote(selectedSnippet.title || 'Note', selectedSnippet.code || '')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="email-compose-overlay" onClick={onClose}>
      <div className="email-compose-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="email-compose-header">
          <span>New Message</span>
          <button
            type="button"
            className="email-header-btn"
            onClick={onClose}
            aria-label="Close compose"
          >
            <X size={15} />
          </button>
        </div>

        {/* Fields */}
        <div className="email-compose-fields">
          <div className="email-field-row">
            <span className="email-field-label">To</span>
            <input
              type="text"
              className="email-field-input"
              placeholder="recipients@example.com (comma separated)"
              value={draft.to}
              onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
              autoFocus
            />
            {!showCcBcc && (
              <button
                type="button"
                className="email-tool-btn"
                style={{ padding: '1px 6px', fontSize: '10px' }}
                onClick={() => setShowCcBcc(true)}
              >
                Cc / Bcc
              </button>
            )}
          </div>

          {showCcBcc && (
            <>
              <div className="email-field-row">
                <span className="email-field-label">Cc</span>
                <input
                  type="text"
                  className="email-field-input"
                  placeholder="cc@example.com"
                  value={draft.cc}
                  onChange={(e) => setDraft((d) => ({ ...d, cc: e.target.value }))}
                />
              </div>
              <div className="email-field-row">
                <span className="email-field-label">Bcc</span>
                <input
                  type="text"
                  className="email-field-input"
                  placeholder="bcc@example.com"
                  value={draft.bcc}
                  onChange={(e) => setDraft((d) => ({ ...d, bcc: e.target.value }))}
                />
              </div>
            </>
          )}

          <div className="email-field-row">
            <span className="email-field-label">Subject</span>
            <input
              type="text"
              className="email-field-input"
              placeholder="Subject"
              value={draft.subject}
              onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
            />
          </div>
        </div>

        {/* Text Area */}
        <textarea
          className="email-compose-textarea"
          placeholder="Write your email here... (Press Ctrl+Enter or ⌘+Enter to send)"
          value={draft.bodyHtml}
          onChange={(e) => setDraft((d) => ({ ...d, bodyHtml: e.target.value }))}
          onKeyDown={(e) => {
            // Tab key support for natural writing
            if (e.key === 'Tab') {
              e.preventDefault()
              const target = e.currentTarget
              const start = target.selectionStart
              const end = target.selectionEnd
              const val = target.value
              setDraft((d) => ({
                ...d,
                bodyHtml: val.substring(0, start) + '  ' + val.substring(end)
              }))
              setTimeout(() => {
                target.selectionStart = target.selectionEnd = start + 2
              }, 0)
            }
            // Ctrl+Enter or Cmd+Enter to send instantly (Gmail style)
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault()
              if (!isSending && draft.to.trim()) {
                onSend()
              }
            }
          }}
          spellCheck
        />

        {/* Dimmed & Disabled Quoted Previous Email Container */}
        {draft.quotedText && (
          <div className="email-quoted-history-box">
            <div className="email-quoted-history-header">
              <span>Previous Message History</span>
              <button
                type="button"
                className="email-quoted-remove-btn"
                onClick={() => setDraft((d) => ({ ...d, quotedText: undefined }))}
                title="Remove quoted history from this reply"
              >
                <X size={12} />
                <span>Remove Quote</span>
              </button>
            </div>
            <div className="email-quoted-history-body">
              {draft.quotedText}
            </div>
          </div>
        )}

        {/* Attachments preview list */}
        {draft.attachments.length > 0 && (
          <div className="email-compose-attachments-list">
            {draft.attachments.map((att, idx) => (
              <div key={idx} className="email-attachment-pill">
                <Paperclip size={11} style={{ color: 'var(--text-accent)' }} />
                <span>{att.filename}</span>
                <span style={{ opacity: 0.6, fontSize: '9px' }}>({formatFileSize(att.size)})</span>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(idx)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-faint)',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Footer Actions */}
        <div className="email-compose-footer">
          <div className="email-compose-actions">
            <button
              type="button"
              className="email-tool-btn"
              onClick={onAddAttachments}
            >
              <Paperclip size={13} />
              <span>Attach Files</span>
            </button>

            {selectedSnippet && (
              <button
                type="button"
                className="email-tool-btn"
                onClick={handleAttachCurrentNote}
                title={`Attach current note "${selectedSnippet.title}" as .md`}
              >
                <FileText size={13} style={{ color: 'var(--text-accent)' }} />
                <span>Attach Note ({selectedSnippet.title || 'Untitled'})</span>
              </button>
            )}
          </div>

          <button
            type="button"
            className="email-send-submit-btn"
            onClick={onSend}
            disabled={isSending || !draft.to.trim()}
          >
            {isSending ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Send size={13} />
                <span>Send</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
