import React, { useRef, useState, useCallback, useMemo, memo } from 'react'
import { X, Pin, MoreHorizontal, ArrowRight, Trash2, Network } from 'lucide-react'
import { useVaultStore, GRAPH_TAB_ID } from '../../../core/store/useVaultStore'
import ContextMenu from '../../Overlays/ContextMenu'
import PromptModal from '../../Overlays/PromptModal'
import { getSnippetIcon } from '../../../core/utils/fileIconMapper.jsx'

/**
 * TabItem Component (Memoized for Performance)
 * Prevents unnecessary re-renders when other tabs change.
 */
const TabItem = memo(
  ({
    id,
    snippet,
    isActive,
    isDirty,
    isPinned,
    isDragging,
    onOpen,
    onClose,
    onContextMenu,
    onDragStart,
    onDragOver,
    onDragEnd
  }) => {
    /**
     * Get icon for the tab based on type and state
     * Uses fileIconMapper for consistent icon display across app
     * @returns {JSX.Element} Icon component
     */
    const getIcon = () => {
      // Special handling for Graph tab
      if (id === GRAPH_TAB_ID) return <Network size={12} className="tab-icon" />
      if (isPinned) return <Pin size={12} className="tab-icon pinned-icon" />
      
      // Use fileIconMapper for snippet tabs (same as sidebar)
      if (snippet) {
        return getSnippetIcon(snippet, 12, 'tab-icon')
      }
      
      // Fallback (shouldn't happen)
      return null
    }

    /**
     * Get title for the tab
     * @returns {string} Tab title
     */
    const getTitle = () => {
      // Special handling for Graph tab
      if (id === GRAPH_TAB_ID) return 'Graph View'
      return snippet?.title || 'Untitled'
    }

    return (
      <div
        className={`workspace-tab ${isActive ? 'active' : ''} ${isDirty ? 'is-dirty' : ''} ${isDragging ? 'dragging' : ''} ${isPinned ? 'pinned' : ''}`}
        onClick={() => onOpen(id)}
        onAuxClick={(e) => e.button === 1 && onClose(e, id)}
        onContextMenu={(e) => onContextMenu(e, id)}
        draggable={!isPinned}
        onDragStart={(e) => onDragStart(e, id)}
        onDragOver={(e) => onDragOver(e, id)}
        onDragEnter={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onDragEnd={onDragEnd}
        title={getTitle()}
      >
        <div className="tab-context">
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
                <X size={12} />
              </button>
            )
          )}
        </div>

        {isActive && <div className="tab-active-indicator" />}
      </div>
    )
  }
)

TabItem.displayName = 'TabItem'

