import React, { useState, useRef, useEffect } from 'react'
import {
  Star,
  Folder
} from 'lucide-react'
import { useWorkspaceStore } from '../../../core/store/workspaceStore'
import { useSettingsStore } from '../../../core/store/SettingStore'
import ContextMenu from '../../modals/ContextMenu'
import Confirm from '../../modals/Confirm'
import IconPicker from '../../Icons/IconPicker'
import ToolTip from '../../../components/atoms/ToolTip'
import FileHoverPreview from '../../Explorer/components/FileHoverPreview'
import { getSnippetIcon } from '../../Icons/FileIcon'
import { useShallow } from 'zustand/react/shallow'
import { getHighlightRegex } from '../../../core/utils/searchRanker'
import { useContextMenu } from '../hooks/useContextMenu'
import { isSnippetActive } from '../../Explorer/utils/explorerSelectionHelper'
import { useUnsaved, UnsavedIndicator } from '../../../core/hooks/unsave'

export interface SidebarItemProps {
  snippet: any
  isActive?: boolean
  onClick?: (e?: any, extra?: any) => void
  onContextMenu?: (snippet: any, e: React.MouseEvent) => void
  style?: React.CSSProperties
  variant?: 'list' | 'grid'
  dndProps?: {
    attributes?: any
    listeners?: any
    setNodeRef?: (node: any) => void
  }
  searchQuery?: string
  matchSnippet?: string
  isDropOver?: boolean
  depth?: number
}

interface SnippetContextMenuProps {
  contextMenu: { x: number; y: number }
  snippet: any
  onClick?: (e?: any) => void
  setIsRenaming: (val: boolean) => void
  setShowIconPicker: (val: boolean) => void
  handleTogglePin: (e?: any) => void
  setShowDeleteConfirm: (val: boolean) => void
  onClose: () => void
}

const SnippetContextMenu: React.FC<SnippetContextMenuProps> = ({
  contextMenu,
  snippet,
  onClick,
  setIsRenaming,
  setShowIconPicker,
  handleTogglePin,
  setShowDeleteConfirm,
  onClose
}) => {
  const menuOptions = useContextMenu({
    item: snippet,
    type: 'file',
    callbacks: {
      onOpen: onClick,
      onRename: () => setIsRenaming(true),
      onChangeIcon: () => setShowIconPicker(true),
      onTogglePin: handleTogglePin,
      onDelete: () => setShowDeleteConfirm(true),
      onCloseNote: () => (useWorkspaceStore.getState() as any).closeTab(snippet.id),
      onClose
    }
  })

  return <ContextMenu {...contextMenu} options={menuOptions} onClose={onClose} />
}

