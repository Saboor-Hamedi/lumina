import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Mail,
  MailQuestion
} from 'lucide-react'
import { useEmailClient } from '../hooks/useEmailClient'
import { EmailSidebar } from './EmailSidebar'
import { EmailListPane } from './EmailListPane'
import { EmailDetailPane } from './EmailDetailPane'
import { EmailComposeModal } from './EmailComposeModal'
import { EmailFooter } from './EmailFooter'
import { EmailFolder } from '../types'
import { DEFAULT_GOOGLE_CLIENT_ID } from '../../../core/hooks/useCurrentUser'
import { useSettingsStore } from '../../../core/store/useSettingsStore'
import '../css/email.css'

/**
 * Props for the EmailContainer dropdown
 */
export interface EmailContainerProps {
  /** Whether the email dropdown is open */
  isOpen: boolean
  /** Callback to close the email dropdown */
  onClose: () => void
  /** Anchor position ('left' for ActivityBar, 'right' for TitleBar) */
  anchor?: 'left' | 'right'
}

/**
 * EmailContainer Component
 * 
 * Non-blocking, resizable dropdown container anchored directly beneath the TitleBar or ActivityBar.
 * Parallel to AccentColor.jsx, this component allows users to browse mail, read threads,
 * and compose messages without blocking access to notes, editor tabs, or the AI sidebar.
 * 
 * Features Lumina-grade collapsible curtain mechanics for both EmailSidebar and EmailDetailPane,
 * complete with drag-to-resize handles, threshold snapping, and persistent geometry saved to settings.json.
 */
