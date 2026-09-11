import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Mail,
  Inbox,
  Send,
  FileText,
  Star,
  Trash2,
  AlertOctagon,
  RefreshCw,
  Search,
  Maximize2,
  Minimize2,
  X,
  Plus,
  Loader2,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  MailCheck,
  MailQuestion,
  ShieldAlert,
  Sparkles
} from 'lucide-react'
import { useEmailClient } from '../hooks/useEmailClient'
import { EmailComposeModal } from './EmailComposeModal'
import { EmailFolder } from '../types'
import ToolTip from '../../../components/atoms/ToolTip'
import '../css/emailModal.css'

export interface EmailModalProps {
  isOpen: boolean
  onClose: () => void
}

export const EmailModal: React.FC<EmailModalProps> = ({ isOpen, onClose }) => {
  const [isMaximized, setIsMaximized] = useState<boolean>(() => {
    try {
      return localStorage.getItem('lumina_email_modal_maximized') === 'true'
    } catch {
      return false
    }
  })

  // Resizable list pane width (default 320px, min 220px, max 520px)
  const [listWidth, setListWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('lumina_email_list_width')
      return saved ? parseInt(saved, 10) : 320
    } catch {
      return 320
    }
  })
  const [isResizing, setIsResizing] = useState<boolean>(false)
  const isResizingRef = useRef(false)

  const {
    googleUser,
    isLoggedIn,
    currentFolder,
    setCurrentFolder,
    searchQuery,
    setSearchQuery,
    emails,
    selectedEmailId,
    setSelectedEmailId,
    activeEmailDetails,
    isLoadingList,
    isLoadingDetails,
    isSending,
    isComposeOpen,
    setIsComposeOpen,
    errorMessage,
    setErrorMessage,
    successToast,
    draft,
    setDraft,
    fetchEmails,
    toggleStar,
    toggleUnread,
    deleteEmail,
    sendCurrentDraft,
    addAttachments,
    attachNote,
    removeAttachment
  } = useEmailClient()

  // ESC to close
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isComposeOpen) {
          setIsComposeOpen(false)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isComposeOpen, onClose, setIsComposeOpen])

  // Drag resizer handlers
  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    isResizingRef.current = true
    const startX = e.clientX
    const startWidth = listWidth

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return
      const deltaX = moveEvent.clientX - startX
      const newWidth = Math.min(Math.max(startWidth + deltaX, 220), 550)
      setListWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      isResizingRef.current = false
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      try {
        localStorage.setItem('lumina_email_list_width', String(listWidth))
      } catch {}
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const toggleMaximize = () => {
    setIsMaximized((prev) => {
      const next = !prev
      try {
        localStorage.setItem('lumina_email_modal_maximized', String(next))
      } catch {}
      return next
    })
  }

  const handleConnectGoogle = async () => {
    if (window.api?.loginWithGoogle) {
      await window.api.loginWithGoogle('281781295982-h21s7e9154f2kgn5e6b72a4m86bov60h.apps.googleusercontent.com')
      fetchEmails(currentFolder)
    }
  }

  if (!isOpen) return null

  // Check if error is related to missing Gmail scopes or 403
  const isScopeError =
    errorMessage &&
    (errorMessage.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT') ||
      errorMessage.includes('insufficient_scope') ||
      errorMessage.includes('403') ||
      errorMessage.includes('Not logged in') ||
      errorMessage.includes('401'))

  const folders: { id: EmailFolder; label: string; icon: React.FC<any> }[] = [
    { id: 'INBOX', label: 'Inbox', icon: Inbox },
    { id: 'STARRED', label: 'Starred', icon: Star },
    { id: 'SENT', label: 'Sent', icon: Send },
    { id: 'DRAFT', label: 'Drafts', icon: FileText },
    { id: 'SPAM', label: 'Spam', icon: AlertOctagon },
    { id: 'TRASH', label: 'Trash', icon: Trash2 }
  ]

  return createPortal(
    <div className="email-modal-overlay" onClick={onClose}>
      <div
        className={`email-modal-container ${isMaximized ? 'maximized' : ''} ${isResizing ? 'resizing' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="email-modal-header">
          <div className="email-header-left">
            <span className="email-header-icon">
              <Mail size={16} />
            </span>
            <span className="email-header-title">Lumina Mail</span>
            {googleUser && (
              <span className="email-header-user-badge" title={googleUser.email || googleUser.name}>
                {googleUser.email || googleUser.name}
              </span>
            )}
          </div>

          <div className="email-header-controls">
            <ToolTip text="Refresh Folder" position="bottom">
              <button
                type="button"
                className="email-header-btn"
                onClick={() => fetchEmails(currentFolder, searchQuery)}
                disabled={isLoadingList}
                aria-label="Refresh emails"
              >
                <RefreshCw size={13} className={isLoadingList ? 'animate-spin' : ''} />
              </button>
            </ToolTip>

            <ToolTip text={isMaximized ? 'Restore' : 'Maximize'} position="bottom">
              <button
                type="button"
                className="email-header-btn"
                onClick={toggleMaximize}
                aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
              >
                {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
            </ToolTip>

            <ToolTip text="Close (Esc)" position="bottom">
              <button
                type="button"
                className="email-header-btn danger"
                onClick={onClose}
                aria-label="Close email modal"
              >
                <X size={15} />
              </button>
            </ToolTip>
          </div>
        </div>

        {/* Modal Body */}
        <div className="email-modal-body">
          {!isLoggedIn ? (
            <div className="email-empty-state">
              <MailQuestion size={44} className="email-empty-state-icon" />
              <h3>Connect Your Google Account</h3>
              <p style={{ maxWidth: '380px', fontSize: '12px' }}>
                Log in with your Google Account to view your Gmail inbox, read threads, and compose messages directly inside Lumina.
              </p>
              <button
                type="button"
                className="email-login-prompt-btn"
                onClick={handleConnectGoogle}
              >
                <Mail size={14} />
                <span>Log in with Google</span>
              </button>
            </div>
          ) : (
            <>
              {/* Left Column: Folders Navigation */}
              <div className="email-sidebar">
                <button
                  type="button"
                  className="email-compose-btn"
                  onClick={() => setIsComposeOpen(true)}
                >
                  <Plus size={14} />
                  <span>Compose</span>
                </button>

                {folders.map((f) => {
                  const Icon = f.icon
                  return (
                    <button
                      key={f.id}
                      type="button"
                      className={`email-nav-item ${currentFolder === f.id ? 'active' : ''}`}
                      onClick={() => {
                        setCurrentFolder(f.id)
                        setSelectedEmailId(null)
                      }}
                    >
                      <Icon size={14} />
                      <span>{f.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Middle Column: Email List */}
              <div className="email-list-pane" style={{ width: `${listWidth}px` }}>
                <div className="email-search-bar">
                  <Search size={13} style={{ color: 'var(--text-faint)' }} />
                  <input
                    type="text"
                    className="email-search-input"
                    placeholder="Search mail..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        fetchEmails(currentFolder, searchQuery)
                      }
                    }}
                  />
                </div>

                <div className="email-list-scroll">
                  {/* Notice / Error Card for insufficient scopes */}
                  {isScopeError && (
                    <div className="email-auth-warning-banner">
                      <ShieldAlert size={16} className="text-amber-400 flex-shrink-0" />
                      <div className="flex-1 text-xs">
                        <div className="font-semibold text-amber-200">Gmail Permission Required</div>
                        <div className="text-[11px] text-amber-300/80 mt-0.5">
                          Your Google login needs Gmail permissions to read & send emails.
                        </div>
                        <button
                          type="button"
                          className="email-reconnect-btn"
                          onClick={handleConnectGoogle}
                        >
                          Grant Gmail Access
                        </button>
                      </div>
                    </div>
                  )}

                  {isLoadingList ? (
                    <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-faint)' }}>
                      <Loader2 size={16} className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
                      <span style={{ fontSize: '11px' }}>Loading emails...</span>
                    </div>
                  ) : emails.length === 0 ? (
                    <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '11.5px' }}>
                      {errorMessage ? (
                        <div className="text-xs text-rose-400 max-w-[240px] mx-auto">
                          {errorMessage}
                        </div>
                      ) : (
                        'No emails found in this folder'
                      )}
                    </div>
                  ) : (
                    emails.map((msg) => (
                      <div
                        key={msg.id}
                        className={`email-item-card ${selectedEmailId === msg.id ? 'selected' : ''} ${msg.isUnread ? 'unread' : ''}`}
                        onClick={() => setSelectedEmailId(msg.id)}
                      >
                        <div className="email-item-top">
                          <span className="email-item-from">{msg.from}</span>
                          <div className="email-item-meta-row">
                            <span className="email-item-date">{msg.date.split(',')[0]}</span>
                            {/* Gmail style row hover actions */}
                            <div className="email-item-hover-actions">
                              <button
                                type="button"
                                className="email-item-mini-action delete"
                                title="Delete email"
                                onClick={(e) => deleteEmail(msg.id, e)}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="email-item-subject">{msg.subject}</div>
                        <div className="email-item-snippet">{msg.snippet}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Draggable Divider */}
              <div
                className={`email-resizer ${isResizing ? 'active' : ''}`}
                onMouseDown={handleMouseDownResize}
                title="Drag to resize panel"
              />

              {/* Right Column: Email Detail Reader */}
              <div className="email-detail-pane">
                {isLoadingDetails ? (
                  <div className="email-empty-state">
                    <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-accent)' }} />
                    <span style={{ fontSize: '12px' }}>Loading email content...</span>
                  </div>
                ) : activeEmailDetails ? (
                  <>
                    <div className="email-detail-header">
                      <div className="email-detail-subject">{activeEmailDetails.subject}</div>

                      <div className="email-detail-meta">
                        <div className="email-detail-sender">
                          <div className="email-sender-avatar">
                            {activeEmailDetails.from.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="email-sender-name">{activeEmailDetails.from}</div>
                            <div className="email-recipient-line">
                              To: {activeEmailDetails.to || 'me'}
                              {activeEmailDetails.date && ` • ${activeEmailDetails.date}`}
                            </div>
                          </div>
                        </div>

                        <div className="email-detail-actions">
                          <button
                            type="button"
                            className={`email-action-icon-btn ${activeEmailDetails.isStarred ? 'starred' : ''}`}
                            onClick={(e) => toggleStar(activeEmailDetails, e)}
                            title={activeEmailDetails.isStarred ? 'Unstar' : 'Star'}
                          >
                            <Star size={15} fill={activeEmailDetails.isStarred ? '#f59e0b' : 'none'} />
                          </button>

                          <button
                            type="button"
                            className="email-action-icon-btn"
                            onClick={(e) => toggleUnread(activeEmailDetails, e)}
                            title="Mark as unread"
                          >
                            <Mail size={15} />
                          </button>

                          <button
                            type="button"
                            className="email-action-icon-btn delete"
                            onClick={(e) => deleteEmail(activeEmailDetails.id, e)}
                            title="Delete email"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Attachments bar */}
                    {activeEmailDetails.attachments && activeEmailDetails.attachments.length > 0 && (
                      <div className="email-attachments-bar">
                        {activeEmailDetails.attachments.map((att, i) => (
                          <div key={i} className="email-attachment-pill">
                            <Paperclip size={12} style={{ color: 'var(--text-accent)' }} />
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
              </div>
            </>
          )}

          {/* Compose Modal */}
          <EmailComposeModal
            isOpen={isComposeOpen}
            onClose={() => setIsComposeOpen(false)}
            draft={draft}
            setDraft={setDraft}
            onSend={sendCurrentDraft}
            onAddAttachments={addAttachments}
            onAttachNote={attachNote}
            onRemoveAttachment={removeAttachment}
            isSending={isSending}
          />
        </div>
      </div>
    </div>,
    document.body
  )
}

export default EmailModal
