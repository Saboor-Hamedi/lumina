import React, { useEffect, useRef } from 'react'
import {
  Pencil,
  Pin,
  PinOff,
  Copy,
  Download,
  Eraser,
  Trash2
} from 'lucide-react'

export interface LuminaSessionMenuProps {
  session: any
  position: { x: number; y: number } | null
  onClose: () => void
  onRename: () => void
  onTogglePin: () => void
  onDuplicate: () => void
  onClear: () => void
  onDelete: () => void
}

/**
 * LuminaSessionMenu - Context menu on right-clicking a chat session
 * Options: Rename, Pin/Unpin to Top, Duplicate, Copy as Markdown, Clear Messages, Delete Chat.
 */
export const LuminaSessionMenu: React.FC<LuminaSessionMenuProps> = ({
  session,
  position,
  onClose,
  onRename,
  onTogglePin,
  onDuplicate,
  onClear,
  onDelete
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('mousedown', handleOutsideClick)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  if (!session || !position) return null

  // Ensure menu stays within screen viewport
  const menuWidth = 190
  const menuHeight = 220
  const x = Math.min(position.x, window.innerWidth - menuWidth - 10)
  const y = Math.min(position.y, window.innerHeight - menuHeight - 10)

  const handleExport = (e: React.MouseEvent) => {
    e.stopPropagation()
    const messages = session.messages || []
    if (messages.length === 0) {
      onClose()
      return
    }
    const markdown = messages
      .map((m: any) => `### ${m.role === 'user' ? 'User' : 'Lumina AI'}\n\n${m.content || ''}`)
      .join('\n\n---\n\n')
    navigator.clipboard.writeText(`# ${session.title || 'Chat'}\n\n${markdown}`)
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className="lumina-session-menu"
      style={{
        position: 'fixed',
        top: `${y}px`,
        left: `${x}px`,
        zIndex: 100010
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="lumina-session-menu-header">
        <span className="lumina-session-menu-title" title={session.title}>
          {session.title || 'Chat'}
        </span>
      </div>

      <div className="lumina-session-menu-divider" />

      <button
        className="lumina-session-menu-item"
        onClick={(e) => {
          e.stopPropagation()
          onRename()
          onClose()
        }}
      >
        <Pencil size={13} />
        <span>Rename</span>
      </button>

      <button
        className="lumina-session-menu-item"
        onClick={(e) => {
          e.stopPropagation()
          onTogglePin()
          onClose()
        }}
      >
        {session.isPinned ? (
          <>
            <PinOff size={13} />
            <span>Unpin</span>
          </>
        ) : (
          <>
            <Pin size={13} />
            <span>Pin to Top</span>
          </>
        )}
      </button>

      <button
        className="lumina-session-menu-item"
        onClick={(e) => {
          e.stopPropagation()
          onDuplicate()
          onClose()
        }}
      >
        <Copy size={13} />
        <span>Duplicate</span>
      </button>

      <button className="lumina-session-menu-item" onClick={handleExport}>
        <Download size={13} />
        <span>Copy as Markdown</span>
      </button>

      <div className="lumina-session-menu-divider" />

      <button
        className="lumina-session-menu-item"
        onClick={(e) => {
          e.stopPropagation()
          onClear()
          onClose()
        }}
      >
        <Eraser size={13} />
        <span>Clear Messages</span>
      </button>

      <button
        className="lumina-session-menu-item danger"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
          onClose()
        }}
      >
        <Trash2 size={13} />
        <span>Delete Chat</span>
      </button>
    </div>
  )
}

export default LuminaSessionMenu