export const EmailContainer: React.FC<EmailContainerProps> = ({ isOpen, onClose, anchor = 'right' }) => {
  const containerRef = useRef<HTMLDivElement>(null)

  // Resizable container dimensions (persisted in settings.json with localStorage fallback)
  const [containerWidth, setContainerWidth] = useState<number>(() => {
    const storeVal = useSettingsStore.getState().settings?.emailModalWidth
    if (typeof storeVal === 'number' && storeVal >= 300 && storeVal <= 1600) {
      return storeVal
    }
    try {
      const saved = localStorage.getItem('lumina_email_container_width')
      return saved ? Math.min(Math.max(parseInt(saved, 10), 300), 1600) : 840
    } catch {
      return 840
    }
  })

  // Default height reduced by 50px from 560 to 510
  const [containerHeight, setContainerHeight] = useState<number>(() => {
    const storeVal = useSettingsStore.getState().settings?.emailModalHeight
    if (typeof storeVal === 'number' && storeVal >= 320 && storeVal <= 950) {
      return storeVal
    }
    try {
      const saved = localStorage.getItem('lumina_email_container_height')
      return saved ? Math.min(Math.max(parseInt(saved, 10), 320), 950) : 510
    } catch {
      return 510
    }
  })

  // Left Sidebar Open/Closed State (persisted in settings.json)
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    const storeVal = useSettingsStore.getState().settings?.emailSidebarOpen
    if (typeof storeVal === 'boolean') {
      return storeVal
    }
    try {
      return localStorage.getItem('lumina_email_sidebar_open') !== 'false'
    } catch {
      return true
    }
  })

  // Left Sidebar Width (persisted in settings.json)
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const storeVal = useSettingsStore.getState().settings?.emailSidebarWidth
    if (typeof storeVal === 'number' && storeVal >= 140 && storeVal <= 300) {
      return storeVal
    }
    try {
      const saved = localStorage.getItem('lumina_email_sidebar_width')
      return saved ? Math.min(Math.max(parseInt(saved, 10), 140), 300) : 195
    } catch {
      return 195
    }
  })

  const [isResizingSidebar, setIsResizingSidebar] = useState<boolean>(false)
  const isResizingSidebarRef = useRef(false)

  // Right Detail Reader Open/Closed State (persisted in settings.json)
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(() => {
    const storeVal = useSettingsStore.getState().settings?.emailDetailOpen
    if (typeof storeVal === 'boolean') {
      return storeVal
    }
    try {
      return localStorage.getItem('lumina_email_detail_open') !== 'false'
    } catch {
      return true
    }
  })

  // Middle email list width (persisted in settings.json)
  const [listWidth, setListWidth] = useState<number>(() => {
    const storeVal = useSettingsStore.getState().settings?.emailListWidth
    if (typeof storeVal === 'number' && storeVal >= 220 && storeVal <= 550) {
      return storeVal
    }
    try {
      const saved = localStorage.getItem('lumina_email_list_width')
      return saved ? Math.min(Math.max(parseInt(saved, 10), 220), 550) : 300
    } catch {
      return 300
    }
  })

  const [isResizingList, setIsResizingList] = useState<boolean>(false)
  const isResizingListRef = useRef(false)

  const [isResizingContainer, setIsResizingContainer] = useState<boolean>(false)
  const isResizingContainerRef = useRef(false)

  // Desktop notifications mute / unmute state
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('lumina_email_notifications') !== 'false'
    } catch {
      return true
    }
  })

  // Toggle notifications and notify other listeners
  const toggleNotifications = useCallback(() => {
    setNotificationsEnabled((prev) => {
      const next = !prev
      try {
        localStorage.setItem('lumina_email_notifications', String(next))
      } catch {}
      window.dispatchEvent(new CustomEvent('email-notifications-toggle', { detail: { enabled: next } }))
      return next
    })
  }, [])

  // Hook connecting to background Gmail state and IPC operations
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

  // Listen for external or IPC updates to settings.json via useSettingsStore
  const storeSettings = useSettingsStore((state) => state.settings)
  useEffect(() => {
    if (isResizingContainerRef.current || isResizingSidebarRef.current || isResizingListRef.current) return
    if (typeof storeSettings?.emailModalWidth === 'number' && storeSettings.emailModalWidth !== containerWidth) {
      setContainerWidth(storeSettings.emailModalWidth)
    }
    if (typeof storeSettings?.emailModalHeight === 'number' && storeSettings.emailModalHeight !== containerHeight) {
      setContainerHeight(storeSettings.emailModalHeight)
    }
    if (typeof storeSettings?.emailSidebarWidth === 'number' && storeSettings.emailSidebarWidth !== sidebarWidth) {
      setSidebarWidth(storeSettings.emailSidebarWidth)
    }
    if (typeof storeSettings?.emailListWidth === 'number' && storeSettings.emailListWidth !== listWidth) {
      setListWidth(storeSettings.emailListWidth)
    }
    if (typeof storeSettings?.emailSidebarOpen === 'boolean' && storeSettings.emailSidebarOpen !== isSidebarOpen) {
      setIsSidebarOpen(storeSettings.emailSidebarOpen)
    }
    if (typeof storeSettings?.emailDetailOpen === 'boolean' && storeSettings.emailDetailOpen !== isDetailOpen) {
      setIsDetailOpen(storeSettings.emailDetailOpen)
    }
  }, [
    storeSettings?.emailModalWidth,
    storeSettings?.emailModalHeight,
    storeSettings?.emailSidebarWidth,
    storeSettings?.emailListWidth,
    storeSettings?.emailSidebarOpen,
    storeSettings?.emailDetailOpen
  ])

  // Explicit Toggle Callbacks (updates settings.json and localStorage)
  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => {
      const next = !prev
      setTimeout(() => {
        useSettingsStore.getState().updateSetting('emailSidebarOpen', next)
      }, 0)
      try {
        localStorage.setItem('lumina_email_sidebar_open', String(next))
      } catch {}
      return next
    })
  }, [])

  const handleToggleDetail = useCallback(() => {
    setIsDetailOpen((prev) => {
      const next = !prev
      setTimeout(() => {
        useSettingsStore.getState().updateSetting('emailDetailOpen', next)
      }, 0)
      try {
        localStorage.setItem('lumina_email_detail_open', String(next))
      } catch {}
      return next
    })
  }, [])

  const handleCloseDetail = useCallback(() => {
    setIsDetailOpen(false)
    setTimeout(() => {
      useSettingsStore.getState().updateSetting('emailDetailOpen', false)
    }, 0)
    try {
      localStorage.setItem('lumina_email_detail_open', 'false')
    } catch {}
  }, [])

  const handleSelectEmail = useCallback((id: string) => {
    setSelectedEmailId(id)
    setIsDetailOpen(true)
    setTimeout(() => {
      useSettingsStore.getState().updateSetting('emailDetailOpen', true)
    }, 0)
    try {
      localStorage.setItem('lumina_email_detail_open', 'true')
    } catch {}
  }, [setSelectedEmailId])

  const handleSelectFolder = useCallback((folder: EmailFolder) => {
    setCurrentFolder(folder)
    setSelectedEmailId(null)
  }, [setCurrentFolder, setSelectedEmailId])

  // Handle ESC key to dismiss compose or container
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

  // Handle click outside dropdown to close
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // Prevent closing if interacting with native file dialogs or dropdown portals
        const targetEl = e.target as HTMLElement
        if (targetEl.closest('.titlebar') || targetEl.closest('.mail-titlebar-container') || targetEl.closest('.control-btn')) {
          return
        }
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  // Left Sidebar Drag Resizer (Snaps closed below 75px threshold, matching Lumina Sidebar)
  const handleMouseDownSidebarResize = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizingSidebar(true)
    isResizingSidebarRef.current = true
    document.body.classList.add('is-global-resizing')
    window.getSelection()?.removeAllRanges()
    const startX = e.clientX
    const startWidth = sidebarWidth
    let lastWidth = startWidth
    let lastOpen = isSidebarOpen

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingSidebarRef.current) return
      const deltaX = moveEvent.clientX - startX
      const rawWidth = startWidth + deltaX
      if (rawWidth < 75) {
        lastOpen = false
        setIsSidebarOpen(false)
      } else {
        lastOpen = true
        setIsSidebarOpen(true)
        const clamped = Math.min(Math.max(rawWidth, 140), 300)
        lastWidth = clamped
        setSidebarWidth(clamped)
      }
    }

    const handleMouseUp = () => {
      setIsResizingSidebar(false)
      isResizingSidebarRef.current = false
      document.body.classList.remove('is-global-resizing')
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)

      // Persist to settings.json and localStorage
      useSettingsStore.getState().updateSettings({
        emailSidebarWidth: lastWidth,
        emailSidebarOpen: lastOpen
      })
      try {
        localStorage.setItem('lumina_email_sidebar_width', String(lastWidth))
        localStorage.setItem('lumina_email_sidebar_open', String(lastOpen))
      } catch {}
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  // Right Detail Drag Resizer (Snaps closed when remaining space drops below 120px)
  const handleMouseDownListResize = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizingList(true)
    isResizingListRef.current = true
    document.body.classList.add('is-global-resizing')
    window.getSelection()?.removeAllRanges()
    const startX = e.clientX
    const curEffectiveWidth = typeof effectiveListWidth === 'number' ? effectiveListWidth : listWidth
    const startWidth = curEffectiveWidth
    let lastWidth = startWidth
    let lastDetailOpen = isDetailOpen

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingListRef.current) return
      const deltaX = moveEvent.clientX - startX
      const curSidebarWidth = isSidebarOpen && (!isCompact || !isDetailOpen) ? sidebarWidth : 0
      const availableForPanes = Math.max(containerWidth - curSidebarWidth, 240)
      
      // Calculate new list width bounded so neither list nor detail pane gets crushed
      const minListW = 180
      const maxListW = Math.max(availableForPanes - 160, minListW)
      const rawWidth = startWidth + deltaX
      const remainingForDetail = availableForPanes - rawWidth

      // Only collapse the detail pane if dragged intentionally past the right margin (< 40px)
      if (remainingForDetail < 40) {
        lastDetailOpen = false
        setIsDetailOpen(false)
      } else {
        lastDetailOpen = true
        const clamped = Math.min(Math.max(rawWidth, minListW), maxListW)
        lastWidth = clamped
        const listPane = containerRef.current?.querySelector<HTMLElement>('.email-list-pane')
        if (listPane) listPane.style.width = `${clamped}px`
      }
    }

    const handleMouseUp = () => {
      setIsResizingList(false)
      isResizingListRef.current = false
      document.body.classList.remove('is-global-resizing')
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)

      setListWidth(lastWidth)
      setIsDetailOpen(lastDetailOpen)

      // Persist to settings.json and localStorage
      useSettingsStore.getState().updateSettings({
        emailListWidth: lastWidth,
        emailDetailOpen: lastDetailOpen
      })
      try {
        localStorage.setItem('lumina_email_list_width', String(lastWidth))
        localStorage.setItem('lumina_email_detail_open', String(lastDetailOpen))
      } catch {}
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  // Container Corner Resizer (Anchored at top-right, dragging bottom-left expands it)
  const handleMouseDownContainerResize = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizingContainer(true)
    isResizingContainerRef.current = true
    document.body.classList.add('is-global-resizing')
    window.getSelection()?.removeAllRanges()
    const startX = e.clientX
    const startY = e.clientY
    const startWidth = containerWidth
    const startHeight = containerHeight
    let prevWidth = startWidth
    let lastWidth = startWidth
    let lastHeight = startHeight
    let sidesAutoClosed = false

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingContainerRef.current) return
      // Moving left increases width if anchored right; moving right increases width if anchored left
      const deltaX = anchor === 'left' ? moveEvent.clientX - startX : startX - moveEvent.clientX
      // Moving down increases height
      const deltaY = moveEvent.clientY - startY
      const newWidth = Math.min(Math.max(startWidth + deltaX, 300), Math.min(window.innerWidth - 40, 1600))
      const newHeight = Math.min(Math.max(startHeight + deltaY, 320), Math.min(window.innerHeight - 80, 950))
      
      // Auto-collapse both sidebars when crossing into compact width (<= 400px)
      if (newWidth <= 400 && prevWidth > 400) {
        sidesAutoClosed = true
        setIsSidebarOpen(false)
        setIsDetailOpen(false)
      }
      prevWidth = newWidth
      lastWidth = newWidth
      lastHeight = newHeight

      if (containerRef.current) {
        containerRef.current.style.width = `${newWidth}px`
        containerRef.current.style.height = `${newHeight}px`
      }
    }

    const handleMouseUp = () => {
      setIsResizingContainer(false)
      isResizingContainerRef.current = false
      document.body.classList.remove('is-global-resizing')
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)

      setContainerWidth(lastWidth)
      setContainerHeight(lastHeight)

      const payload: Record<string, any> = {
        emailModalWidth: lastWidth,
        emailModalHeight: lastHeight
      }
      if (sidesAutoClosed) {
        payload.emailSidebarOpen = false
        payload.emailDetailOpen = false
      }

      // Persist to settings.json and localStorage
      useSettingsStore.getState().updateSettings(payload)
      try {
        localStorage.setItem('lumina_email_container_width', String(lastWidth))
        localStorage.setItem('lumina_email_container_height', String(lastHeight))
        if (sidesAutoClosed) {
          localStorage.setItem('lumina_email_sidebar_open', 'false')
          localStorage.setItem('lumina_email_detail_open', 'false')
        }
      } catch {}
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  // Google account connection handler
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

  // Resolve human-readable title for folder
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

  const isCompact = containerWidth <= 480

  // Dynamically calculate available width for middle list and right detail reading pane
  const curSidebarWidth = isSidebarOpen && (!isCompact || !isDetailOpen) ? sidebarWidth : 0
  const availableForPanes = Math.max(containerWidth - curSidebarWidth, 200)

  // Ensure reading detail pane has at least 240px when open
  const minDetailWidth = Math.min(260, Math.max(availableForPanes * 0.4, 180))
  const maxListWidthAllowed = Math.max(availableForPanes - minDetailWidth, 180)
  const effectiveListWidth = isDetailOpen && !isCompact ? Math.min(listWidth, maxListWidthAllowed) : '100%'
  const remainingForDetail = availableForPanes - (typeof effectiveListWidth === 'number' ? effectiveListWidth : 0)
  const isDetailNarrow = remainingForDetail < 360

  return (
    <div
      ref={containerRef}
      className={`email-dropdown-container ${anchor === 'left' ? 'anchor-left' : ''} ${isResizingContainer ? 'resizing' : ''} ${isCompact ? 'compact' : ''}`}
      style={{
        width: `${containerWidth}px`,
        height: `${containerHeight}px`
      }}
      onClick={(e) => e.stopPropagation()}
      aria-label="Lumina Email Dropdown"
    >
      {/* Corner Resize Handle */}
      <div
        className={`email-container-corner-handle ${anchor === 'left' ? 'anchor-left' : ''}`}
        onMouseDown={handleMouseDownContainerResize}
        title="Drag to resize email container"
      />

      {/* Main Content Area */}
      <div className="email-container-content">
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
            {/* 1. Left Navigation Sidebar (Collapsible Curtain) */}
            <EmailSidebar
              currentFolder={currentFolder}
              onSelectFolder={handleSelectFolder}
              userLabels={userLabels}
              onOpenCompose={() => setIsComposeOpen(true)}
              isOpen={isSidebarOpen && (!isCompact || !isDetailOpen)}
              onToggleOpen={handleToggleSidebar}
              width={sidebarWidth}
              isResizing={isResizingSidebar}
            />

            {/* Left Sidebar Drag Resizer */}
            {isSidebarOpen && (!isCompact || !isDetailOpen) && (
              <div
                className={`email-pane-resizer left ${isResizingSidebar ? 'active' : ''}`}
                onMouseDown={handleMouseDownSidebarResize}
                title="Drag to resize sidebar (drag left to collapse)"
              />
            )}

            {/* 2. Middle Message List */}
            {(!isCompact || !isDetailOpen) && (
              <EmailListPane
                currentFolder={currentFolder}
                folderTitle={getFolderTitle(currentFolder)}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onSearchSubmit={() => fetchEmails(currentFolder, searchQuery)}
                emails={emails}
                selectedEmailId={selectedEmailId}
                onSelectEmail={handleSelectEmail}
                onDeleteEmail={deleteEmail}
                isLoadingList={isLoadingList}
                isScopeError={isScopeError}
                errorMessage={errorMessage}
                onGrantPermission={handleConnectGoogle}
                listWidth={typeof effectiveListWidth === 'number' ? effectiveListWidth : listWidth}
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={handleToggleSidebar}
                isDetailOpen={isDetailOpen}
                onToggleDetail={handleToggleDetail}
                isCompact={isCompact}
              />
            )}

            {/* Right Detail Drag Resizer */}
            {!isCompact && isDetailOpen && (
              <div
                className={`email-pane-resizer right ${isResizingList ? 'active' : ''}`}
                onMouseDown={handleMouseDownListResize}
                title="Drag to resize reading pane (drag right to collapse)"
              />
            )}

            {/* 3. Right Email Reader & Details (Collapsible) */}
            <EmailDetailPane
              activeEmailDetails={activeEmailDetails}
              isLoadingDetails={isLoadingDetails}
              onReply={replyToEmail}
              onToggleStar={toggleStar}
              onToggleUnread={toggleUnread}
              onDeleteEmail={deleteEmail}
              isOpen={isDetailOpen}
              onCloseDetail={handleCloseDetail}
              isCompact={isCompact}
              isNarrow={isDetailNarrow}
            />
          </>
        )}

        {/* Compose View (Container-Scoped, Non-blocking to Lumina notes & AI) */}
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

      {/* Footer Bar (Relocated controls: Notifications, Refresh, Account, Close) */}
      <EmailFooter
        userEmail={googleUser?.email || googleUser?.name}
        notificationsEnabled={notificationsEnabled}
        onToggleNotifications={toggleNotifications}
        isLoadingList={isLoadingList}
        onRefresh={() => fetchEmails(currentFolder, searchQuery)}
        onClose={onClose}
      />
    </div>
  )
}

export const EmailModal = EmailContainer
export default EmailContainer
