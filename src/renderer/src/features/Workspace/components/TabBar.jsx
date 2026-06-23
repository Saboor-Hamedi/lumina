import React, { useRef, useState, useCallback, useMemo, memo, useEffect } from 'react'
import { X, Pin, MoreHorizontal, ArrowRight, Trash2, Image, PanelLeftOpen, PanelLeftClose } from 'lucide-react'
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable'
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers'
import { Virtuoso } from 'react-virtuoso'
import { useVaultStore } from '../../../core/store/useVaultStore'
import ContextMenu from '../../Overlays/ContextMenu'
import PromptModal from '../../Overlays/PromptModal'
import IconModal from '../../Icons/IconModal'
import ColorModal from '../../Overlays/ColorModal'
import { getSnippetIcon } from '../../Icons/iconMapper'
import WindowControls from './WindowControls'
import ToolTip from '../../../components/atoms/ToolTip'

/**
 * SortableTabItem — draggable tab using @dnd-kit/sortable
 */
const SortableTabItem = memo(
  ({ id, snippet, isActive, isDirty, isPinned, onOpen, onClose, onContextMenu }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id,
      data: { snippet },
      disabled: isPinned
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
      <ToolTip text={getTitle()} position="bottom" delay={400}>
        <div
          ref={setNodeRef}
          className={`workspace-tab ${isActive ? 'active' : ''} ${isDirty ? 'is-dirty' : ''} ${isDragging ? 'dragging' : ''} ${isPinned ? 'pinned' : ''}`}
        style={{
          transform: transform ? `translate3d(${transform.x}px, 0, 0)` : undefined,
          transition: transition || undefined,
          opacity: isDragging ? 0.4 : 1
        }}
        {...attributes}
        {...listeners}
        onClick={() => onOpen(id)}
        onAuxClick={(e) => e.button === 1 && onClose(e, id)}
        onContextMenu={(e) => onContextMenu(e, id)}
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
            />
          ) : (
            !isPinned && (
              <button className="tab-close-btn" onClick={(e) => onClose(e, id)}>
                <X size={14} />
              </button>
            )
          )}
        </div>
      </div>
      </ToolTip>
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
const TabBar = ({ isSidebarOpen, onToggleSidebar, isLeftSidebarOpen, onToggleLeftSidebar }) => {
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
  const [iconPickerId, setIconPickerId] = useState(null)
  const tabbarRef = useRef(null)
  const virtuosoRef = useRef(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5
      }
    })
  )

  // Auto-scroll to active tab when it changes
  useEffect(() => {
    if (!tabbarRef.current || !activeTabId) return
    
    // Use requestAnimationFrame to ensure DOM is updated and painted
    requestAnimationFrame(() => {
      if (!tabbarRef.current) return
      
      const activeTabElement = tabbarRef.current.querySelector('.workspace-tab.active')
      if (activeTabElement) {
        // Scroll the tabbar so the active tab is visible
        const containerRect = tabbarRef.current.getBoundingClientRect()
        const tabRect = activeTabElement.getBoundingClientRect()
        
        // If the tab is partially or fully out of view to the left or right, scroll it
        if (tabRect.left < containerRect.left || tabRect.right > containerRect.right) {
          const scrollLeftTarget = tabbarRef.current.scrollLeft + (tabRect.left - containerRect.left) - (containerRect.width / 2) + (tabRect.width / 2)
          tabbarRef.current.scrollTo({ left: scrollLeftTarget, behavior: 'smooth' })
        }
      }
    })
  }, [activeTabId, openTabs])

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
  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event
      if (!active || !over || active.id === over.id) return

      const oldIndex = openTabs.indexOf(active.id)
      const newIndex = openTabs.indexOf(over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(openTabs, oldIndex, newIndex)
      reorderTabs(reordered)
    },
    [openTabs, reorderTabs]
  )

  // Handle mouse wheel scrolling for the tab bar
  const handleWheel = useCallback((e) => {
    if (!tabbarRef.current) return
    // Only intercept vertical scrolls (deltaY) and convert to horizontal scroll
    if (e.deltaY !== 0 && e.deltaX === 0) {
      tabbarRef.current.scrollLeft += e.deltaY
    }
  }, [])

  if (openTabs.length === 0) {
    return <WindowControls isSidebarOpen={isSidebarOpen} onToggleSidebar={onToggleSidebar} />
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd} collisionDetection={closestCenter} modifiers={[restrictToHorizontalAxis]}>
      <div
        className="tabbar-outer-wrapper"
        style={{ display: 'flex', width: '100%', position: 'relative', flexShrink: 0, minWidth: 0 }}
      >
        <div
          className="workspace-tabbar"
          ref={tabbarRef}
          onWheel={handleWheel}
          style={{ flex: 1, paddingLeft: onToggleLeftSidebar ? '44px' : '0', minWidth: 0 }}
        >
          <SortableContext items={openTabs} strategy={horizontalListSortingStrategy}>
            <div className="tabs-container" style={{ display: 'flex', height: '100%', alignItems: 'stretch' }}>
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

        {/* Floating Left Sidebar Toggle */}
        {onToggleLeftSidebar && (
          <div 
            className="window-controls-float-left" 
            style={{ 
              position: 'absolute', 
              left: 0, 
              top: 0, 
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              zIndex: 100,
              background: 'var(--bg-app)',
              padding: '0 8px',
              borderBottomRightRadius: '6px',
              WebkitAppRegion: 'no-drag'
            }}
          >
            <ToolTip text={isLeftSidebarOpen ? "Close Left Sidebar" : "Open Left Sidebar"} position="bottom">
              <button 
                onClick={onToggleLeftSidebar} 
                className="control-btn"
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: 'var(--text-muted)', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px'
                }}
                onMouseOver={(e) => { e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.background = 'var(--bg-active)'; }}
                onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
              >
                {isLeftSidebarOpen ? <PanelLeftClose size={16} strokeWidth={1.5} /> : <PanelLeftOpen size={16} strokeWidth={1.5} />}
              </button>
            </ToolTip>
          </div>
        )}

        {/* Floating Window Controls */}
        <WindowControls isSidebarOpen={isSidebarOpen} onToggleSidebar={onToggleSidebar} />
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
            {
              label: 'Change Icon',
              icon: <Image size={14} />,
              onClick: () => setIconPickerId(contextMenu.id)
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

      <IconModal
        isOpen={!!iconPickerId}
        onClose={() => setIconPickerId(null)}
        currentIcon={snippetMap.get(iconPickerId)?.customIcon}
        onSelect={(iconName) => {
          const s = snippetMap.get(iconPickerId)
          if (s) saveSnippet({ ...s, customIcon: iconName })
        }}
      />
    </DndContext>
  )
}

export default TabBar
