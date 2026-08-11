import React, { useState, useRef, useEffect } from 'react'
import { Star, StarOff, Trash2, Edit2, Pin, ExternalLink, Palette, Image, Folder, FileText, Copy, Scissors, Clipboard, Check, X } from 'lucide-react'
import { useVaultStore } from '../../../core/store/useVaultStore'
import { useSettingsStore } from '../../../core/store/useSettingsStore'
import ContextMenu from '../../Overlays/ContextMenu'
import ConfirmModal from '../../Overlays/Modals/ConfirmModal'
import IconModal from '../../Icons/IconModal'
import ToolTip from '../../../components/atoms/ToolTip'
import { getSnippetIcon } from '../../Icons/iconMapper'
import { useShallow } from 'zustand/react/shallow'
import { getHighlightRegex } from '../../../core/utils/searchRanker'
import { useContextMenu } from '../hooks/useContextMenu'

const SidebarItem = ({
  snippet,
  isActive,
  onClick,
  style,
  variant = 'list',
  dndProps,
  searchQuery,
  matchSnippet
}) => {
  const { dirtySnippetIds, deleteSnippet, saveSnippet } = useVaultStore(
    useShallow((state) => ({
      dirtySnippetIds: state.dirtySnippetIds,
      deleteSnippet: state.deleteSnippet,
      saveSnippet: state.saveSnippet
    }))
  )
  const { togglePinnedFolder } = useSettingsStore(
    useShallow((state) => ({
      togglePinnedFolder: state.togglePinnedFolder
    }))
  )
  const isDirty = dirtySnippetIds.includes(snippet.id)
  const displayColor = snippet.color || null

  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(snippet.title)
  const [contextMenu, setContextMenu] = useState(null)
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

  const getIcon = () => {
    if (snippet.itemType === 'folder') {
      return (
        <div className="item-icon">
          <Folder size={14} fill="var(--text-accent)" color="var(--text-accent)" />
        </div>
      )
    }
    return getSnippetIcon(snippet, 14, 'item-icon')
  }

  const highlightText = (text, query) => {
    if (!query?.trim() || !text) return text || ''
    const regex = getHighlightRegex(query)
    if (!regex) return text
    const parts = text.split(regex)
    return (
      <>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <span key={i} className="cm-search-highlight">
              {part}
            </span>
          ) : (
            part
          )
        )}
      </>
    )
  }

  const menuOptions = useContextMenu({
    item: snippet,
    type: 'file',
    callbacks: {
      onOpen: onClick,
      onRename: () => setIsRenaming(true),
      onTogglePin: handleTogglePin,
      onDelete: () => setShowDeleteConfirm(true),
      onClose: () => setContextMenu(null)
    }
  })

  const modals = (
    <>
      {contextMenu && (
        <ContextMenu {...contextMenu} options={menuOptions} onClose={() => setContextMenu(null)} />
      )}

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
          if (e.button !== 0) return // Ensure only left clicks trigger selection
          if (!isRenaming && onClick) onClick(e)
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          handleContextMenu(e)
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onDoubleClick={() => setIsRenaming(true)}
        style={style}
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
          <ToolTip text={snippet.title || 'Untitled'} position="bottom" delay={600}>
            <span className="item-label" style={displayColor ? { color: displayColor } : undefined}>
              {highlightText(snippet.title || 'Untitled', searchQuery)}
            </span>
          </ToolTip>
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
        if (e.button !== 0) return
        if (!isRenaming && onClick) onClick(e)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        handleContextMenu(e)
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={() => setIsRenaming(true)}
      style={{
        ...style,
        backgroundColor: isActive ? 'var(--bg-active)' : undefined
      }}
      {...(dndProps?.attributes || {})}
      {...(dndProps?.listeners || {})}
    >
      <span className="item-icon-wrap" style={{ flexShrink: 0 }}>
        {getIcon()}
      </span>

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
        <div
          className="item-title-col"
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}
        >
          <ToolTip text={snippet.title || 'Untitled'} position="bottom" delay={600}>
            <span
              className="item-title"
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'block',
                ...(displayColor ? { color: displayColor } : isActive ? { color: 'var(--text-accent)' } : {})
              }}
            >
              {highlightText(snippet.title || 'Untitled', searchQuery)}
            </span>
          </ToolTip>
          {matchSnippet && searchQuery?.trim() && (
            <span
              className="item-search-preview"
              style={{
                fontSize: '10px',
                color: 'var(--text-faint)',
                opacity: 0.65,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginTop: '1px',
                lineHeight: 1.3
              }}
            >
              {highlightText(matchSnippet, searchQuery)}
            </span>
          )}
        </div>
      )}

      <div className="item-meta-right">
        {(isHovered || snippet.isPinned) && !isRenaming && (
          <div className={`hover-actions ${snippet.isPinned ? 'is-pinned' : ''}`}>
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
