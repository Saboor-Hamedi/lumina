import React, { useRef, useState, useCallback, useMemo, memo, useEffect } from 'react'
import { X, Pin, MoreHorizontal, ArrowRight, Trash2 } from 'lucide-react'
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import { SortableContext, useSortable, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { useVaultStore } from '../../../core/store/useVaultStore'
import ContextMenu from '../../Overlays/ContextMenu'
import PromptModal from '../../Overlays/PromptModal'
import WindowControls from './WindowControls'
import { getSnippetIcon } from '../../../core/utils/fileIconMapper.jsx'

/**
 * SortableTabItem — draggable tab using @dnd-kit/sortable
 */
const SortableTabItem = memo(
  ({
    id,
    snippet,
    isActive,
    isDirty,
    isPinned,
    onOpen,
    onClose,
    onContextMenu
  }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      isDragging
    } = useSortable({
      id,
      data: { snippet },
      disabled: isPinned,
    })

    const noteColor = snippet?.color
    const displayColor = noteColor ? `#${noteColor}` : null

    const getIcon = () => {
      if (isPinned) return <Pin size={12} className="tab-icon pinned-icon" />
      if (snippet) return getSnippetIcon(snippet, 12, 'tab-icon', displayColor)
      return null
    }

    const getTitle = () => snippet?.title || 'Untitled'

    return (
      <div
        ref={setNodeRef}
        className={`workspace-tab ${isActive ? 'active' : ''} ${isDirty ? 'is-dirty' : ''} ${isDragging ? 'dragging' : ''} ${isPinned ? 'pinned' : ''}`}
        style={{
          transform: transform?.x ? `translate3d(${transform.x}px, 0, 0)` : undefined,
          transition: isDragging ? 'none' : 'transform 200ms ease, opacity 200ms ease',
          opacity: isDragging ? 0.4 : 1,
        }}
        {...attributes}
        {...listeners}
        onClick={() => onOpen(id)}
        onAuxClick={(e) => e.button === 1 && onClose(e, id)}
        onContextMenu={(e) => onContextMenu(e, id)}
        title={getTitle()}
      >
        <div className="tab-context">
          {displayColor && <span className="tab-color-dot" style={{ background: displayColor }} />}
          {getIcon()}
          <span className="tab-title">{getTitle()}</span>
        </div>

        <div className="tab-actions">
          {isDirty ? (
            <div
              className="dirty-indicator tab-dirty"
              onClick={(e) => onClose(e, id)}
              title="Unsaved changes - click to close"
            />
          ) : (
            !isPinned && (
              <button className="tab-close-btn" onClick={(e) => onClose(e, id)} title="Close tab">
                <X size={14} />
              </button>
            )
          )}
        </div>
      </div>
    )
  }
)

SortableTabItem.displayName = 'SortableTabItem'

/**
 * TabBar Component
 * High-performance, premium workspace tab management.
 * Features: Native feel, DND reordering, context menus, and dirty-safety.
 * 
 * Supports regular snippet tabs with dirty-safety, pinned tabs, and DND reordering.
 */
