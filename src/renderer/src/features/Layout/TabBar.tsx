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
import { createPortal } from 'react-dom'
import {
  X,
  CopyX,
  Pin,
  MoreHorizontal,
  ArrowRight,
  Image,
  Network,
  Sparkles,
  Edit3,
  Columns2,
  Rows2,
  ArrowLeftRight
} from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  type DragStartEvent,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable'
import { useTabDragStore, computePaneDropTarget } from './tabDragDrop'
import {
  useWorkspaceStore,
  GRAPH_TAB_ID,
  LUMINA_TAB_ID,
  RELEASE_NOTES_TAB_ID,
  type WorkspacePaneId
} from '../../core/store/workspaceStore'
import { useShallow } from 'zustand/react/shallow'
import ContextMenu from '../modals/ContextMenu'
import PromptModal from '../modals/PromptModal'
import { getSnippetIcon } from '../Icons/FileIcon'
import ToolTip from '../../components/atoms/ToolTip'
import { useExternalFileDrop } from '../Explorer/drop'
// AI note summarization
import { summarizeNotes } from '../AI/services/summarizeNotes'

const IconPicker = React.lazy(() => import('../Icons/IconPicker'))

interface SortableTabItemProps {
  id: string
  snippet: any
  isActive: boolean
  isDirty: boolean
  isPinned: boolean
  isClosing: boolean
  showCloseOthersIcon: boolean
  onOpen: (id: string) => void
  onClose: (e: React.MouseEvent, id: string) => void
  onContextMenu: (e: React.MouseEvent, id: string) => void
}

/**
 * SortableTabItem — draggable tab using @dnd-kit/sortable
 */
const SortableTabItem = memo<SortableTabItemProps>(
  ({
    id,
    snippet,
    isActive,
    isDirty,
    isPinned,
    isClosing,
    showCloseOthersIcon,
    onOpen,
    onClose,
    onContextMenu
  }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id,
      data: { snippet },
      disabled: isPinned
    })

    const getIcon = () => {
      if (id === RELEASE_NOTES_TAB_ID || snippet?.type === 'release-notes')
        return null
      if (id === LUMINA_TAB_ID || snippet?.type === 'ai')
        return <Sparkles size={12} className="tab-icon" />
      if (id === GRAPH_TAB_ID || snippet?.type === 'graph')
        return <Network size={12} className="tab-icon" />
      if (snippet) return getSnippetIcon(snippet, 12, 'tab-icon')
      return null
    }

    const getTitle = () => {
      if (id === RELEASE_NOTES_TAB_ID) return "What's New"
      if (id === LUMINA_TAB_ID) return 'Lumina AI'
      if (id === GRAPH_TAB_ID) return 'Knowledge Graph'
      return snippet?.title || 'Untitled'
    }

    return (
      <ToolTip text={getTitle()} position="bottom" delay={400}>
        <div
          ref={setNodeRef}
          className={`workspace-tab ${isActive ? 'active' : ''} ${isDirty ? 'is-dirty' : ''} ${isDragging ? 'dragging' : ''} ${isPinned ? 'pinned' : ''} ${isClosing ? 'is-closing' : ''}`}
          style={{
            transform: transform ? `translate3d(${transform.x}px, 0, 0)` : undefined,
            transition: transition || undefined,
            opacity: isDragging ? 0 : 1
          }}
          {...attributes}
          {...listeners}
          onClick={() => onOpen(id)}
          onDoubleClick={() => {
            if (
              snippet &&
              id !== GRAPH_TAB_ID &&
              id !== LUMINA_TAB_ID &&
              id !== RELEASE_NOTES_TAB_ID
            ) {
              window.dispatchEvent(
                new CustomEvent('open-rename-modal', { detail: { note: snippet } })
              )
            }
          }}
          onAuxClick={(e: React.MouseEvent) => e.button === 1 && onClose(e, id)}
          onContextMenu={(e: React.MouseEvent) => onContextMenu(e, id)}
        >
          <div className="tab-context">
            {getIcon()}
            <span className="tab-title">{getTitle()}</span>
          </div>

          <div className="tab-actions" onMouseDown={(e) => e.stopPropagation()}>
            {isPinned && (
              <span
                className="tab-pin-indicator"
                title={isDirty ? 'Pinned tab with unsaved changes' : 'Pinned tab'}
                aria-label={isDirty ? 'Pinned tab with unsaved changes' : 'Pinned tab'}
              >
                <Pin size={12} className="tab-pin-action" />
                {isDirty && <span className="tab-pin-dirty" />}
              </span>
            )}
            {!isPinned && isDirty && !showCloseOthersIcon ? (
              <div
                onMouseDown={(e: React.MouseEvent) => {
                  e.stopPropagation()
                }}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation()
                  onClose(e, id)
                }}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Unsaved changes"
              >
                <span className="tab-dirty" />
              </div>
            ) : !isPinned ? (
              <button
                type="button"
                className={`tab-close-btn${showCloseOthersIcon ? ' is-close-others' : ''}`}
                aria-label={showCloseOthersIcon ? 'Close other tabs' : 'Close tab'}
                title={showCloseOthersIcon ? 'Close Other Tabs (Alt+Click)' : 'Close tab'}
                onMouseDown={(e: React.MouseEvent) => {
                  e.stopPropagation()
                }}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation()
                  onClose(e, id)
                }}
              >
                {showCloseOthersIcon ? <CopyX size={14} /> : <X size={14} />}
              </button>
            ) : null}
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
      prev.isClosing === next.isClosing &&
      prev.showCloseOthersIcon === next.showCloseOthersIcon &&
      prev.snippet?.title === next.snippet?.title &&
      prev.snippet?.customIcon === next.snippet?.customIcon &&
      prev.snippet?.color === next.snippet?.color &&
      prev.snippet?.type === next.snippet?.type
    )
  }
)

