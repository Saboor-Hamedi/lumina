import React from 'react'
import { Mail, Reply, Star, Trash2, Paperclip, Loader2 } from 'lucide-react'
import { EmailMessageDetails } from '../types'

export interface EmailDetailPaneProps {
  activeEmailDetails: EmailMessageDetails | null
  isLoadingDetails: boolean
  onReply: (email: EmailMessageDetails) => void
  onToggleStar: (email: EmailMessageDetails, e: React.MouseEvent) => void
  onToggleUnread: (email: EmailMessageDetails, e: React.MouseEvent) => void
  onDeleteEmail: (id: string, e: React.MouseEvent) => void
}

export const EmailDetailPane: React.FC<EmailDetailPaneProps> = ({
  activeEmailDetails,
  isLoadingDetails,
  onReply,
  onToggleStar,
  onToggleUnread,
  onDeleteEmail
}) => {
  return (
    <main className="email-detail-pane" aria-label="Email details reader">
      {isLoadingDetails ? (
        <div className="email-empty-state">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-accent, #40bafa)' }} />
          <span style={{ fontSize: '12px' }}>Loading email content...</span>
        </div>
      ) : activeEmailDetails ? (
        <>
          <div className="email-detail-header">
            {/* Top Row: Subject on left, Actions on right */}
            <div className="email-detail-top-row">
              <h2 className="email-detail-subject" title={activeEmailDetails.subject}>
                {activeEmailDetails.subject || '(No Subject)'}
              </h2>

              <div className="email-detail-actions">
                <button
                  type="button"
                  className="email-action-reply-btn"
                  onClick={() => onReply(activeEmailDetails)}
                  title="Reply to sender"
                >
                  <Reply size={13} />
                  <span>Reply</span>
                </button>

                <button
                  type="button"
                  className={`email-action-icon-btn ${activeEmailDetails.isStarred ? 'starred' : ''}`}
                  onClick={(e) => onToggleStar(activeEmailDetails, e)}
                  title={activeEmailDetails.isStarred ? 'Unstar' : 'Star'}
                >
                  <Star size={14} fill={activeEmailDetails.isStarred ? '#f59e0b' : 'none'} />
                </button>

                <button
                  type="button"
                  className="email-action-icon-btn"
                  onClick={(e) => onToggleUnread(activeEmailDetails, e)}
                  title="Mark as unread"
                >
                  <Mail size={14} />
                </button>

                <button
                  type="button"
                  className="email-action-icon-btn delete"
                  onClick={(e) => onDeleteEmail(activeEmailDetails.id, e)}
                  title="Delete email"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Second Row: Sender avatar & recipient metadata */}
            <div className="email-detail-sender-row">
              <div className="email-sender-avatar">
                {activeEmailDetails.from ? activeEmailDetails.from.charAt(0).toUpperCase() : 'M'}
              </div>
              <div className="email-sender-meta-col">
                <div className="email-sender-name" title={activeEmailDetails.from}>
                  {activeEmailDetails.from}
                </div>
                <div className="email-recipient-line">
                  <span>To: {activeEmailDetails.to || 'me'}</span>
                  {activeEmailDetails.date && (
                    <span className="email-detail-date"> • {activeEmailDetails.date}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Attachments bar */}
          {activeEmailDetails.attachments && activeEmailDetails.attachments.length > 0 && (
            <div className="email-attachments-bar">
              {activeEmailDetails.attachments.map((att, i) => (
                <div key={i} className="email-attachment-pill">
                  <Paperclip size={12} style={{ color: 'var(--text-accent, #40bafa)' }} />
                  <span>{att.filename}</span>
                  <span style={{ opacity: 0.6, fontSize: '9.5px' }}>
                    ({(att.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Rich HTML body */}
          <div
            className="email-detail-body"
            dangerouslySetInnerHTML={{ __html: activeEmailDetails.bodyHtml }}
          />
        </>
      ) : (
        <div className="email-empty-state">
          <Mail size={40} className="email-empty-state-icon" />
          <span>Select an email from the list to read</span>
        </div>
      )}
    </main>
  )
}