const TabBar = () => {
  const {
    openTabs,
    activeTabId,
    snippets,
    setSelectedSnippet,
    closeTab,
    reorderTabs,
    closeOtherTabs,
    closeTabsToRight,
    closeAllTabs,
    togglePinTab,
    saveSnippet,
    dirtySnippetIds,
    pinnedTabIds
  } = useVaultStore()

  const [contextMenu, setContextMenu] = useState(null)
  const [prompt, setPrompt] = useState(null)
  const tabbarRef = useRef(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  )

  // Auto-scroll to active tab when it changes
  useEffect(() => {
    if (!tabbarRef.current || !activeTabId) return
    const activeTab = tabbarRef.current.querySelector('.workspace-tab.active')
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }
  }, [activeTabId])

  // O(1) Snippet Lookup Map for Performance
  const snippetMap = useMemo(() => {
    const map = new Map()
    snippets.forEach((s) => map.set(s.id, s))
    return map
  }, [snippets])

  const handleTabClick = useCallback(
    (id) => {
      const snippet = snippetMap.get(id)
      if (snippet) setSelectedSnippet(snippet)
    },
    [snippetMap, setSelectedSnippet]
  )

  const handleCloseTrigger = useCallback(
    (e, id) => {
      e.stopPropagation()
      if (pinnedTabIds.includes(id)) return

      if (dirtySnippetIds.includes(id)) {
        const snippet = snippetMap.get(id)
        setPrompt({ id, title: snippet?.title || 'Untitled' })
      } else {
        closeTab(id)
      }
    },
    [pinnedTabIds, dirtySnippetIds, snippetMap, closeTab]
  )

  // --- Dirty Prompt Handlers ---
  const handleConfirmSave = async () => {
    if (!prompt) return
    const snippet = snippetMap.get(prompt.id)
    if (snippet) {
      await saveSnippet(snippet)
      closeTab(prompt.id)
    }
    setPrompt(null)
  }

  const handleDiscard = () => {
    if (prompt) closeTab(prompt.id)
    setPrompt(null)
  }

  const handleContextMenu = useCallback((e, id) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, id })
  }, [])

  // --- Sortable Drag Handler ---
  const handleDragEnd = useCallback((event) => {
    const { active, over } = event
    if (!active || !over || active.id === over.id) return

    const oldIndex = openTabs.indexOf(active.id)
    const newIndex = openTabs.indexOf(over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(openTabs, oldIndex, newIndex)
    reorderTabs(reordered)
  }, [openTabs, reorderTabs])

  if (openTabs.length === 0) {
    return <WindowControls />
  }

  return (
    <DndContext
      sensors={sensors}
      onDragEnd={handleDragEnd}
      collisionDetection={closestCenter}
    >
      <div className="tabbar-outer-wrapper" style={{ display: 'flex', width: '100%', position: 'relative' }}>
        <div className="workspace-tabbar" ref={tabbarRef} style={{ flex: 1 }}>
          <SortableContext items={openTabs} strategy={horizontalListSortingStrategy}>
            <div className="tabs-container" style={{ paddingRight: '160px' }}>
              {openTabs.map((id) => {
                const snippet = snippetMap.get(id)
                if (!snippet) return null

                return (
                  <SortableTabItem
                    key={id}
                    id={id}
                    snippet={snippet}
                    isActive={activeTabId === id}
                    isDirty={dirtySnippetIds.includes(id)}
                    isPinned={pinnedTabIds.includes(id)}
                    onOpen={handleTabClick}
                    onClose={handleCloseTrigger}
                    onContextMenu={handleContextMenu}
                  />
                )
              })}
            </div>
          </SortableContext>
        </div>
        
        {/* Floating Window Controls */}
        <WindowControls />
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          options={[
            {
              label: pinnedTabIds.includes(contextMenu.id) ? 'Unpin Tab' : 'Pin Tab',
              icon: <Pin size={14} />,
              onClick: () => togglePinTab(contextMenu.id)
            },
            { type: 'divider' },
            {
              label: 'Close',
              icon: <X size={14} />,
              disabled: pinnedTabIds.includes(contextMenu.id),
              onClick: () => handleCloseTrigger({ stopPropagation: () => {} }, contextMenu.id)
            },
            {
              label: 'Close Others',
              icon: <MoreHorizontal size={14} />,
              onClick: () => closeOtherTabs(contextMenu.id)
            },
            {
              label: 'Close Tabs to the Right',
              icon: <ArrowRight size={14} />,
              onClick: () => closeTabsToRight(contextMenu.id)
            },
            { type: 'divider' },
            {
              label: 'Close All',
              icon: <Trash2 size={14} />,
              danger: true,
              onClick: () => closeAllTabs()
            }
          ]}
        />
      )}

      <PromptModal
        isOpen={!!prompt}
        title="Unsaved Changes"
        message={`"${prompt?.title}" has unsaved changes. Do you want to save them before closing?`}
        confirmLabel="Save & Close"
        discardLabel="Discard"
        onClose={() => setPrompt(null)}
        onConfirm={handleConfirmSave}
        onDiscard={handleDiscard}
      />
    </DndContext>
  )
}

export default TabBar