SortableTabItem.displayName = 'SortableTabItem'

export interface TabBarProps {
  paneId?: WorkspacePaneId
  isSidebarOpen?: boolean
  onToggleSidebar?: () => void
  isLeftSidebarOpen?: boolean
  onToggleLeftSidebar?: () => void
}

const EMPTY_IDS: string[] = []

export const TabBar: React.FC<TabBarProps> = ({ paneId = 'primary' }) => {
  const {
    openTabs,
    activeTabId,
    selectedSnippet,
    snippets,
    setPaneActiveTabId,
    closePaneTab,
    reorderPaneTabs,
    closeOtherPaneTabs,
    closePaneTabsToRight,
    closeAllPaneTabs,
    togglePinTab,
    saveSnippet,
    dirtySnippetIds,
    pinnedTabIds,
    splitDirection,
    splitPane,
    closePane,
    closeSplit,
    moveTabToPane
  } = useWorkspaceStore(
    useShallow((state) => ({
      snippets: state.notes || [],
      openTabs:
        paneId === 'primary'
          ? state.openTabs
          : state.panes[paneId]?.tabs || EMPTY_IDS,
      activeTabId:
        paneId === 'primary'
          ? state.activeTabId
          : state.panes[paneId]?.activeTabId ?? null,
      selectedSnippet: state.selectedNote,
      setPaneActiveTabId: state.setPaneActiveTabId,
      reorderPaneTabs: state.reorderPaneTabs,
      closePaneTab: state.closePaneTab,
      closeOtherPaneTabs: state.closeOtherPaneTabs,
      closePaneTabsToRight: state.closePaneTabsToRight,
      closeAllPaneTabs: state.closeAllPaneTabs,
      togglePinTab: state.togglePinTab,
      saveSnippet: state.saveNote,
      dirtySnippetIds: state.dirtyNoteIds,
      pinnedTabIds: paneId === 'primary' ? state.pinnedTabIds : EMPTY_IDS,
      splitDirection: state.splitDirection,
      splitPane: state.splitPane,
      closePane: state.closePane,
      closeSplit: state.closeSplit,
      moveTabToPane: state.moveTabToPane
    }))
  )

  const setActiveTabId = useCallback(
    (id: string | null) => setPaneActiveTabId(paneId, id),
    [setPaneActiveTabId, paneId]
  )
  const closeTab = useCallback(
    (id: string) => closePaneTab(paneId, id),
    [closePaneTab, paneId]
  )
  const reorderTabs = useCallback(
    (newTabs: string[]) => reorderPaneTabs(paneId, newTabs),
    [reorderPaneTabs, paneId]
  )
  const closeOtherTabs = useCallback(
    (keepId: string) => closeOtherPaneTabs(paneId, keepId),
    [closeOtherPaneTabs, paneId]
  )
  const closeTabsToRight = useCallback(
    (id: string) => closePaneTabsToRight(paneId, id),
    [closePaneTabsToRight, paneId]
  )
  const closeAllTabs = useCallback(
    () => closeAllPaneTabs(paneId),
    [closeAllPaneTabs, paneId]
  )

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string } | null>(null)
  const [prompt, setPrompt] = useState<{ id: string; title: string } | null>(null)
  const [iconPickerId, setIconPickerId] = useState<string | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [isAltPressed, setIsAltPressed] = useState(false)
  const isAltPressedRef = useRef(false)
  const [closingTabIds, setClosingTabIds] = useState<Set<string>>(() => new Set())
  const closingTimersRef = useRef<number[]>([])
  const isTabBarDropActive = useTabDragStore(
    (state) => state.dropTarget?.targetPane === paneId && state.dropTarget?.zone === 'tabbar'
  )
  const tabbarRef = useRef<HTMLDivElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const dragMoveCleanupRef = useRef<(() => void) | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5
      }
    })
  )

  useEffect(() => {
    const syncAlt = (pressed: boolean) => {
      if (isAltPressedRef.current !== pressed) {
        isAltPressedRef.current = pressed
        setIsAltPressed(pressed)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt' || e.altKey) syncAlt(true)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt' || !e.altKey) syncAlt(false)
    }
    const onPointerEvent = (e: PointerEvent | MouseEvent) => {
      syncAlt(Boolean(e.altKey))
    }
    const onBlur = () => syncAlt(false)
    const onVisibilityChange = () => {
      if (document.hidden) syncAlt(false)
    }

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('pointermove', onPointerEvent, true)
    window.addEventListener('mousedown', onPointerEvent, true)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('pointermove', onPointerEvent, true)
      window.removeEventListener('mousedown', onPointerEvent, true)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  // Auto-scroll to active tab when it changes
  useEffect(() => {
    if (!tabbarRef.current || !activeTabId) return

    requestAnimationFrame(() => {
      if (!tabbarRef.current) return

      const activeTabElement = tabbarRef.current.querySelector(
        '.workspace-tab.active'
      ) as HTMLElement | null
      if (activeTabElement) {
        const containerRect = tabbarRef.current.getBoundingClientRect()
        const tabRect = activeTabElement.getBoundingClientRect()

        const padding = 16
        if (tabRect.left < containerRect.left) {
          const scrollDiff = tabRect.left - containerRect.left - padding
          tabbarRef.current.scrollBy({ left: scrollDiff, behavior: 'smooth' })
        } else if (tabRect.right > containerRect.right) {
          const scrollDiff = tabRect.right - containerRect.right + padding
          tabbarRef.current.scrollBy({ left: scrollDiff, behavior: 'smooth' })
        }
      }
    })
  }, [activeTabId, openTabs, pinnedTabIds])

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

  const canCloseOthers = openTabs.length > 1 || splitDirection !== 'none'

  useEffect(() => {
    return () => {
      closingTimersRef.current.forEach((t) => window.clearTimeout(t))
      closingTimersRef.current = []
    }
  }, [])

  const animateCloseTabs = useCallback((idsToAnimate: string[], commit: () => void) => {
    if (idsToAnimate.length === 0) {
      commit()
      return
    }
    setClosingTabIds((prev) => {
      const next = new Set(prev)
      idsToAnimate.forEach((tid) => next.add(tid))
      return next
    })
    const timer = window.setTimeout(() => {
      commit()
      setClosingTabIds((prev) => {
        const next = new Set(prev)
        idsToAnimate.forEach((tid) => next.delete(tid))
        return next
      })
    }, 165)
    closingTimersRef.current.push(timer)
  }, [])

  const handleCloseTrigger = useCallback(
    (e: React.MouseEvent | { stopPropagation: () => void; altKey?: boolean }, id: string) => {
      e.stopPropagation()
      if ((e.altKey || isAltPressed) && canCloseOthers) {
        if (openTabs.length > 1) {
          const otherIds = openTabs.filter((tid) => tid !== id)
          animateCloseTabs(otherIds, () => closeOtherTabs(id))
        } else if (splitDirection !== 'none') {
          if (paneId !== 'primary') {
            moveTabToPane(id, 'primary')
          }
          closeSplit()
          useWorkspaceStore.getState().closeOtherTabs(id)
        }
        return
      }
      if (pinnedTabIds.includes(id)) return

      if (dirtySnippetIds.includes(id)) {
        const snippet = snippetMap.get(id)
        setPrompt({ id, title: snippet?.title || 'Untitled' })
      } else if (id === LUMINA_TAB_ID && paneId === 'primary' && splitDirection === 'none') {
        closeTab(id)
      } else {
        animateCloseTabs([id], () => closeTab(id))
      }
    },
    [
      isAltPressed,
      canCloseOthers,
      openTabs,
      splitDirection,
      paneId,
      animateCloseTabs,
      closeOtherTabs,
      moveTabToPane,
      closeSplit,
      pinnedTabIds,
      dirtySnippetIds,
      snippetMap,
      closeTab
    ]
  )

  const pinnedTabs = useMemo(
    () => openTabs.filter((id) => pinnedTabIds.includes(id)),
    [openTabs, pinnedTabIds]
  )
  const scrollableTabs = useMemo(
    () => openTabs.filter((id) => !pinnedTabIds.includes(id)),
    [openTabs, pinnedTabIds]
  )

  const showCloseOthersIcon = isAltPressed && canCloseOthers

  const renderTab = (id: string) => {
    const snippet = snippetMap.get(id)
    if (
      !snippet &&
      id !== GRAPH_TAB_ID &&
      id !== LUMINA_TAB_ID &&
      id !== RELEASE_NOTES_TAB_ID
    )
      return null
    const tabSnippet =
      snippet ||
      (id === GRAPH_TAB_ID
        ? { id: GRAPH_TAB_ID, title: 'Knowledge Graph', type: 'graph' }
        : id === LUMINA_TAB_ID
          ? { id: LUMINA_TAB_ID, title: 'Lumina AI', type: 'ai' }
          : id === RELEASE_NOTES_TAB_ID
            ? { id: RELEASE_NOTES_TAB_ID, title: "What's New", type: 'release-notes' }
            : null)
    return (
      <SortableTabItem
        key={id}
        id={id}
        snippet={tabSnippet}
        isActive={
          paneId === 'primary'
            ? activeTabId === id || (!activeTabId && selectedSnippet?.id === id)
            : activeTabId === id
        }
        isDirty={dirtySnippetIds.includes(id)}
        isPinned={pinnedTabIds.includes(id)}
        isClosing={closingTabIds.has(id)}
        showCloseOthersIcon={showCloseOthersIcon}
        onOpen={handleTabClick}
        onClose={handleCloseTrigger}
        onContextMenu={handleContextMenu}
      />
    )
  }

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

  // --- Sortable Drag & Drop-to-Split Handlers ---
  const cleanupDragListener = useCallback(() => {
    if (dragMoveCleanupRef.current) {
      dragMoveCleanupRef.current()
      dragMoveCleanupRef.current = null
    }
  }, [])

  useEffect(() => cleanupDragListener, [cleanupDragListener])

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const tabId = String(event.active.id)
      setActiveDragId(tabId)
      useTabDragStore.getState().startDrag(tabId, paneId)

      const onPointerMove = (e: PointerEvent) => {
        const target = computePaneDropTarget(e.clientX, e.clientY, paneId, wrapperRef.current)
        useTabDragStore.getState().setDropTarget(target)
      }

      window.addEventListener('pointermove', onPointerMove, { passive: true })
      dragMoveCleanupRef.current = () => {
        window.removeEventListener('pointermove', onPointerMove)
      }
    },
    [paneId]
  )

  const handleDragCancel = useCallback(() => {
    cleanupDragListener()
    setActiveDragId(null)
    useTabDragStore.getState().clearDrag()
  }, [cleanupDragListener])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      cleanupDragListener()
      const { active, over } = event
      const dropTarget = useTabDragStore.getState().dropTarget
      setActiveDragId(null)
      useTabDragStore.getState().clearDrag()

      if (!active) return
      const tabId = String(active.id)

      if (dropTarget) {
        const { targetPane, zone } = dropTarget
        if (zone === 'center' || zone === 'tabbar') {
          if (targetPane !== paneId) {
            moveTabToPane(tabId, targetPane)
          }
          return
        }
        const direction = zone === 'bottom' || zone === 'top' ? 'horizontal' : 'vertical'
        const position = zone === 'left' || zone === 'top' ? 'before' : 'after'
        moveTabToPane(tabId, targetPane, {
          direction,
          position,
          sourcePane: paneId
        })
        return
      }

      if (!over || active.id === over.id) return

      const oldIndex = openTabs.indexOf(tabId)
      const newIndex = openTabs.indexOf(String(over.id))
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(openTabs, oldIndex, newIndex)
      reorderTabs(reordered)
    },
    [cleanupDragListener, paneId, splitDirection, moveTabToPane, openTabs, reorderTabs]
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
    return null
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      collisionDetection={closestCenter}
    >
      <div
        ref={wrapperRef}
        className="tabbar-outer-wrapper"
        onDragEnter={(e: React.DragEvent) => handleExternalDragEnter(e, '')}
        onDragOver={(e: React.DragEvent) => handleExternalDragOver(e, '')}
        onDragLeave={handleExternalDragLeave}
        onDrop={(e: React.DragEvent) => handleExternalDrop(e, '')}
        style={{
          display: 'flex',
          width: '100%',
          position: 'relative',
          flexShrink: 0,
          minWidth: 0,
          boxSizing: 'border-box'
        }}
      >
        <SortableContext items={openTabs} strategy={horizontalListSortingStrategy}>
          <div className="tabbar-layout">
            {pinnedTabs.length > 0 && (
              <div className="pinned-tabs-container" aria-label="Pinned tabs">
                {pinnedTabs.map(renderTab)}
              </div>
            )}
            <div
              className="workspace-tabbar"
              ref={tabbarRef}
              onWheel={handleWheel}
              style={{ flex: 1, minWidth: 0 }}
            >
              <div className="tabs-container">
                {scrollableTabs.map(renderTab)}
                {isTabBarDropActive && (
                  <div className="tabbar-drop-placeholder" aria-hidden="true" />
                )}
              </div>
            </div>
            <div className="tabbar-split-actions" onMouseDown={(e) => e.stopPropagation()}>
              <ToolTip text="Split Right (Ctrl+\\)" position="bottom" delay={400}>
                <button
                  type="button"
                  className="tabbar-split-btn"
                  aria-label="Split Right"
                  onClick={() => splitPane('vertical', undefined, paneId, 'after')}
                >
                  <Columns2 size={14} strokeWidth={2} />
                </button>
              </ToolTip>
              <ToolTip text="Split Down (Ctrl+Alt+\\)" position="bottom" delay={400}>
                <button
                  type="button"
                  className="tabbar-split-btn"
                  aria-label="Split Down"
                  onClick={() => splitPane('horizontal', undefined, paneId, 'after')}
                >
                  <Rows2 size={14} strokeWidth={2} />
                </button>
              </ToolTip>
            </div>
          </div>
        </SortableContext>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          options={[
            ...(paneId === 'primary'
              ? [
                  {
                    label: pinnedTabIds.includes(contextMenu.id) ? 'Unpin Tab' : 'Pin Tab',
                    icon: <Pin size={14} />,
                    onClick: () => togglePinTab(contextMenu.id)
                  }
                ]
              : []),
            {
              label: 'Split Right',
              icon: <Columns2 size={14} />,
              onClick: () => splitPane('vertical', contextMenu.id, paneId, 'after')
            },
            {
              label: 'Split Down',
              icon: <Rows2 size={14} />,
              onClick: () => splitPane('horizontal', contextMenu.id, paneId, 'after')
            },
            ...(splitDirection !== 'none'
              ? [
                  {
                    label:
                      paneId === 'primary' ? 'Move to Other Pane' : 'Move to Primary Pane',
                    icon: <ArrowLeftRight size={14} />,
                    onClick: () =>
                      moveTabToPane(
                        contextMenu.id,
                        paneId === 'primary' ? 'secondary' : 'primary'
                      )
                  }
                ]
              : []),
            ...(contextMenu.id !== GRAPH_TAB_ID &&
            contextMenu.id !== LUMINA_TAB_ID &&
            contextMenu.id !== RELEASE_NOTES_TAB_ID
              ? [
                  {
                    label: 'Rename Note',
                    shortcut: 'F2',
                    icon: <Edit3 size={14} />,
                    onClick: () => {
                      const s = snippetMap.get(contextMenu.id)
                      setContextMenu(null)
                      if (s) {
                        window.dispatchEvent(
                          new CustomEvent('open-rename-modal', { detail: { note: s } })
                        )
                      }
                    }
                  },
                  {
                    label: 'Change Icon',
                    shortcut: 'Win + Shift + .',
                    icon: <Image size={14} />,
                    onClick: () => setIconPickerId(contextMenu.id)
                  }
                ]
              : []),
            ...(snippetMap.get(contextMenu.id) &&
            contextMenu.id !== GRAPH_TAB_ID &&
            contextMenu.id !== LUMINA_TAB_ID &&
            contextMenu.id !== RELEASE_NOTES_TAB_ID
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

      {Boolean(iconPickerId) && (
        <React.Suspense fallback={null}>
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
        </React.Suspense>
      )}

      {typeof document !== 'undefined' &&
        createPortal(
          <DragOverlay dropAnimation={null}>
            {activeDragId ? (
              <div className="workspace-tab drag-overlay active">
                <span className="tab-title">
                  {activeDragId === RELEASE_NOTES_TAB_ID
                    ? "What's New"
                    : activeDragId === LUMINA_TAB_ID
                      ? 'Lumina AI'
                      : activeDragId === GRAPH_TAB_ID
                        ? 'Knowledge Graph'
                        : snippetMap.get(activeDragId)?.title || 'Untitled'}
                </span>
              </div>
            ) : null}
          </DragOverlay>,
          document.body
        )}
    </DndContext>
  )
}

export default React.memo(TabBar)
