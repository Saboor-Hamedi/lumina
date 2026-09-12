import React from 'react'
import { Mail, Reply, Star, Trash2, Paperclip, Loader2, PanelRightClose, ArrowLeft } from 'lucide-react'
import { EmailMessageDetails } from '../types'
import ToolTip from '../../../components/atoms/ToolTip'
import { renderEmailBody } from '../services/emailMarkdownService'

/**
 * Props for the EmailDetailPane component
 */
export interface EmailDetailPaneProps {
  /** Full details of the currently selected email */
  activeEmailDetails: EmailMessageDetails | null
  /** Whether details are currently loading */
  isLoadingDetails: boolean
  /** Action to reply to sender with quoting and threading */
  onReply: (email: EmailMessageDetails) => void
  /** Action to toggle starred state */
  onToggleStar: (email: EmailMessageDetails, e: React.MouseEvent) => void
  /** Action to toggle read/unread state */
  onToggleUnread: (email: EmailMessageDetails, e: React.MouseEvent) => void
  /** Action to delete active message */
  onDeleteEmail: (id: string, e: React.MouseEvent) => void
  /** Whether the detail pane is open / visible */
  isOpen?: boolean
  /** Callback to close or collapse the detail reading pane */
  onCloseDetail?: () => void
  /** Whether container is in compact single-column mode */
  isCompact?: boolean
  /** Whether the detail pane width is constrained/narrow */
  isNarrow?: boolean
}

/**
 * EmailDetailPane Component
 * 
 * Right reading pane modeled after Lumina's RightSidebar.
 * Features a 34px seamless top header aligned with the sidebar and search bar.
 */
export const EmailDetailPane: React.FC<EmailDetailPaneProps> = ({
  activeEmailDetails,
  isLoadingDetails,
  onReply,
  onToggleStar,
  onToggleUnread,
  onDeleteEmail,
  isOpen = true,
  onCloseDetail,
  isCompact = false,
  isNarrow = false
}) => {
  const [bodyZoom, setBodyZoom] = React.useState(0.9)
  const bodyRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const body = bodyRef.current
    if (!body) return

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      setBodyZoom((current) => Math.min(1.2, Math.max(0.75, current - event.deltaY * 0.002)))
    }

    body.addEventListener('wheel', handleWheel, { passive: false })
    return () => body.removeEventListener('wheel', handleWheel)
  }, [])

  if (!isOpen) return null

  // Safely format email body with markdown and link support
  const renderedHtml = React.useMemo(() => {
    return renderEmailBody(activeEmailDetails?.bodyHtml)
  }, [activeEmailDetails?.bodyHtml])

  // Open clicked email links in user's external system browser
  const handleBodyClick = (e: React.MouseEvent) => {
    const anchor = (e.target as HTMLElement).closest('a')
    if (anchor && anchor.href) {
      e.preventDefault()
      e.stopPropagation()
      if (window.api?.openExternal) {
        window.api.openExternal(anchor.href)
      } else {
        window.open(anchor.href, '_blank', 'noopener,noreferrer')
      }
    }
  }

  return (
    <main className={`email-detail-pane ${isNarrow ? 'narrow' : ''}`} aria-label="Email details reader">
      {/* 1. Seamless Top Bar with permanently anchored controls */}
      <div className="email-detail-top-bar">
        <div className="email-detail-top-left">
          {isCompact && onCloseDetail && (
            <ToolTip text="Back to list" position="bottom">
              <button
                type="button"
                className="email-pane-toggle-btn"
                onClick={onCloseDetail}
                aria-label="Back to email list"
              >
                <ArrowLeft size={13} />
              </button>
            </ToolTip>
          )}

          <h2 className="email-detail-subject" title={activeEmailDetails?.subject || 'Email Reader'}>
            {activeEmailDetails ? activeEmailDetails.subject || '(No Subject)' : 'Email Reader'}
          </h2>
        </div>

        <div className="email-detail-top-right">
          {activeEmailDetails && (
            <div className="email-detail-actions">
              <ToolTip text="Reply to sender" position="bottom">
                <button
                  type="button"
                  className="email-action-reply-btn"
                  onClick={() => onReply(activeEmailDetails)}
                  aria-label="Reply to sender"
                >
                  <Reply size={12} />
                  <span className="email-action-reply-text">Reply</span>
                </button>
              </ToolTip>

              <ToolTip text={activeEmailDetails.isStarred ? 'Unstar' : 'Star'} position="bottom">
                <button
                  type="button"
                  className={`email-action-icon-btn ${activeEmailDetails.isStarred ? 'starred' : ''}`}
                  onClick={(e) => onToggleStar(activeEmailDetails, e)}
                  aria-label={activeEmailDetails.isStarred ? 'Unstar' : 'Star'}
                >
                  <Star size={13} fill={activeEmailDetails.isStarred ? '#f59e0b' : 'none'} />
                </button>
              </ToolTip>

              <ToolTip text="Mark as unread" position="bottom">
                <button
                  type="button"
                  className="email-action-icon-btn"
                  onClick={(e) => onToggleUnread(activeEmailDetails, e)}
                  aria-label="Mark as unread"
                >
                  <Mail size={13} />
                </button>
              </ToolTip>

              <ToolTip text="Delete email" position="bottom">
                <button
                  type="button"
                  className="email-action-icon-btn delete"
                  onClick={(e) => onDeleteEmail(activeEmailDetails.id, e)}
                  aria-label="Delete email"
                >
                  <Trash2 size={13} />
                </button>
              </ToolTip>
            </div>
          )}

          {/* Solid collapse button permanently positioned at top-right, matching sidebar toggle */}
          {onCloseDetail && !isCompact && (
            <ToolTip text="Collapse Reader" position="bottom">
              <button
                type="button"
                className="email-pane-toggle-btn email-collapse-reader-btn"
                onClick={onCloseDetail}
                aria-label="Collapse reading pane"
              >
                <PanelRightClose size={13} />
              </button>
            </ToolTip>
          )}
        </div>
      </div>

      {/* 2. Scrollable Body Content */}
      <div className="email-detail-scrollable">
        {isLoadingDetails ? (
          <div className="email-empty-state">
            <Loader2 size={22} className="animate-spin" style={{ color: 'var(--text-accent, #40bafa)' }} />
            <span style={{ fontSize: '11px' }}>Loading email content...</span>
          </div>
        ) : activeEmailDetails ? (
          <>
            {/* Sender and recipient metadata */}
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

            {/* Attachments bar */}
            {activeEmailDetails.attachments && activeEmailDetails.attachments.length > 0 && (
              <div className="email-attachments-bar">
                {activeEmailDetails.attachments.map((att, i) => (
                  <div key={i} className="email-attachment-pill">
                    <Paperclip size={11} style={{ color: 'var(--text-accent, #40bafa)' }} />
                    <span>{att.filename}</span>
                    <span style={{ opacity: 0.6, fontSize: '9px' }}>
                      ({(att.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Rich formatted HTML / Markdown body */}
            <div
              className="email-detail-body"
              ref={bodyRef}
              onClick={handleBodyClick}
              style={{ zoom: bodyZoom }}
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          </>
        ) : (
          <div className="email-empty-state">
            <Mail size={36} className="email-empty-state-icon" />
            <span style={{ fontSize: '11px' }}>Select an email from the list to read</span>
          </div>
        )}
      </div>
    </main>
  )
}

export default EmailDetailPane
