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
  Layers,
  Bookmark,
  ChevronDown,
  ChevronRight,
  Bell
} from 'lucide-react'
import { EmailFolder, EmailLabelItem } from '../types'

export interface EmailSidebarProps {
  currentFolder: EmailFolder
  onSelectFolder: (folder: EmailFolder) => void
  userLabels: EmailLabelItem[]
  onOpenCompose: () => void
}

interface NavItem {
  id: EmailFolder
  label: string
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>
}

export const EmailSidebar: React.FC<EmailSidebarProps> = ({
  currentFolder,
  onSelectFolder,
  userLabels,
  onOpenCompose
}) => {
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState<boolean>(true)
  const [isLabelsExpanded, setIsLabelsExpanded] = useState<boolean>(true)

  const primaryFolders: NavItem[] = [
    { id: 'INBOX', label: 'Inbox', icon: Inbox },
    { id: 'ALL', label: 'All Inboxes', icon: Layers },
    { id: 'STARRED', label: 'Starred', icon: Star },
    { id: 'IMPORTANT', label: 'Important', icon: Bookmark },
    { id: 'SENT', label: 'Sent', icon: Send },
    { id: 'DRAFT', label: 'Drafts', icon: FileText }
  ]

  const categoryFolders: NavItem[] = [
    { id: 'CATEGORY_PROMOTIONS', label: 'Promotions', icon: Tag },
    { id: 'CATEGORY_SOCIAL', label: 'Social', icon: Users },
    { id: 'CATEGORY_UPDATES', label: 'Updates', icon: Bell },
    { id: 'CATEGORY_FORUMS', label: 'Forums', icon: MessageSquare }
  ]

  const otherFolders: NavItem[] = [
    { id: 'SPAM', label: 'Spam', icon: AlertOctagon },
    { id: 'TRASH', label: 'Trash', icon: Trash2 }
  ]

  return (
    <aside className="email-sidebar" aria-label="Email folders and labels">
      {/* Top Composer Action Container */}
      <div className="email-compose-wrapper">
        <button
          type="button"
          className="email-compose-btn"
          onClick={onOpenCompose}
          aria-label="Compose new email"
        >
          <Plus size={15} />
          <span>Compose</span>
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="email-sidebar-scroll">
        {/* Primary Mailboxes */}
        <div className="email-nav-group">
          {primaryFolders.map((item) => {
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
              {categoryFolders.map((item) => {
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
            {otherFolders.map((item) => {
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
}
