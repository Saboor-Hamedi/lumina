import React, { useState, useRef, useEffect } from 'react'
import { Star, Trash2, Edit2, Pin, ExternalLink } from 'lucide-react'
import { useVaultStore } from '../../../core/store/useVaultStore'
import ContextMenu from '../../Overlays/ContextMenu'
import { getSnippetIcon } from '../../../core/utils/fileIconMapper.jsx'

/**
 * SidebarItem Component
 * Encapsulates the visual and logical state of a snippet entry in navigation lists.
 * Supports: Dirty indicators, custom icons, active states, and pinned status.
 */
const SidebarItem = ({ snippet, isActive, onClick, style }) => {
  const { dirtySnippetIds, deleteSnippet, saveSnippet } = useVaultStore()
  const isDirty = dirtySnippetIds.includes(snippet.id)

  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(snippet.title)
  const [contextMenu, setContextMenu] = useState(null)
  const [isHovered, setIsHovered] = useState(false)
  const renameInputRef = useRef(null)

  useEffect(() => {
    if (isRenaming) renameInputRef.current?.focus()
  }, [isRenaming])

  const handleRename = async () => {
    if (!renameValue.trim() || renameValue === snippet.title) {
      setIsRenaming(false)
      return
    }

    if (!snippet?.id) {
      console.error('Cannot rename: snippet ID is missing')
      setIsRenaming(false)
      return
    }

    try {
      // Save and get back the cleaned snippet
      const updatedSnippet = await saveSnippet({ ...snippet, title: renameValue.trim() })
      // Update renameValue with the cleaned title from backend
      if (updatedSnippet?.title) {
        setRenameValue(updatedSnippet.title)
      }
      setIsRenaming(false)
    } catch (error) {
      console.error('Failed to rename note:', error)
      // Restore original title on error
      setRenameValue(snippet.title)
      setIsRenaming(false)
    }
  }

  const handleContextMenu = (e) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleTogglePin = (e) => {
    e?.stopPropagation()
    saveSnippet({ ...snippet, isPinned: !snippet.isPinned })
  }

  const handleDelete = async (e) => {
    e?.stopPropagation()

    if (!snippet?.id) {
      console.error('Cannot delete: snippet ID is missing')
      return
    }

    try {
      await deleteSnippet(snippet.id, true)
    } catch (error) {
      console.error('Failed to delete note:', error)
    }
  }

  const getIcon = () => {
    return getSnippetIcon(snippet)
  }

  const menuOptions = [
    { label: snippet.isPinned ? 'Unpin Note' : 'Pin to Top', icon: <Pin size={14} />, onClick: handleTogglePin },
    { label: 'Rename', icon: <Edit2 size={14} />, onClick: () => setIsRenaming(true) },
    { label: 'Show in Explorer', icon: <ExternalLink size={14} />, onClick: () => window.api?.openVaultFolder?.() },
    { type: 'divider' },
    { label: 'Delete', icon: <Trash2 size={14} />, danger: true, onClick: handleDelete }
  ]

  return (
    <div
      className={`tree-item ${isActive ? 'active' : ''} ${isDirty ? 'is-dirty' : ''}`}
      onClick={isRenaming ? null : onClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={() => setIsRenaming(true)}
      style={style}
      title={isRenaming ? '' : `${snippet.title}${isDirty ? ' (Unsaved changes)' : ''}`}
    >
      {getIcon()}

      {isRenaming ? (
        <input
          ref={renameInputRef}
          className="inline-rename-input"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={handleRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRename()
            if (e.key === 'Escape') {
                setIsRenaming(false)
                setRenameValue(snippet.title)
            }
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="item-title">{snippet.title || 'Untitled'}</span>
      )}

      <div className="item-meta-right">
        {isHovered && !isRenaming && (
           <div className="hover-actions">
              <button
                className={`action-btn ${snippet.isPinned ? 'active' : ''}`}
                onClick={handleTogglePin}
                title={snippet.isPinned ? 'Unpin' : 'Pin'}
              >
                <Star size={12} fill={snippet.isPinned ? 'currentColor' : 'none'} />
              </button>
           </div>
        )}
        {isDirty && <div className="dirty-indicator" />}
        {snippet.isPinned && !isHovered && <Star size={10} fill="currentColor" className="pin-icon" />}
      </div>

      {contextMenu && (
        <ContextMenu
          {...contextMenu}
          options={menuOptions}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}

export default SidebarItem
