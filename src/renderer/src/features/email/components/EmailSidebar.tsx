import React, { useState } from 'react'
import {
  Inbox,
  Send,
  FileText,
  Star,
  Trash2,
  AlertOctagon,
  Plus,
  Tag,
  Users,
  MessageSquare,
  Bookmark,
  ChevronDown,
  ChevronRight,
  Bell,
  PanelLeftClose
} from 'lucide-react'
import { EmailFolder, EmailLabelItem } from '../types'
import ToolTip from '../../../components/atoms/ToolTip'

/**
 * Props for the EmailSidebar component
 */
export interface EmailSidebarProps {
  /** Active folder or label identifier */
  currentFolder: EmailFolder
  /** Callback when user selects a mailbox/folder/label */
  onSelectFolder: (folder: EmailFolder) => void
  /** Custom user labels fetched from Gmail API */
  userLabels: EmailLabelItem[]
  /** Trigger to open the new email composer */
  onOpenCompose: () => void
  /** Whether the sidebar is currently open/expanded */
  isOpen?: boolean
  /** Callback to toggle or collapse the sidebar */
  onToggleOpen?: () => void
  /** Current sidebar width in pixels */
  width?: number
  /** Whether dragging resize is currently active */
  isResizing?: boolean
}

interface NavItem {
  id: EmailFolder
  label: string
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>
}

const PRIMARY_FOLDERS: NavItem[] = [
  { id: 'INBOX', label: 'Inbox', icon: Inbox },
  { id: 'STARRED', label: 'Starred', icon: Star },
  { id: 'IMPORTANT', label: 'Important', icon: Bookmark },
  { id: 'SENT', label: 'Sent', icon: Send },
  { id: 'DRAFT', label: 'Drafts', icon: FileText }
]

const CATEGORY_FOLDERS: NavItem[] = [
  { id: 'CATEGORY_PROMOTIONS', label: 'Promotions', icon: Tag },
  { id: 'CATEGORY_SOCIAL', label: 'Social', icon: Users },
  { id: 'CATEGORY_UPDATES', label: 'Updates', icon: Bell },
  { id: 'CATEGORY_FORUMS', label: 'Forums', icon: MessageSquare }
]

const OTHER_FOLDERS: NavItem[] = [
  { id: 'SPAM', label: 'Spam', icon: AlertOctagon },
  { id: 'TRASH', label: 'Trash', icon: Trash2 }
]

/**
 * EmailSidebar Component
 * 
 * Collapsible left navigation pane modeled after Lumina's main Sidebar.
 * Supports smooth curtain collapse, drag-to-resize, and snap-to-close threshold mechanics.
 */
export const EmailSidebar = React.memo<EmailSidebarProps>(({ 
  currentFolder,
  onSelectFolder,
  userLabels,
  onOpenCompose,
  isOpen = true,
  onToggleOpen,
  width = 195,
  isResizing = false
}) => {
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState<boolean>(true)
  const [isLabelsExpanded, setIsLabelsExpanded] = useState<boolean>(true)

  return (
    <aside
      className={`email-sidebar ${!isOpen ? 'closed' : 'open'} ${isResizing ? 'is-resizing' : ''}`}
      style={{
        width: isOpen ? `${width}px` : '0px',
        minWidth: isOpen ? `${width}px` : '0px'
      }}
      aria-label="Email folders and labels"
    >
      {/* Top Composer Action Container */}
      <div className="email-compose-wrapper">
        <button
          type="button"
          className="email-compose-btn"
          onClick={onOpenCompose}
          aria-label="Compose new email"
        >
          <Plus size={13} />
          <span>Compose</span>
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="email-sidebar-scroll">
        {/* Primary Mailboxes */}
        <div className="email-nav-group">
          {PRIMARY_FOLDERS.map((item) => {
            const Icon = item.icon
            const isActive = currentFolder === item.id
            return (
              <button
                key={item.id}
                type="button"
                className={`email-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelectFolder(item.id)}
              >
                <Icon size={14} />
                <span className="email-nav-label-text">{item.label}</span>
              </button>
            )
          })}
        </div>

        {/* Categories (Promotions, Social, Updates, Forums) */}
        <div className="email-nav-group">
          <div
            className="email-nav-section-title clickable"
            onClick={() => setIsCategoriesExpanded(!isCategoriesExpanded)}
            title="Toggle categories"
          >
            <span>Categories</span>
            {isCategoriesExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </div>
          {isCategoriesExpanded && (
            <div className="email-nav-subgroup">
              {CATEGORY_FOLDERS.map((item) => {
                const Icon = item.icon
                const isActive = currentFolder === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`email-nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => onSelectFolder(item.id)}
                  >
                    <Icon size={14} />
                    <span className="email-nav-label-text">{item.label}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Custom Labels */}
        <div className="email-nav-group">
          <div
            className="email-nav-section-title clickable"
            onClick={() => setIsLabelsExpanded(!isLabelsExpanded)}
            title="Toggle custom labels"
          >
            <span>Labels</span>
            {isLabelsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </div>
          {isLabelsExpanded && (
            <div className="email-nav-subgroup">
              {userLabels && userLabels.length > 0 ? (
                userLabels.map((lbl) => {
                  const isActive = currentFolder === lbl.id
                  return (
                    <button
                      key={lbl.id}
                      type="button"
                      className={`email-nav-item ${isActive ? 'active' : ''}`}
                      onClick={() => onSelectFolder(lbl.id)}
                      title={lbl.name}
                    >
                      <Tag
                        size={13}
                        style={{ color: lbl.color?.backgroundColor || 'var(--text-muted, #94a3b8)' }}
                      />
                      <span className="email-nav-label-text">{lbl.name}</span>
                      {Boolean(lbl.messagesUnread && lbl.messagesUnread > 0) && (
                        <span className="email-nav-badge">{lbl.messagesUnread}</span>
                      )}
                    </button>
                  )
                })
              ) : (
                <div className="email-nav-empty-labels">No custom labels</div>
              )}
            </div>
          )}
        </div>

        {/* Other / System Folders */}
        <div className="email-nav-group">
          <div className="email-nav-section-title">
            <span>Other</span>
          </div>
          <div className="email-nav-subgroup">
            {OTHER_FOLDERS.map((item) => {
              const Icon = item.icon
              const isActive = currentFolder === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`email-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectFolder(item.id)}
                >
                  <Icon size={14} />
                  <span className="email-nav-label-text">{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </aside>
  )
})

export default EmailSidebar
