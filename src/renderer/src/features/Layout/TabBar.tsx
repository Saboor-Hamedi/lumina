/**
 * =========================================================================
 * TabBar Component (`TabBar.tsx`)
 * =========================================================================
 *
 * High-performance, premium workspace tab management for Lumina.
 *
 * Features:
 * - Native feel, horizontal DND reordering via @dnd-kit
 * - Pinned tabs support with dedicated unpin/pin operations
 * - Unsaved changes dirty safety prompt dialog
 * - Context menu: Pin/Unpin, Change Icon, Summarize with Lumina AI, Close, Close Others, Close to Right, Close All
 * - Auto-scroll to active tab on tab selection changes
 * - Smooth horizontal mouse-wheel scrolling
 * - O(1) Snippet Lookup Map for instant tab rendering
 * =========================================================================
 */

import React, { useRef, useState, useCallback, useMemo, memo, useEffect } from 'react'
import {
  X,
  Pin,
  MoreHorizontal,
  ArrowRight,
  Image,
  Network,
  Sparkles,
  PanelBottomOpen
} from 'lucide-react'
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor, DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable'
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers'
import { useWorkspaceStore, GRAPH_TAB_ID } from '../../core/store/workspaceStore'
import { useShallow } from 'zustand/react/shallow'
import ContextMenu from '../modals/ContextMenu'
import PromptModal from '../modals/PromptModal'
import IconPicker from '../Icons/IconPicker'
import { getSnippetIcon } from '../Icons/FileIcon'
import ToolTip from '../../components/atoms/ToolTip'
import { useExternalFileDrop } from '../Explorer/drop'
// AI note summarization
import { summarizeNotes } from '../AI/services/summarizeNotes'
import { UnsavedIndicator } from '../../core/hooks/unsave'

interface SortableTabItemProps {
  id: string
  snippet: any
  isActive: boolean
  isDirty: boolean
  isPinned: boolean
  onOpen: (id: string) => void
  onClose: (e: React.MouseEvent, id: string) => void
  onContextMenu: (e: React.MouseEvent, id: string) => void
}

/**
 * SortableTabItem — draggable tab using @dnd-kit/sortable
 */
const SortableTabItem = memo<SortableTabItemProps>(
  ({ id, snippet, isActive, isDirty, isPinned, onOpen, onClose, onContextMenu }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id,
      data: { snippet },
      disabled: isPinned
    })

    const getIcon = () => {
      if (isPinned) return <Pin size={12} className="tab-icon pinned-icon" />
      if (id === GRAPH_TAB_ID || snippet?.type === 'graph')
        return <Network size={12} className="tab-icon" />
      if (snippet) return getSnippetIcon(snippet, 12, 'tab-icon')
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
          onAuxClick={(e: React.MouseEvent) => e.button === 1 && onClose(e, id)}
          onContextMenu={(e: React.MouseEvent) => onContextMenu(e, id)}
        >
          <div className="tab-context">
            {getIcon()}
            <span className="tab-title">{getTitle()}</span>
          </div>

          <div className="tab-actions">
            {isDirty ? (
              <div
                onClick={(e: React.MouseEvent) => onClose(e, id)}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <span className="tab-dirty">
                  <UnsavedIndicator />
                </span>
              </div>
            ) : (
              !isPinned && (
                <button
                  type="button"
                  className="tab-close-btn"
                  onClick={(e: React.MouseEvent) => onClose(e, id)}
                >
                  <X size={14} />
                </button>
              )
            )}
          </div>
        </div>
      </ToolTip>
    )
  },
  (prev, next) => {
    return (
      prev.id === next.id &&
      prev.isActive === next.isActive &&
      prev.isDirty === next.isDirty &&
      prev.isPinned === next.isPinned &&
      prev.snippet?.title === next.snippet?.title &&
      prev.snippet?.customIcon === next.snippet?.customIcon &&
      prev.snippet?.color === next.snippet?.color &&
      prev.snippet?.type === next.snippet?.type
    )
  }
)

SortableTabItem.displayName = 'SortableTabItem'

export interface TabBarProps {
  isSidebarOpen?: boolean
  onToggleSidebar?: () => void
  isLeftSidebarOpen?: boolean
  onToggleLeftSidebar?: () => void
}

