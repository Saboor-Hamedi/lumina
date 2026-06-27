import React, { useState, useRef, useEffect } from 'react'
import { Star, Trash2, Edit2, Pin, ExternalLink, Palette, Image, Folder } from 'lucide-react'
import { useVaultStore } from '../../../core/store/useVaultStore'
import { useSettingsStore } from '../../../core/store/useSettingsStore'
import ContextMenu from '../../Overlays/ContextMenu'
import ConfirmModal from '../../Overlays/ConfirmModal'
import ColorModal from '../../Overlays/ColorModal'
import IconModal from '../../Icons/IconModal'
import ToolTip from '../../../components/atoms/ToolTip'
import { getSnippetIcon } from '../../Icons/iconMapper'

const SidebarItem = ({
  snippet,
  isActive,
  onClick,
  style,
  variant = 'list',
  dndProps,
  searchQuery
}) => {
  const { dirtySnippetIds, deleteSnippet, saveSnippet } = useVaultStore()
  const { togglePinnedFolder } = useSettingsStore()
  const isDirty = dirtySnippetIds.includes(snippet.id)

  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(snippet.title)
  const [contextMenu, setContextMenu] = useState(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const renameInputRef = useRef(null)

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.select()
    }
  }, [isRenaming])

  const handleRename = async () => {
    if (renameValue.trim() && renameValue !== snippet.title) {
      await saveSnippet({ ...snippet, title: renameValue })
    }
    setIsRenaming(false)
  }

  const handleContextMenu = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (snippet.itemType === 'folder') return // no context menu on favorite folders in the list for now
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleTogglePin = async (e) => {
    if (e) e.stopPropagation()
    if (!snippet?.id) return
    if (snippet.itemType === 'folder') {
      togglePinnedFolder(snippet.id)
      return
    }
    try {
      await saveSnippet({ ...snippet, isPinned: !snippet.isPinned })
      setContextMenu(null)
    } catch (error) {
      console.error('Failed to toggle pin:', error)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!snippet?.id || snippet.itemType === 'folder') return
    try {
      await deleteSnippet(snippet.id, true)
    } catch (error) {
      console.error('Failed to delete note:', error)
    }
  }

  const noteColor = snippet.color
  const displayColor = noteColor ? `#${noteColor}` : null

  const getIcon = () => {
    if (snippet.itemType === 'folder') {
      return (
        <div className="item-icon">
          <Folder size={14} fill={displayColor || "#e8a825"} color={displayColor || "#e8a825"} />
        </div>
      )
    }
    return getSnippetIcon(snippet, 14, 'item-icon', displayColor)
  }

  const highlightText = (text, query) => {
    if (!query || !text) return text
    const q = query.toLowerCase()
    const idx = text.toLowerCase().indexOf(q)
    if (idx === -1) return text
    return (
      <>
        {text.substring(0, idx)}
        <span className="cm-search-highlight">{text.substring(idx, idx + query.length)}</span>
        {text.substring(idx + query.length)}
      </>
    )
  }

  const menuOptions = [
    {
      label: snippet.isPinned ? 'Remove from Favorites' : 'Add to Favorites',
      icon: <Star size={14} />,
      onClick: handleTogglePin
    },
    { label: 'Rename', icon: <Edit2 size={14} />, onClick: () => setIsRenaming(true) },
    { label: 'Color', icon: <Palette size={14} />, onClick: () => setShowColorPicker(true) },
    { label: 'Change Icon', icon: <Image size={14} />, onClick: () => setShowIconPicker(true) },
    {
      label: 'Show in Explorer',
      icon: <ExternalLink size={14} />,
      onClick: () => window.api?.openVaultFolder?.()
    },
    { type: 'divider' },
    {
      label: 'Delete',
      icon: <Trash2 size={14} />,
      danger: true,
      onClick: () => setShowDeleteConfirm(true)
    }
  ]

  const modals = (
    <>
      {contextMenu && (
        <ContextMenu {...contextMenu} options={menuOptions} onClose={() => setContextMenu(null)} />
      )}

      <ColorModal
        isOpen={showColorPicker}
        onClose={() => setShowColorPicker(false)}
        currentColor={snippet.color}
        onSelect={(colorId) => saveSnippet({ ...snippet, color: colorId })}
      />

      <IconModal
        isOpen={showIconPicker}
        onClose={() => setShowIconPicker(false)}
        currentIcon={snippet.customIcon}
        onSelect={(iconName) => saveSnippet({ ...snippet, customIcon: iconName })}
      />

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Note?"
        message={`Are you sure you want to delete "${snippet.title}"? This cannot be undone.`}
      />
    </>
  )

  if (variant === 'grid') {
    return (
      <div
        ref={dndProps?.setNodeRef}
        className="start-grid-item"
        onClick={(e) => {
          if (e.button !== 0) return; // Ensure only left clicks trigger selection
          if (!isRenaming && onClick) onClick(e);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleContextMenu(e);
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onDoubleClick={() => setIsRenaming(true)}
        style={style}
        title={
          isRenaming
            ? ''
            : `${snippet.title.replace(/[*_"#~`\[\]()]/g, '').trim()}${isDirty ? ' (Unsaved changes)' : ''}`
        }
        {...(dndProps?.attributes || {})}
        {...(dndProps?.listeners || {})}
      >
        <div className="icon-container" style={displayColor ? { color: displayColor } : undefined}>
          {getIcon()}
        </div>

        {isRenaming ? (
          <input
            ref={renameInputRef}
            className="inline-rename-input grid-rename"
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
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="item-label" style={displayColor ? { color: displayColor } : undefined}>
            {highlightText(snippet.title || 'Untitled', searchQuery)}
          </span>
        )}

        {modals}
      </div>
    )
  }

  return (
    <div
      ref={dndProps?.setNodeRef}
      className={`tree-item ${isActive ? 'active' : ''} ${isDirty ? 'is-dirty' : ''}`}
      onClick={(e) => {
        if (e.button !== 0) return;
        if (!isRenaming && onClick) onClick(e);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleContextMenu(e);
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={() => setIsRenaming(true)}
      style={{
        ...style,
        backgroundColor: isActive ? 'var(--bg-active)' : undefined
      }}
      title={
        isRenaming
          ? ''
          : `${snippet.title.replace(/[*_"#~`\[\]()]/g, '').trim()}${isDirty ? ' (Unsaved changes)' : ''}`
      }
      {...(dndProps?.attributes || {})}
      {...(dndProps?.listeners || {})}
    >
      <span className="item-icon-wrap" style={displayColor ? { color: displayColor } : undefined}>
        {getIcon()}
      </span>
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
        <span className="item-title" style={displayColor ? { color: displayColor } : undefined}>
          {highlightText(snippet.title || 'Untitled', searchQuery)}
        </span>
      )}

      <div className="item-meta-right">
        {(isHovered || snippet.isPinned) && !isRenaming && (
          <div className="hover-actions">
            <ToolTip text={snippet.isPinned ? 'Remove from Favorites' : 'Add to Favorites'}>
              <button
                className="action-btn"
                onClick={handleTogglePin}
                style={{ color: snippet.isPinned ? '#fbbf24' : undefined }}
              >
                <Star size={12} fill={snippet.isPinned ? 'currentColor' : 'none'} />
              </button>
            </ToolTip>
          </div>
        )}
        {isDirty && <div className="dirty-indicator" />}
      </div>

      {modals}
    </div>
  )
}

export default SidebarItem
