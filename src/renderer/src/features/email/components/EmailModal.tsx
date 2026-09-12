import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Mail,
  RefreshCw,
  Maximize2,
  Minimize2,
  X,
  MailQuestion,
  Bell,
  BellOff
} from 'lucide-react'
import { useEmailClient } from '../hooks/useEmailClient'
import { EmailSidebar } from './EmailSidebar'
import { EmailListPane } from './EmailListPane'
import { EmailDetailPane } from './EmailDetailPane'
import { EmailComposeModal } from './EmailComposeModal'
import { EmailFolder } from '../types'
import { DEFAULT_GOOGLE_CLIENT_ID } from '../../../core/hooks/useCurrentUser'
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

  // Resizable list pane width (default 320px, min 220px, max 550px)
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

  // Desktop notifications mute / unmute state (persisted)
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('lumina_email_notifications') !== 'false'
    } catch {
      return true
    }
  })

  const toggleNotifications = () => {
    setNotificationsEnabled((prev) => {
      const next = !prev
      try {
        localStorage.setItem('lumina_email_notifications', String(next))
      } catch {}
      window.dispatchEvent(new CustomEvent('email-notifications-toggle', { detail: { enabled: next } }))
      return next
    })
  }

  const {
    googleUser,
    isLoggedIn,
    login,
    currentFolder,
    setCurrentFolder,
    searchQuery,
    setSearchQuery,
    emails,
    userLabels,
    selectedEmailId,
    setSelectedEmailId,
    activeEmailDetails,
    isLoadingList,
    isLoadingDetails,
    isSending,
    isComposeOpen,
    setIsComposeOpen,
    errorMessage,
    draft,
    setDraft,
    fetchEmails,
    toggleStar,
    toggleUnread,
    deleteEmail,
    replyToEmail,
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
    try {
      if (typeof login === 'function') {
        await login(DEFAULT_GOOGLE_CLIENT_ID)
      } else if (window.api?.loginWithGoogle) {
        await window.api.loginWithGoogle(DEFAULT_GOOGLE_CLIENT_ID)
      }
      fetchEmails(currentFolder)
    } catch (err) {
      console.error('Failed to log in with Google:', err)
    }
  }

  if (!isOpen) return null

  // Check if error is related to missing Gmail scopes or expired credentials
  const isScopeError = Boolean(
    errorMessage &&
      !isLoadingList &&
      (errorMessage.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT') ||
        errorMessage.includes('insufficient_scope') ||
        errorMessage.includes('Request had insufficient authentication scopes') ||
        (errorMessage.includes('Gmail API error (403)') && !errorMessage.includes('rateLimitExceeded')))
  )

  const getFolderTitle = (folder: EmailFolder): string => {
    if (folder === 'INBOX') return 'Inbox'
    if (folder === 'ALL') return 'All Inboxes'
    if (folder === 'STARRED') return 'Starred'
    if (folder === 'IMPORTANT') return 'Important'
    if (folder === 'SENT') return 'Sent'
    if (folder === 'DRAFT') return 'Drafts'
    if (folder === 'CATEGORY_PROMOTIONS') return 'Promotions'
    if (folder === 'CATEGORY_SOCIAL') return 'Social'
    if (folder === 'CATEGORY_UPDATES') return 'Updates'
    if (folder === 'CATEGORY_FORUMS') return 'Forums'
    if (folder === 'SPAM') return 'Spam'
    if (folder === 'TRASH') return 'Trash'
    const custom = userLabels?.find((l) => l.id === folder)
    return custom ? custom.name : folder
  }

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
            <ToolTip text={notificationsEnabled ? 'Desktop Notifications (On)' : 'Desktop Notifications (Muted)'} position="bottom">
              <button
                type="button"
                className={`email-header-btn ${!notificationsEnabled ? 'text-amber-400' : ''}`}
                onClick={toggleNotifications}
                aria-label="Toggle email notifications"
                style={{ color: !notificationsEnabled ? '#f59e0b' : undefined }}
              >
                {notificationsEnabled ? <Bell size={13} /> : <BellOff size={13} />}
              </button>
            </ToolTip>

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
              {/* Left Column: Separated Sidebar */}
              <EmailSidebar
                currentFolder={currentFolder}
                onSelectFolder={(folder) => {
                  setCurrentFolder(folder)
                  setSelectedEmailId(null)
                }}
                userLabels={userLabels}
                onOpenCompose={() => setIsComposeOpen(true)}
              />

              {/* Middle Column: Separated Email List */}
              <EmailListPane
                currentFolder={currentFolder}
                folderTitle={getFolderTitle(currentFolder)}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onSearchSubmit={() => fetchEmails(currentFolder, searchQuery)}
                emails={emails}
                selectedEmailId={selectedEmailId}
                onSelectEmail={setSelectedEmailId}
                onDeleteEmail={deleteEmail}
                isLoadingList={isLoadingList}
                isScopeError={isScopeError}
                errorMessage={errorMessage}
                onGrantPermission={handleConnectGoogle}
                listWidth={listWidth}
              />

              {/* Draggable Divider */}
              <div
                className={`email-resizer ${isResizing ? 'active' : ''}`}
                onMouseDown={handleMouseDownResize}
                title="Drag to resize panel"
              />

              {/* Right Column: Separated Email Detail Reader */}
              <EmailDetailPane
                activeEmailDetails={activeEmailDetails}
                isLoadingDetails={isLoadingDetails}
                onReply={replyToEmail}
                onToggleStar={toggleStar}
                onToggleUnread={toggleUnread}
                onDeleteEmail={deleteEmail}
              />
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
