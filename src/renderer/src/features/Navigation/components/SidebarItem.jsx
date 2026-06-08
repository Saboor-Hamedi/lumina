import React, { useState, useRef, useEffect } from 'react'
import { Star, Trash2, Edit2, Pin, ExternalLink, Palette } from 'lucide-react'
import { useVaultStore } from '../../../core/store/useVaultStore'
import ContextMenu from '../../Overlays/ContextMenu'
import ConfirmModal from '../../Overlays/ConfirmModal'
import ColorModal from '../../Overlays/ColorModal'
import { getSnippetIcon } from '../../../core/utils/fileIconMapper.jsx'

const SidebarItem = ({ snippet, isActive, onClick, style }) => {
  const { dirtySnippetIds, deleteSnippet, saveSnippet } = useVaultStore()
  const isDirty = dirtySnippetIds.includes(snippet.id)

  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(snippet.title)
  const [contextMenu, setContextMenu] = useState(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
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
      const updatedSnippet = await saveSnippet({ ...snippet, title: renameValue.trim() })
      if (updatedSnippet?.title) {
        setRenameValue(updatedSnippet.title)
      }
      setIsRenaming(false)
    } catch (error) {
      console.error('Failed to rename note:', error)
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

  const handleDeleteConfirm = async () => {
    if (!snippet?.id) return
    try {
      await deleteSnippet(snippet.id, true)
    } catch (error) {
      console.error('Failed to delete note:', error)
    }
  }

  const noteColor = snippet.color
  const displayColor = noteColor ? `#${noteColor}` : null

  const getIcon = () => {
    return getSnippetIcon(snippet, 14, 'item-icon', displayColor)
  }

  const menuOptions = [
    { label: snippet.isPinned ? 'Unpin Note' : 'Pin to Top', icon: <Pin size={14} />, onClick: handleTogglePin },
    { label: 'Rename', icon: <Edit2 size={14} />, onClick: () => setIsRenaming(true) },
    { label: 'Color', icon: <Palette size={14} />, onClick: () => setShowColorPicker(true) },
    { label: 'Show in Explorer', icon: <ExternalLink size={14} />, onClick: () => window.api?.openVaultFolder?.() },
    { type: 'divider' },
    { label: 'Delete', icon: <Trash2 size={14} />, danger: true, onClick: () => setShowDeleteConfirm(true) }
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
      <span className="item-icon-wrap" style={displayColor ? { color: displayColor } : undefined}>{getIcon()}</span>
      {displayColor && <span className="item-color-accent" style={{ background: displayColor }} />}

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
        <span className="item-title" style={displayColor ? { color: displayColor } : undefined}>{snippet.title || 'Untitled'}</span>
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

      <ColorModal
        isOpen={showColorPicker}
        onClose={() => setShowColorPicker(false)}
        currentColor={snippet.color}
        onSelect={(colorId) => saveSnippet({ ...snippet, color: colorId })}
      />

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Note?"
        message={`Are you sure you want to delete "${snippet.title}"? This cannot be undone.`}
      />
    </div>
  )
}

export default SidebarItem
