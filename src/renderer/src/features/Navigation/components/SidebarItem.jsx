import React, { useState, useRef, useEffect } from 'react'
import {
  Star,
  StarOff,
  Trash2,
  Edit2,
  Pin,
  ExternalLink,
  Palette,
  Image,
  Folder,
  FileText,
  Copy,
  Scissors,
  Clipboard,
  Check,
  X
} from 'lucide-react'
import { useVaultStore } from '../../../core/store/workspaceStore'
import { useSettingsStore } from '../../../core/store/useSettingsStore'
import ContextMenu from '../../modals/ContextMenu'
import ConfirmModal from '../../modals/ConfirmModal'
import IconPicker from '../../Icons/IconPicker'
import ToolTip from '../../../components/atoms/ToolTip'
import { getSnippetIcon } from '../../Icons/FileIcon'
import { useShallow } from 'zustand/react/shallow'
import { getHighlightRegex } from '../../../core/utils/searchRanker'
import { useContextMenu } from '../hooks/useContextMenu'

const SidebarItem = ({
  snippet,
  isActive,
  onClick,
  onContextMenu,
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
  const isItemPinned = snippet.isPinned === true || snippet.isPinned === 'true'

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
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== snippet.title) {
      if (snippet.type === 'image') {
        const ext = snippet.ext || (snippet.fileName ? `.${snippet.fileName.split('.').pop()}` : '')
        let targetFileName = trimmed
        if (ext && !targetFileName.toLowerCase().endsWith(ext.toLowerCase())) {
          targetFileName = `${targetFileName}${ext}`
        }
        const oldRel = snippet.folderId ? `${snippet.folderId}/${snippet.fileName}` : snippet.fileName
        const newRel = snippet.folderId ? `${snippet.folderId}/${targetFileName}` : targetFileName
        if (oldRel !== newRel) {
          try {
            await window.api?.moveFile?.(oldRel, newRel)
            const loadVault = useVaultStore.getState().loadVault
            await loadVault?.()

            const freshSnippets = useVaultStore.getState().snippets || []
            const newSnippet = freshSnippets.find(
              (s) => s.relativePath === newRel || (s.fileName === targetFileName && (s.folderId || '') === (snippet.folderId || ''))
            )

            if (newSnippet) {
              useVaultStore.setState((state) => {
                const nextTabs = state.openTabs.map((tid) => (tid === snippet.id ? newSnippet.id : tid))
                const nextActiveId = state.activeTabId === snippet.id ? newSnippet.id : state.activeTabId
                const nextPinned = state.pinnedTabIds.map((pid) => (pid === snippet.id ? newSnippet.id : pid))
                const nextSelected = state.selectedSnippet?.id === snippet.id ? newSnippet : state.selectedSnippet
                return {
                  openTabs: nextTabs,
                  activeTabId: nextActiveId,
                  pinnedTabIds: nextPinned,
                  selectedSnippet: nextSelected
                }
              })
            }
          } catch (err) {
            console.error('Failed to rename image:', err)
          }
        }
      } else {
        await saveSnippet({ ...snippet, title: trimmed })
      }
    }
    setIsRenaming(false)
  }

  const handleContextMenu = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (onContextMenu) {
      onContextMenu(snippet, e)
      return
    }
    if (snippet.itemType === 'folder') return
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleTogglePin = async (e) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    if (!snippet?.id) return
    if (snippet.itemType === 'folder') {
      togglePinnedFolder(snippet.id)
      return
    }
    if (snippet.type === 'image') return
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
        <Folder size={14} fill="var(--text-accent)" color="var(--text-accent)" className="item-icon" />
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

  const getNoteTooltipContent = (item) => {
    if (!item) return ''
    if (item.itemType === 'folder') {
      return item.title || 'Folder'
    }
    if (item.type === 'image') {
      const formatSize = (bytes) => {
        if (!bytes) return ''
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      }
      return (
        <div className="tooltip-card-preview">
          <div className="tooltip-card-header">
            <span className="tooltip-card-title">{item.title || 'Image'}</span>
          </div>
          <div className="tooltip-card-meta">
            <span className="tooltip-badge-folder">🖼️ Image</span>
            {item.size ? <span>· {formatSize(item.size)}</span> : null}
            {item.ext ? <span className="uppercase">· {item.ext.replace('.', '')}</span> : null}
          </div>
        </div>
      )
    }
    const title = item.title || 'Untitled Note'
    const rawContent = item.code || item.content || item.body || ''
    const cleanBody = rawContent
      .replace(/^#+\s+/gm, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\[\[(.*?)\]\]/g, '$1')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/[`*_\~>#]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    const wordCount = rawContent.trim() ? rawContent.trim().split(/\s+/).length : 0
    const readTime = Math.max(1, Math.ceil(wordCount / 200)) + 'm'
    const folderText = item.folderId && item.folderId !== 'root' ? item.folderId : null

    let tagsList = []
    if (item.tags) {
      if (Array.isArray(item.tags)) tagsList = item.tags
      else if (typeof item.tags === 'string') {
        tagsList = item.tags.split(',').map((t) => t.trim()).filter(Boolean)
      }
    }

    return (
      <div className="tooltip-card-preview">
        <div className="tooltip-card-header">
          <span className="tooltip-card-title">{title}</span>
        </div>
        <div className="tooltip-card-meta">
          {folderText && <span className="tooltip-badge-folder">📁 {folderText}</span>}
          <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
          <span>·</span>
          <span>{readTime} read</span>
        </div>
        {tagsList.length > 0 && (
          <div className="tooltip-card-tags">
            {tagsList.slice(0, 3).map((t, idx) => (
              <span key={idx} className="tooltip-tag">
                #{String(t).replace(/^#/, '')}
              </span>
            ))}
          </div>
        )}
        {cleanBody ? (
          <div className="tooltip-card-body">{cleanBody.slice(0, 180)}</div>
        ) : (
          <div className="tooltip-card-empty">Empty note</div>
        )}
      </div>
    )
  }

  const menuOptions = useContextMenu({
    item: snippet,
    type: 'file',
    callbacks: {
      onOpen: onClick,
      onRename: () => setIsRenaming(true),
      onChangeIcon: () => setShowIconPicker(true),
      onTogglePin: handleTogglePin,
      onDelete: () => setShowDeleteConfirm(true),
      onCloseNote: () => useVaultStore.getState().closeTab(snippet.id),
      onClose: () => setContextMenu(null)
    }
  })

  const modals = (
    <>
      {contextMenu && (
        <ContextMenu {...contextMenu} options={menuOptions} onClose={() => setContextMenu(null)} />
      )}

      <IconPicker
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
          <ToolTip text={getNoteTooltipContent(snippet)} position="bottom" delay={100}>
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
          placeholder="Note title..."
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
          style={{
            flex: 1,
            minWidth: 0,
            width: '100%'
          }}
        />
      ) : (
        <div
          className="item-title-col"
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}
        >
          <ToolTip text={getNoteTooltipContent(snippet)} position="right" delay={100}>
            <span
              className="item-title"
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'block',
                ...(displayColor
                  ? { color: displayColor }
                  : isActive
                    ? { color: 'var(--text-accent)' }
                    : {})
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

      <div className="item-meta-right" style={{ height: '100%', display: 'flex', alignItems: 'center' }}>
        {(isHovered || isItemPinned) && !isRenaming && (
          <div className={`hover-actions ${isItemPinned ? 'is-pinned' : ''}`} style={{ height: '100%', display: 'flex', alignItems: 'center' }}>
            <ToolTip text={isItemPinned ? 'Remove from Favorites' : 'Add to Favorites'}>
              <button
                className="action-btn"
                onClick={handleTogglePin}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  color: isItemPinned ? '#fbbf24' : undefined,
                  height: '24px',
                  width: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Star size={13} strokeWidth={2.2} fill={isItemPinned ? 'currentColor' : 'none'} />
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
