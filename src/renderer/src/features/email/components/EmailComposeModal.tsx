import React, { useState, useRef } from 'react'
import { X, Send, Paperclip, FileText, Loader2, Bold, Italic, Code, Link2, Eye, Edit3 } from 'lucide-react'
import { useWorkspaceStore } from '../../../core/store/workspaceStore'
import { EmailComposeDraft, EmailAttachment } from '../types'
import ToolTip from '../../../components/atoms/ToolTip'
import { insertMarkdownSyntax, renderEmailBody } from '../services/emailMarkdownService'

/**
 * Props for the EmailComposeModal component
 */
export interface EmailComposeModalProps {
  /** Whether the composer is open */
  isOpen: boolean
  /** Callback to close or dismiss the composer */
  onClose: () => void
  /** Active draft state (to, cc, bcc, subject, bodyHtml, attachments) */
  draft: EmailComposeDraft
  /** State setter for active draft */
  setDraft: React.Dispatch<React.SetStateAction<EmailComposeDraft>>
  /** Action to submit and send the current draft via Gmail API */
  onSend: () => void
  /** Action to trigger native OS file picker for attachments */
  onAddAttachments: () => void
  /** Action to inject active workspace note content as an attachment or markdown snippet */
  onAttachNote: (title: string, content: string) => void
  /** Action to remove a specific attachment by index */
  onRemoveAttachment: (index: number) => void
  /** Whether sending is in progress */
  isSending: boolean
}

/**
 * EmailComposeModal Component
 * 
 * Container-scoped email draft composer.
 * Non-blocking to the rest of Lumina: rendered inside EmailContainer's relative content
 * boundary, allowing the user to simultaneously view notes, AI chat, or knowledge graph
 * without whole-screen modality lockouts.
 */
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
  const [isPreview, setIsPreview] = useState<boolean>(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const selectedSnippet = useWorkspaceStore((s) => s.selectedSnippet)

  if (!isOpen) return null

  const handleAttachCurrentNote = () => {
    if (selectedSnippet) {
      onAttachNote(selectedSnippet.title || 'Note', selectedSnippet.code || '')
    }
  }

  const handleApplyMarkdown = (syntaxType: 'bold' | 'italic' | 'code' | 'link') => {
    if (isPreview) setIsPreview(false)
    insertMarkdownSyntax(textareaRef.current, syntaxType, (newVal) => {
      setDraft((d) => ({ ...d, bodyHtml: newVal }))
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="email-compose-overlay" onClick={onClose}>
      <div className="email-compose-card" onClick={(e) => e.stopPropagation()}>
        {/* Header (Exact 34px aligned with other headers) */}
        <div className="email-compose-header">
          <span className="email-compose-title">New Message</span>
          <ToolTip text="Close draft" position="bottom">
            <button
              type="button"
              className="email-pane-toggle-btn"
              onClick={onClose}
              aria-label="Close compose"
            >
              <X size={13} />
            </button>
          </ToolTip>
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

        {/* Compose Body Area: Textarea or Formatted Preview */}
        {isPreview ? (
          <div
            className="email-compose-preview email-detail-body"
            dangerouslySetInnerHTML={{ __html: renderEmailBody(draft.bodyHtml) }}
          />
        ) : (
          <textarea
            ref={textareaRef}
            className="email-compose-textarea"
            placeholder="Write in Markdown... (e.g. **bold**, *italic*, `code`, [link](url)) - Press Ctrl+Enter to send"
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
        )}

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

        {/* Footer Actions (Compact 36px bar matching container footer) */}
        <div className="email-compose-footer">
          <div className="email-compose-actions">
            {/* Markdown quick formatters */}
            <div className="email-markdown-toolbar">
              <ToolTip text="Bold (**text**)" position="top">
                <button
                  type="button"
                  className="email-composer-icon-btn"
                  onClick={() => handleApplyMarkdown('bold')}
                  aria-label="Bold"
                >
                  <Bold size={11} />
                </button>
              </ToolTip>

              <ToolTip text="Italic (*text*)" position="top">
                <button
                  type="button"
                  className="email-composer-icon-btn"
                  onClick={() => handleApplyMarkdown('italic')}
                  aria-label="Italic"
                >
                  <Italic size={11} />
                </button>
              </ToolTip>

              <ToolTip text="Inline code (`code`)" position="top">
                <button
                  type="button"
                  className="email-composer-icon-btn"
                  onClick={() => handleApplyMarkdown('code')}
                  aria-label="Code"
                >
                  <Code size={11} />
                </button>
              </ToolTip>

              <ToolTip text="Link ([text](url))" position="top">
                <button
                  type="button"
                  className="email-composer-icon-btn"
                  onClick={() => handleApplyMarkdown('link')}
                  aria-label="Link"
                >
                  <Link2 size={11} />
                </button>
              </ToolTip>

              <div className="email-toolbar-separator" />

              <ToolTip text={isPreview ? "Back to Editor" : "Preview Markdown"} position="top">
                <button
                  type="button"
                  className={`email-tool-btn ${isPreview ? 'active' : ''}`}
                  onClick={() => setIsPreview(!isPreview)}
                  aria-label="Toggle Markdown Preview"
                >
                  {isPreview ? <Edit3 size={11} /> : <Eye size={11} />}
                  <span>{isPreview ? 'Edit' : 'Preview'}</span>
                </button>
              </ToolTip>
            </div>

            <div className="email-toolbar-separator" />

            <ToolTip text="Attach local files" position="top">
              <button
                type="button"
                className="email-tool-btn"
                onClick={onAddAttachments}
                aria-label="Attach Files"
              >
                <Paperclip size={11} />
                <span>Files</span>
              </button>
            </ToolTip>

            {selectedSnippet && (
              <ToolTip text={`Attach note "${selectedSnippet.title || 'Untitled'}" as .md`} position="top">
                <button
                  type="button"
                  className="email-tool-btn"
                  onClick={handleAttachCurrentNote}
                  aria-label="Attach Note"
                >
                  <FileText size={11} style={{ color: 'var(--text-accent)' }} />
                  <span>Note</span>
                </button>
              </ToolTip>
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
                <Loader2 size={12} className="animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Send size={12} />
                <span>Send</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