export const SidebarItem: React.FC<SidebarItemProps> = ({
  snippet,
  isActive,
  onClick,
  onContextMenu,
  style,
  variant = 'list',
  dndProps,
  searchQuery,
  matchSnippet,
  isDropOver
}) => {
  const { deleteSnippet, saveSnippet, selectedSnippet, activeTabId } = useWorkspaceStore(
    useShallow((state: any) => ({
      deleteSnippet: state.deleteNote,
      saveSnippet: state.saveNote,
      selectedSnippet: state.selectedNote,
      activeTabId: state.activeTabId
    }))
  )
  const { togglePinnedFolder } = useSettingsStore(
    useShallow((state: any) => ({
      togglePinnedFolder: state.togglePinnedFolder
    }))
  )
  const { isUnsaved: isDirty } = useUnsaved(snippet?.id)
  const displayColor = snippet?.color || null
  const isItemPinned = snippet?.isPinned === true || snippet?.isPinned === 'true'

  const computedIsActive =
    isActive !== undefined
      ? isActive
      : isSnippetActive({
          snippetId: snippet?.id,
          activeSnippetId: selectedSnippet?.id || (activeTabId !== '__graph__' ? activeTabId : null)
        })

  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(snippet?.title || '')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const renameInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.select()
    }
  }, [isRenaming])

  const handleRename = async () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== snippet.title) {
      const api = (window as any).api
      if (snippet.type === 'image') {
        const ext = snippet.ext || (snippet.fileName ? `.${snippet.fileName.split('.').pop()}` : '')
        let targetFileName = trimmed
        if (ext && !targetFileName.toLowerCase().endsWith(ext.toLowerCase())) {
          targetFileName = `${targetFileName}${ext}`
        }
        const normFolder = (snippet.folderId || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
        const oldRel = snippet.relativePath || (normFolder ? `${normFolder}/${snippet.fileName}` : snippet.fileName)
        const newRel = normFolder ? `${normFolder}/${targetFileName}` : targetFileName
        if (oldRel !== newRel) {
          try {
            await api?.moveFile?.(oldRel, newRel)
            const loadWorkspace = (useWorkspaceStore.getState() as any).loadWorkspace
            await loadWorkspace?.()

            const freshSnippets = (useWorkspaceStore.getState() as any).notes || []
            const newSnippet = freshSnippets.find(
              (s: any) => s.relativePath === newRel || (s.fileName === targetFileName && (s.folderId || '') === (snippet.folderId || ''))
            )

            if (newSnippet) {
              useWorkspaceStore.setState((state: any) => {
                const nextTabs = state.openTabs.map((tid: string) => (tid === snippet.id ? newSnippet.id : tid))
                const nextActiveId = state.activeTabId === snippet.id ? newSnippet.id : state.activeTabId
                const nextPinned = state.pinnedTabIds.map((pid: string) => (pid === snippet.id ? newSnippet.id : pid))
                const nextSelected = state.selectedNote?.id === snippet.id ? newSnippet : state.selectedNote
                return {
                  openTabs: nextTabs,
                  activeTabId: nextActiveId,
                  pinnedTabIds: nextPinned,
                  selectedNote: nextSelected
                }
              })
            }
          } catch (err) {
            console.error('Failed to rename image:', err)
          }
        }
      } else if (snippet.type === 'pdf') {
        const base = trimmed.replace(/\.[^/.]+$/, '').trim() || 'Untitled'
        const targetFileName = `${base}.pdf`
        const normFolder = (snippet.folderId || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
        const oldRel = snippet.relativePath || (normFolder ? `${normFolder}/${snippet.fileName}` : snippet.fileName)
        const newRel = normFolder ? `${normFolder}/${targetFileName}` : targetFileName
        if (oldRel !== newRel) {
          try {
            await api?.moveFile?.(oldRel, newRel)
            const loadWorkspace = (useWorkspaceStore.getState() as any).loadWorkspace
            await loadWorkspace?.()

            const freshSnippets = (useWorkspaceStore.getState() as any).notes || []
            const newSnippet = freshSnippets.find(
              (s: any) =>
                s.relativePath === newRel ||
                (s.fileName === targetFileName && (s.folderId || '') === (snippet.folderId || ''))
            )

            if (newSnippet) {
              useWorkspaceStore.setState((state: any) => {
                const nextTabs = state.openTabs.map((tid: string) => (tid === snippet.id ? newSnippet.id : tid))
                const nextActiveId = state.activeTabId === snippet.id ? newSnippet.id : state.activeTabId
                const nextPinned = state.pinnedTabIds.map((pid: string) => (pid === snippet.id ? newSnippet.id : pid))
                const nextSelected =
                  state.selectedNote?.id === snippet.id ? newSnippet : state.selectedNote
                return {
                  openTabs: nextTabs,
                  activeTabId: nextActiveId,
                  pinnedTabIds: nextPinned,
                  selectedNote: nextSelected
                }
              })
            }
          } catch (err) {
            console.error('Failed to rename PDF:', err)
          }
        }
      } else {
        await saveSnippet({ ...snippet, title: trimmed })
      }
    }
    setIsRenaming(false)
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (onContextMenu) {
      onContextMenu(snippet, e)
      return
    }
    if (snippet.itemType === 'folder') return
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleTogglePin = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    if (!snippet?.id) return
    if (snippet.itemType === 'folder') {
      togglePinnedFolder(snippet.id)
      return
    }
    if (snippet.type === 'image' || snippet.type === 'pdf') return
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

  const highlightText = (text: string, query?: string) => {
    if (!query?.trim() || !text) return text || ''
    const regex = getHighlightRegex(query)
    if (!regex) return text
    const parts = text.split(regex)
    return (
      <>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <mark key={i} className="palette-match">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    )
  }

  const getNoteTooltipContent = (item: any) => {
    if (!item) return ''
    if (item.itemType === 'folder') {
      return item.title || 'Folder'
    }
    return <FileHoverPreview item={item} />
  }


  const modals = (
    <>
      {contextMenu && (
        <SnippetContextMenu
          contextMenu={contextMenu}
          snippet={snippet}
          onClick={onClick}
          setIsRenaming={setIsRenaming}
          setShowIconPicker={setShowIconPicker}
          handleTogglePin={handleTogglePin}
          setShowDeleteConfirm={setShowDeleteConfirm}
          onClose={() => setContextMenu(null)}
        />
      )}
      {showIconPicker && (
        <IconPicker
          isOpen={showIconPicker}
          onClose={() => setShowIconPicker(false)}
          currentIcon={snippet.customIcon}
          onSelect={(iconName: string) => saveSnippet({ ...snippet, customIcon: iconName })}
        />
      )}

      {showDeleteConfirm && (
        <Confirm
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDeleteConfirm}
          title="Delete Note?"
          message={`Are you sure you want to delete "${snippet.title}"? This cannot be undone.`}
        />
      )}
    </>
  )

  if (variant === 'grid') {
    return (
      <div
        ref={dndProps?.setNodeRef}
        className={`start-grid-item ${computedIsActive ? 'active' : ''}`}
        onClick={(e) => {
          if (e.button !== 0) return
          if (!isRenaming && onClick) onClick(e)
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          handleContextMenu(e)
        }}
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
          <ToolTip text={() => getNoteTooltipContent(snippet)} position="bottom" delay={150}>
            <span className="item-label" style={displayColor ? { color: displayColor } : undefined}>
              {highlightText(snippet.title || 'Untitled', searchQuery)}
            </span>
          </ToolTip>
        )}

        {modals}
      </div>
    )
  }

  const hasSearchPreview = Boolean(matchSnippet && searchQuery?.trim())

  return (
    <div
      ref={dndProps?.setNodeRef}
      className={`tree-item ${computedIsActive ? 'active' : ''} ${isDirty ? 'is-dirty' : ''} ${hasSearchPreview ? 'has-search-preview' : ''} ${isDropOver ? 'drop-over' : ''}`}
      onClick={(e) => {
        if (e.button !== 0) return
        if (!isRenaming && onClick) onClick(e)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        handleContextMenu(e)
      }}
      onDoubleClick={() => setIsRenaming(true)}
      style={{
        ...style,
        backgroundColor: isActive ? 'var(--bg-active)' : undefined
      }}
      {...(dndProps?.attributes || {})}
      {...(dndProps?.listeners || {})}
      draggable={!isRenaming}
      onDragStart={(e) => {
        try {
          e.dataTransfer.setData('application/lumina-snippet', JSON.stringify(snippet))
          e.dataTransfer.setData('text/plain', snippet.title || '')
          e.dataTransfer.effectAllowed = 'copyMove'
        } catch (err) {}
      }}
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
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}
        >
          <ToolTip text={() => getNoteTooltipContent(snippet)} position="right" delay={150}>
            <span
              className="item-title"
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'block',
                width: '100%',
                ...(displayColor
                  ? { color: displayColor }
                  : (!searchQuery?.trim() && isActive)
                    ? { color: 'var(--text-accent)' }
                    : {})
              }}
            >
              {highlightText(snippet.title || 'Untitled', searchQuery)}
            </span>
          </ToolTip>
          {hasSearchPreview && (
            <span
              className="item-search-preview"
              style={{
                fontSize: '11px',
                color: 'var(--text-muted, #94a3b8)',
                opacity: 0.8,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginTop: '1px',
                lineHeight: 1.3
              }}
            >
              {highlightText(matchSnippet || '', searchQuery)}
            </span>
          )}
        </div>
      )}

      {(!isRenaming || isDirty) && (
        <div className="item-meta-right" style={{ display: 'flex', alignItems: 'center', flexShrink: 0, gap: '4px' }}>
          {!isRenaming && (
            <ToolTip text={isItemPinned ? 'Remove from Favorites' : 'Add to Favorites'}>
              <span
                className={`item-icon-wrap item-favorite-icon ${isItemPinned ? 'is-pinned' : ''}`}
                onClick={handleTogglePin}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                role="button"
                tabIndex={-1}
              >
                <Star size={13} strokeWidth={2} fill={isItemPinned ? 'currentColor' : 'none'} />
              </span>
            </ToolTip>
          )}
          {isDirty && <UnsavedIndicator />}
        </div>
      )}

      {modals}
    </div>
  )
}

export default React.memo(SidebarItem, (prev, next) => {
  return (
    prev.snippet?.id === next.snippet?.id &&
    prev.snippet?.title === next.snippet?.title &&
    prev.snippet?.color === next.snippet?.color &&
    prev.snippet?.customIcon === next.snippet?.customIcon &&
    prev.snippet?.isPinned === next.snippet?.isPinned &&
    prev.isActive === next.isActive &&
    prev.searchQuery === next.searchQuery &&
    prev.matchSnippet === next.matchSnippet &&
    prev.isDropOver === next.isDropOver &&
    prev.variant === next.variant &&
    prev.style === next.style
  )
})