/**
 * TabBar Component
 * High-performance, premium workspace tab management.
 * Features: Native feel, DND reordering, context menus, and dirty-safety.
 * 
 * Supports both regular snippet tabs and special tabs (like Graph View).
 * Special tabs are identified by special IDs (e.g., GRAPH_TAB_ID) and
 * are handled differently from snippet tabs (no dirty state, different icons).
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

  const [draggedId, setDraggedId] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [prompt, setPrompt] = useState(null)
  const lastReorderRef = useRef({ draggedId: null, targetId: null })

  // O(1) Snippet Lookup Map for Performance
  const snippetMap = useMemo(() => {
    const map = new Map()
    snippets.forEach((s) => map.set(s.id, s))
    return map
  }, [snippets])

  const handleTabClick = useCallback(
    (id) => {
      // Handle Graph tab specially
      if (id === GRAPH_TAB_ID) {
        useVaultStore.getState().openGraphTab()
        return
      }
      // Handle regular snippet tabs
      const snippet = snippetMap.get(id)
      if (snippet) setSelectedSnippet(snippet)
    },
    [snippetMap, setSelectedSnippet]
  )

  const handleCloseTrigger = useCallback(
    (e, id) => {
      e.stopPropagation()
      // Graph tab and pinned tabs cannot be closed with dirty check
      if (id === GRAPH_TAB_ID || pinnedTabIds.includes(id)) {
        if (id !== GRAPH_TAB_ID && pinnedTabIds.includes(id)) return
        // Graph tab can be closed directly
        if (id === GRAPH_TAB_ID) {
          closeTab(id)
          return
        }
      }

      // Regular tabs: check for dirty state
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

  // --- Drag & Drop ---
  const onDragStart = useCallback((e, id) => {
    setDraggedId(id)
    lastReorderRef.current = { draggedId: id, targetId: null }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDragOver = useCallback(
    (e, targetId) => {
      e.preventDefault()
      e.stopPropagation()
      
      if (draggedId === null || draggedId === targetId) return
      
      // Prevent reordering if we're already at this target (prevents rapid reordering)
      if (lastReorderRef.current.draggedId === draggedId && 
          lastReorderRef.current.targetId === targetId) {
        return
      }

      const draggedIdx = openTabs.indexOf(draggedId)
      const targetIdx = openTabs.indexOf(targetId)

      if (draggedIdx === -1 || targetIdx === -1) return
      
      // Calculate the new position based on mouse position within the target tab
      const rect = e.currentTarget.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const tabWidth = rect.width
      const isLeftHalf = mouseX < tabWidth / 2
      
      // Determine insertion position
      let insertIdx = targetIdx
      if (draggedIdx < targetIdx) {
        // Dragging right: insert after target if in right half, before if in left half
        insertIdx = isLeftHalf ? targetIdx : targetIdx + 1
      } else {
        // Dragging left: insert before target if in left half, after if in right half
        insertIdx = isLeftHalf ? targetIdx : targetIdx + 1
      }
      
      // Clamp to valid range
      insertIdx = Math.max(0, Math.min(insertIdx, openTabs.length))
      
      // Only reorder if position actually changes
      if (insertIdx === draggedIdx || (insertIdx === draggedIdx + 1 && draggedIdx < targetIdx)) {
        return
      }

      const nextTabs = [...openTabs]
      nextTabs.splice(draggedIdx, 1)
      
      // Adjust insert index if we removed an item before the target
      if (draggedIdx < insertIdx) {
        insertIdx--
      }
      
      nextTabs.splice(insertIdx, 0, draggedId)
      
      // Update last reorder to prevent rapid reordering
      lastReorderRef.current = { draggedId, targetId }
      
      reorderTabs(nextTabs)
    },
    [draggedId, openTabs, reorderTabs]
  )

  const onDragEnd = useCallback(() => {
    setDraggedId(null)
    lastReorderRef.current = { draggedId: null, targetId: null }
  }, [])

  const handleContextMenu = useCallback((e, id) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, id })
  }, [])

  if (openTabs.length === 0) return null

  return (
    <div className="workspace-tabbar">
      <div className="tabs-container">
        {openTabs.map((id) => {
          // Handle Graph tab (special tab, not a snippet)
          if (id === GRAPH_TAB_ID) {
            return (
              <TabItem
                key={id}
                id={id}
                snippet={null}
                isActive={activeTabId === id}
                isDirty={false}
                isPinned={false}
                isDragging={draggedId === id}
                onOpen={handleTabClick}
                onClose={handleCloseTrigger}
                onContextMenu={handleContextMenu}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragEnd={onDragEnd}
              />
            )
          }
          
          // Handle regular snippet tabs
          const snippet = snippetMap.get(id)
          if (!snippet) return null

          return (
            <TabItem
              key={id}
              id={id}
              snippet={snippet}
              isActive={activeTabId === id}
              isDirty={dirtySnippetIds.includes(id)}
              isPinned={pinnedTabIds.includes(id)}
              isDragging={draggedId === id}
              onOpen={handleTabClick}
              onClose={handleCloseTrigger}
              onContextMenu={handleContextMenu}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
            />
          )
        })}
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
    </div>
  )
}

export default TabBar
