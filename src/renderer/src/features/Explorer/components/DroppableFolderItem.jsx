import React, { useEffect, useState } from 'react'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'

export const DroppableFolderItem = React.memo(
  ({
    item,
    isExpanded,
    onToggle,
    onContextMenu,
    folderColor,
    isRenaming,
    renameValue,
    setRenameValue,
    submitRename,
    cancelRename,
    isActive,
    searchQuery,
    isPinned,
    onTogglePin
  }) => {
    const { isOver, setNodeRef: setDroppableRef } = useDroppable({ id: `folder-${item.id}` })
    const [isHovered, setIsHovered] = useState(false)

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
    const {
      attributes,
      listeners,
      setNodeRef: setDraggableRef,
      isDragging
    } = useDraggable({
      id: `drag-folder-${item.id}`,
      data: { type: 'folder', item }
    })

    // Spring-loaded folder expansion
    useEffect(() => {
      let timer = null
      if (isOver && !isExpanded && !isRenaming) {
        timer = setTimeout(() => {
          onToggle(item.id, null)
        }, 600) // 600ms hover to expand
      }
      return () => {
        if (timer) clearTimeout(timer)
      }
    }, [isOver, isExpanded, isRenaming, item.id, onToggle])

    return (
      <div
        ref={setDroppableRef}
        className="folder-tree-item"
        style={{
          position: 'relative',
          paddingLeft: `${item.depth * 12}px`,
          opacity: isDragging ? 0.5 : 1
        }}
      >

        <div
          ref={setDraggableRef}
          className={`folder-tree-main ${isOver ? 'folder-over' : ''} ${isActive ? 'active' : ''}`}
          style={{
            cursor: 'pointer',
            userSelect: 'none',
            marginLeft: '5px',
            paddingLeft: '3px'
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          {...attributes}
          {...listeners}
          onClick={(e) => {
            if (e.button !== 0) return
            if (!isRenaming) onToggle(item.id, e)
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onContextMenu(item.id, e)
          }}
        >
          <span style={{ display: 'inline-flex', flexShrink: 0 }}>
            {isExpanded ? (
              <ChevronDown size={14} className="folder-chevron" />
            ) : (
              <ChevronRight size={14} className="folder-chevron" />
            )}
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: folderColor || undefined,
              padding: '2px 6px',
              marginLeft: '-6px',
              flex: 1,
              minWidth: 0,
              overflow: 'hidden'
            }}
          >
            <span style={{ display: 'inline-flex', flexShrink: 0 }}>
              {isExpanded ? (
                <FolderOpen
                  size={14}
                  fill={folderColor || '#e8a825'}
                  color={folderColor || '#e8a825'}
                />
              ) : (
                <Folder
                  size={14}
                  fill={folderColor || '#e8a825'}
                  color={folderColor || '#e8a825'}
                />
              )}
            </span>
            {isRenaming ? (
              <input
                autoFocus
                className="inline-create-input"
                defaultValue={renameValue}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitRename(e.target.value)
                  if (e.key === 'Escape') cancelRename()
                }}
                onBlur={(e) => submitRename(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <ToolTip text={item.name} position="bottom" delay={600}>
                <span
                  className="folder-name"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'block'
                  }}
                >
                  {highlightText(item.name, searchQuery)}
                </span>
              </ToolTip>
            )}
          </div>
          <div className="item-meta-right">
            {!isExpanded && !isRenaming && item.count !== undefined && item.count > 0 && (
              <span
                style={{
                  fontSize: '8px',
                  lineHeight: '10px',
                  color: 'var(--text-accent)',
                  background: 'transparent',
                  border: 'none',
                  padding: '0px 4px',
                  borderRadius: '6px',
                  marginRight: '4px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '14px',
                  height: '13px',
                  opacity: 0.8
                }}
              >
                {item.count}
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }
)

export default DroppableFolderItem