export const TabBar: React.FC<TabBarProps> = () => {
  const {
    openTabs,
    activeTabId,
    selectedSnippet,
    snippets,
    setActiveTabId,
    closeTab,
    reorderTabs,
    closeOtherTabs,
    closeTabsToRight,
    closeAllTabs,
    togglePinTab,
    saveSnippet,
    dirtySnippetIds,
    pinnedTabIds
  } = useWorkspaceStore(
    useShallow((state) => ({
      snippets: state.notes || [],
      openTabs: state.openTabs || [],
      activeTabId: state.activeTabId,
      selectedSnippet: state.selectedNote,
      setActiveTabId: state.setActiveTabId,
      reorderTabs: state.reorderTabs,
      closeTab: state.closeTab,
      closeOtherTabs: state.closeOtherTabs,
      closeTabsToRight: state.closeTabsToRight,
      closeAllTabs: state.closeAllTabs,
      togglePinTab: state.togglePinTab,
      saveSnippet: state.saveNote,
      dirtySnippetIds: state.dirtyNoteIds || [],
      pinnedTabIds: state.pinnedTabIds || []
    }))
  )

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string } | null>(null)
  const [prompt, setPrompt] = useState<{ id: string; title: string } | null>(null)
  const [iconPickerId, setIconPickerId] = useState<string | null>(null)
  const tabbarRef = useRef<HTMLDivElement | null>(null)

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

    requestAnimationFrame(() => {
      if (!tabbarRef.current) return

      const activeTabElement = tabbarRef.current.querySelector('.workspace-tab.active') as HTMLElement | null
      if (activeTabElement) {
        const containerRect = tabbarRef.current.getBoundingClientRect()
        const tabRect = activeTabElement.getBoundingClientRect()

        if (tabRect.left < containerRect.left || tabRect.right > containerRect.right) {
          const scrollLeftTarget =
            tabbarRef.current.scrollLeft +
            (tabRect.left - containerRect.left) -
            containerRect.width / 2 +
            tabRect.width / 2
          tabbarRef.current.scrollTo({ left: scrollLeftTarget, behavior: 'smooth' })
        }
      }
    })
  }, [activeTabId, openTabs])

  // O(1) Snippet Lookup Map for Performance
  const snippetMap = useMemo(() => {
    const map = new Map<string, any>()
    const list = Array.isArray(snippets) ? snippets : []
    list.forEach((s) => map.set(s.id, s))
    return map
  }, [snippets])

  const handleTabClick = useCallback(
    (id: string) => {
      setActiveTabId(id)
    },
    [setActiveTabId]
  )

  const handleCloseTrigger = useCallback(
    (e: React.MouseEvent | { stopPropagation: () => void }, id: string) => {
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
  const handleConfirmSave = async (): Promise<void> => {
    if (!prompt) return
    const snippet = snippetMap.get(prompt.id)
    if (snippet) {
      await saveSnippet(snippet)
      closeTab(prompt.id)
    }
    setPrompt(null)
  }

  const handleDiscard = (): void => {
    if (prompt) closeTab(prompt.id)
    setPrompt(null)
  }

  const handleContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, id })
  }, [])

  // --- Sortable Drag Handler ---
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!active || !over || active.id === over.id) return

      const oldIndex = openTabs.indexOf(String(active.id))
      const newIndex = openTabs.indexOf(String(over.id))
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(openTabs, oldIndex, newIndex)
      reorderTabs(reordered)
    },
    [openTabs, reorderTabs]
  )

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!tabbarRef.current) return
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      tabbarRef.current.scrollLeft += e.deltaY
    }
  }, [])

  const {
    handleDragEnter: handleExternalDragEnter,
    handleDragOver: handleExternalDragOver,
    handleDragLeave: handleExternalDragLeave,
    handleDrop: handleExternalDrop
  } = useExternalFileDrop()

  if (openTabs.length === 0) {
    return (
      <div
        className="tabbar-outer-wrapper"
        onDragEnter={(e: React.DragEvent) => handleExternalDragEnter(e, '')}
        onDragOver={(e: React.DragEvent) => handleExternalDragOver(e, '')}
        onDragLeave={handleExternalDragLeave}
        onDrop={(e: React.DragEvent) => handleExternalDrop(e, '')}
        style={{
          display: 'flex',
          width: '100%',
          height: '32px',
          position: 'relative',
          flexShrink: 0,
          minWidth: 0,
          borderBottom: '1px solid var(--border-dim)',
          boxSizing: 'border-box'
        }}
      />
    )
  }

  return (
    <DndContext
      sensors={sensors}
      onDragEnd={handleDragEnd}
      collisionDetection={closestCenter}
      modifiers={[restrictToHorizontalAxis]}
    >
      <div
        className="tabbar-outer-wrapper"
        onDragEnter={(e: React.DragEvent) => handleExternalDragEnter(e, '')}
        onDragOver={(e: React.DragEvent) => handleExternalDragOver(e, '')}
        onDragLeave={handleExternalDragLeave}
        onDrop={(e: React.DragEvent) => handleExternalDrop(e, '')}
        style={{
          display: 'flex',
          width: '100%',
          height: '32px',
          position: 'relative',
          flexShrink: 0,
          minWidth: 0,
          borderBottom: '1px solid var(--border-dim)',
          boxSizing: 'border-box'
        }}
      >
        <div
          className="workspace-tabbar"
          ref={tabbarRef}
          onWheel={handleWheel}
          style={{ flex: 1, minWidth: 0 }}
        >
          <SortableContext items={openTabs} strategy={horizontalListSortingStrategy}>
            <div
              className="tabs-container"
              style={{ display: 'flex', height: '100%', alignItems: 'stretch' }}
            >
              {openTabs.map((id) => {
                const snippet = snippetMap.get(id)
                if (!snippet && id !== GRAPH_TAB_ID) return null
                const tabSnippet =
                  snippet ||
                  (id === GRAPH_TAB_ID
                    ? { id: GRAPH_TAB_ID, title: 'Knowledge Graph', type: 'graph' }
                    : null)
                return (
                  <SortableTabItem
                    key={id}
                    id={id}
                    snippet={tabSnippet}
                    isActive={activeTabId === id || selectedSnippet?.id === id}
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
              shortcut: 'Win + Shift + .',
              icon: <Image size={14} />,
              onClick: () => setIconPickerId(contextMenu.id)
            },
            ...(snippetMap.get(contextMenu.id) && contextMenu.id !== GRAPH_TAB_ID
              ? [
                  {
                    label: 'Summarize with Lumina',
                    icon: <Sparkles size={14} />,
                    onClick: () => {
                      const s = snippetMap.get(contextMenu.id)
                      setContextMenu(null)
                      if (s) summarizeNotes(s)
                    }
                  }
                ]
              : []),
            ...(snippetMap.get(contextMenu.id)?.type === 'canvas' ||
            snippetMap.get(contextMenu.id)?.language === 'canvas' ||
            snippetMap.get(contextMenu.id)?.fileName?.endsWith('.canvas')
              ? [
                  {
                    label: 'Open as Inline Canvas',
                    icon: <PanelBottomOpen size={14} />,
                    onClick: () => {
                      window.dispatchEvent(
                        new CustomEvent('open-canvas-drawer', {
                          detail: { snippetId: contextMenu.id }
                        })
                      )
                      setContextMenu(null)
                    }
                  }
                ]
              : []),
            { type: 'divider' },
            {
              label: 'Close',
              shortcut: 'Ctrl+W',
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
              danger: true,
              onClick: () => closeAllTabs()
            }
          ]}
        />
      )}

      <PromptModal
        isOpen={Boolean(prompt)}
        title="Unsaved Changes"
        message={`"${prompt?.title}" has unsaved changes. Do you want to save them before closing?`}
        confirmLabel="Save & Close"
        discardLabel="Discard"
        onClose={() => setPrompt(null)}
        onConfirm={handleConfirmSave}
        onDiscard={handleDiscard}
      />

      <IconPicker
        isOpen={Boolean(iconPickerId)}
        onClose={() => setIconPickerId(null)}
        currentIcon={iconPickerId ? snippetMap.get(iconPickerId)?.customIcon : undefined}
        onSelect={(iconName: string) => {
          if (!iconPickerId) return
          const s = snippetMap.get(iconPickerId)
          if (s) saveSnippet({ ...s, customIcon: iconName })
        }}
      />
    </DndContext>
  )
}

export default React.memo(TabBar)
