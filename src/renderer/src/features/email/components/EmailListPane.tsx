import React from 'react'
import { Search, Loader2, Trash2, ShieldAlert, PanelLeftOpen, PanelLeftClose, PanelRightOpen, PanelRightClose } from 'lucide-react'
import { EmailMessageSummary, EmailFolder } from '../types'
import ToolTip from '../../../components/atoms/ToolTip'

/**
 * Props for the EmailListPane component
 */
export interface EmailListPaneProps {
  currentFolder: EmailFolder
  folderTitle: string
  searchQuery: string
  onSearchChange: (val: string) => void
  onSearchSubmit: () => void
  emails: EmailMessageSummary[]
  selectedEmailId: string | null
  onSelectEmail: (id: string) => void
  onDeleteEmail: (id: string, e: React.MouseEvent) => void
  isLoadingList: boolean
  isScopeError: boolean
  errorMessage: string | null
  onGrantPermission: () => void
  listWidth: number
  /** Whether the sidebar is currently open */
  isSidebarOpen?: boolean
  /** Callback to toggle the left sidebar */
  onToggleSidebar?: () => void
  /** Whether the right reading detail pane is currently open */
  isDetailOpen?: boolean
  /** Callback to toggle the right reading detail pane */
  onToggleDetail?: () => void
  /** Whether the container is in compact single-column mode */
  isCompact?: boolean
}

/**
 * EmailListPane Component
 * 
 * Center message list pane with live search, message cards, and collapse/expand controls
 * for both the left navigation sidebar and the right detail reader pane.
 */
export const EmailListPane: React.FC<EmailListPaneProps> = ({
  folderTitle,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  emails,
  selectedEmailId,
  onSelectEmail,
  onDeleteEmail,
  isLoadingList,
  isScopeError,
  errorMessage,
  onGrantPermission,
  listWidth,
  isSidebarOpen = true,
  onToggleSidebar,
  isDetailOpen = true,
  onToggleDetail,
  isCompact = false
}) => {
  return (
    <section
      className={`email-list-pane ${!isDetailOpen ? 'full-width' : ''}`}
      style={{ width: isDetailOpen && !isCompact ? `${listWidth}px` : '100%' }}
      aria-label="Email message list"
    >
      {/* Search Header with Sidebar and Detail Toggle Controls */}
      <div className="email-search-bar">
        {/* Toggle Left Sidebar */}
        {onToggleSidebar && (
          <ToolTip text={isSidebarOpen ? "Collapse Sidebar" : "Open Sidebar"} position="bottom">
            <button
              type="button"
              className={`email-pane-toggle-btn ${!isSidebarOpen ? 'active' : ''}`}
              onClick={onToggleSidebar}
              aria-label={isSidebarOpen ? "Collapse Sidebar" : "Open Sidebar"}
            >
              {isSidebarOpen ? <PanelLeftClose size={13} /> : <PanelLeftOpen size={13} />}
            </button>
          </ToolTip>
        )}

        <Search size={13} style={{ color: 'var(--text-faint, #64748b)', flexShrink: 0 }} />
        <input
          type="text"
          className="email-search-input"
          placeholder={`Search in ${folderTitle}...`}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onSearchSubmit()
            }
          }}
        />

        {/* Toggle Right Reading Pane (shown when collapsed to open) */}
        {onToggleDetail && !isDetailOpen && (
          <ToolTip text="Open Reader" position="bottom">
            <button
              type="button"
              className="email-pane-toggle-btn active"
              onClick={onToggleDetail}
              aria-label="Open Reader"
            >
              <PanelRightOpen size={13} />
            </button>
          </ToolTip>
        )}
      </div>

      {/* Emails Scroll List */}
      <div className="email-list-scroll">
        {/* Permission Required Banner */}
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
                onClick={onGrantPermission}
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
              `No emails found in ${folderTitle}`
            )}
          </div>
        ) : (
          emails.map((msg) => (
            <div
              key={msg.id}
              className={`email-item-card ${selectedEmailId === msg.id ? 'selected' : ''} ${msg.isUnread ? 'unread' : ''}`}
              onClick={() => onSelectEmail(msg.id)}
            >
              <div className="email-item-top">
                <span className="email-item-from">{msg.from}</span>
                <div className="email-item-meta-row">
                  <span className="email-item-date">{msg.date.split(',')[0]}</span>
                  <ToolTip text="Delete email" position="left">
                    <button
                      type="button"
                      className="email-item-delete-btn"
                      aria-label="Delete email"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onDeleteEmail(msg.id, e)
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </ToolTip>
                </div>
              </div>
              <div className="email-item-subject">{msg.subject}</div>
              <div className="email-item-snippet">{msg.snippet}</div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

export default EmailListPane
