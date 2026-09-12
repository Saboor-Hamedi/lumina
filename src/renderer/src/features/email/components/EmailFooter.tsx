import React from 'react'
import { Bell, BellOff, RefreshCw, X, User, CheckCircle2 } from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'

/**
 * Props for the EmailFooter component
 */
export interface EmailFooterProps {
  /** Authenticated user info or email address */
  userEmail?: string
  /** Whether desktop/OS notifications are currently enabled */
  notificationsEnabled: boolean
  /** Callback to toggle notification mute state */
  onToggleNotifications: () => void
  /** Whether mailbox data is currently fetching/refreshing */
  isLoadingList: boolean
  /** Callback to refresh current mailbox/folder */
  onRefresh: () => void
  /** Callback to close the email dropdown container */
  onClose: () => void
}

/**
 * EmailFooter Component
 * 
 * Provides an unobtrusive, consolidated control bar at the base of the EmailContainer.
 * Relocates refresh, desktop notification toggles, user identity badge, and close actions
 * away from the top header to maximize vertical reading space.
 */
export const EmailFooter: React.FC<EmailFooterProps> = ({
  userEmail,
  notificationsEnabled,
  onToggleNotifications,
  isLoadingList,
  onRefresh,
  onClose
}) => {
  return (
    <footer className="email-footer-bar" aria-label="Email actions and controls">
      {/* Left: Connected Account Info */}
      <div className="email-footer-account">
        <span className="email-footer-status-dot" title="Gmail Connected" />
        {userEmail ? (
          <span className="email-footer-user-text" title={userEmail}>
            {userEmail}
          </span>
        ) : (
          <span className="email-footer-user-text">Connected</span>
        )}
      </div>

      {/* Right: Notification Toggle, Refresh, and Close Controls */}
      <div className="email-footer-actions">
        {/* Toggle Desktop Sound & OS Notifications */}
        <ToolTip
          text={notificationsEnabled ? 'Desktop Notifications (Active)' : 'Desktop Notifications (Muted)'}
          position="top"
        >
          <button
            type="button"
            className={`email-footer-btn ${!notificationsEnabled ? 'muted' : ''}`}
            onClick={onToggleNotifications}
            aria-label="Toggle email notifications"
          >
            {notificationsEnabled ? <Bell size={13} /> : <BellOff size={13} />}
          </button>
        </ToolTip>

        {/* Refresh Current Mailbox */}
        <ToolTip text="Refresh Folder" position="top">
          <button
            type="button"
            className="email-footer-btn"
            onClick={onRefresh}
            disabled={isLoadingList}
            aria-label="Refresh emails"
          >
            <RefreshCw size={13} className={isLoadingList ? 'animate-spin' : ''} />
          </button>
        </ToolTip>

        {/* Close Dropdown Container */}
        <ToolTip text="Close (Esc)" position="top">
          <button
            type="button"
            className="email-footer-btn close-btn"
            onClick={onClose}
            aria-label="Close email dropdown"
          >
            <X size={14} />
          </button>
        </ToolTip>
      </div>
    </footer>
  )
}

export default EmailFooter
