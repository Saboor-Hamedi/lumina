import { create } from 'zustand'
import { useSettingsStore } from './SettingStore'
import {
  type WorkspacePaneId,
  type SplitOrientation,
  type SplitPosition,
  type PaneState,
  type SplitTreeNode,
  clampSplitRatio,
  collectLeafPaneIds,
  splitLeafInTree,
  removeLeafFromTree,
  updateSplitRatioInTree,
  toggleSplitDirectionInTree
} from './splitTree'

export type { WorkspacePaneId, SplitOrientation, SplitPosition, PaneState, SplitTreeNode }

export const GRAPH_TAB_ID = '__graph__'
export const LUMINA_TAB_ID = '__lumina__'
export const RELEASE_NOTES_TAB_ID = 'release-notes'

export const isVirtualTabId = (id: string | null | undefined): boolean =>
  id === GRAPH_TAB_ID || id === LUMINA_TAB_ID || id === RELEASE_NOTES_TAB_ID

export type SplitDirection = 'none' | 'vertical' | 'horizontal'

export interface WorkspaceNote {
  id: string
  title?: string
  code?: string
  folderId?: string
  fileName?: string
  color?: string | null
  tags?: string
  language?: string
  isPinned?: boolean
  isLearned?: boolean
  timestamp?: number
  createdAt?: string
  customIcon?: string | null
  selection?: any
  type?: string
  size?: number
  isOversized?: boolean
  isPartial?: boolean
  [key: string]: any
}

export interface WorkspaceStoreState {
  notes: WorkspaceNote[]
  folders: string[]
  folderColors: Record<string, string>
  selectedNote: WorkspaceNote | null
  selectedFolder: string | null
  isLoading: boolean
  searchQuery: string
  dirtyNoteIds: string[]
  drafts: Record<string, string>
  openTabs: string[]
  activeTabId: string | null
  pinnedTabIds: string[]
  splitDirection: SplitDirection
  splitRatio: number
  secondaryTabs: string[]
  secondaryActiveTabId: string | null
  panes: Record<WorkspacePaneId, PaneState>
  splitTree: SplitTreeNode
  focusedPane: WorkspacePaneId
  clipboard: any

  setNotes: (notes: WorkspaceNote[]) => void
  setSelectedFolder: (selectedFolder: string | null) => void
  setClipboard: (clipboard: any) => void
  restoreSession: (
    tabs: string[],
    activeId: string | null,
    pinnedIds?: string[],
    splitLayout?: any
  ) => void
  setSelectedNote: (note: WorkspaceNote | null) => void
  setActiveTabId: (id: string | null) => void
  closeTab: (id: string) => void
  reorderTabs: (newTabs: string[]) => void
  closeOtherTabs: (keepId: string) => void
  closeTabsToRight: (id: string) => void
  closeAllTabs: () => void
  togglePinTab: (id: string) => void
  openGraphTab: () => void
  openLuminaTab: () => void
  openReleaseNotesTab: () => void
  setPinnedTabs: (pinnedTabIds: string[]) => void
  setFocusedPane: (pane: WorkspacePaneId) => void
  setSplitRatio: (ratio: number, splitId?: string) => void
  splitPane: (
    direction: 'vertical' | 'horizontal',
    tabId?: string,
    targetPaneId?: WorkspacePaneId,
    position?: SplitPosition
  ) => void
  closePane: (paneId: WorkspacePaneId) => void
  closeSplit: () => void
  toggleSplitDirection: (paneId?: WorkspacePaneId) => void
  setPaneActiveTabId: (pane: WorkspacePaneId, id: string | null) => void
  closePaneTab: (pane: WorkspacePaneId, id: string) => void
  reorderPaneTabs: (pane: WorkspacePaneId, newTabs: string[]) => void
  closeOtherPaneTabs: (pane: WorkspacePaneId, keepId: string) => void
  closePaneTabsToRight: (pane: WorkspacePaneId, id: string) => void
  closeAllPaneTabs: (pane: WorkspacePaneId) => void
  moveTabToPane: (
    id: string,
    targetPane: WorkspacePaneId,
    splitOptions?: SplitOrientation | { direction: SplitOrientation; position?: SplitPosition; sourcePane?: WorkspacePaneId }
  ) => void
  setLoading: (isLoading: boolean) => void
  setSearchQuery: (query: string) => void
  setDraft: (id: string, code: string) => void
  addFolder: (folderPath: string) => void
  setDirty: (id: string, isDirty: boolean) => void
  loadWorkspace: () => Promise<void>
  loadVault: () => Promise<void>
  saveNote: (note: Partial<WorkspaceNote> & { id: string }) => Promise<any>
  deleteNote: (id: string, skipConfirm?: boolean) => Promise<void>
  setFolderColor: (folderId: string, color: string | null) => Promise<void>
  migrateFolderColor: (oldFolderId: string, newFolderId: string) => Promise<void>
  updateNoteSelection: (id: string, selection: any) => void

  // Backward compatibility properties & methods
  snippets?: WorkspaceNote[]
  selectedSnippet?: WorkspaceNote | null
  setSelectedSnippet?: (note: WorkspaceNote | null) => void
  saveSnippet?: (note: Partial<WorkspaceNote> & { id: string }) => Promise<any>
  deleteSnippet?: (id: string, skipConfirm?: boolean) => Promise<void>
}

let hasLoadedWorkspaceOnce = false
const recentlyDeletedIds = new Set<string>()

const persistNotesSnapshot = (_notes: WorkspaceNote[], _openTabs: string[] = []): void => {}

const persistFoldersSnapshot = (_folders: string[]): void => {}

const getCachedSession = () => {
  return {
    notes: [] as WorkspaceNote[],
    folders: [] as string[],
    openTabs: [] as string[],
    pinnedTabIds: [] as string[],
    activeTabId: null as string | null,
    selectedNote: null as WorkspaceNote | null,
    isLoading: true
  }
}

const resolveNoteById = (notes: WorkspaceNote[], id: string | null): WorkspaceNote | null => {
  if (!id || isVirtualTabId(id)) return null
  return notes.find((n) => n.id === id) || null
}

const computeTabsAfterClose = (
  tabs: string[],
  currentActiveId: string | null,
  closedId: string
): { nextTabs: string[]; nextActiveId: string | null } => {
  const nextTabs = tabs.filter((tid) => tid !== closedId)
  let nextActiveId = currentActiveId
  if (currentActiveId === closedId || !nextTabs.includes(nextActiveId || '')) {
    const idx = tabs.indexOf(closedId)
    nextActiveId = idx === -1 ? nextTabs[0] || null : nextTabs[idx] || nextTabs[idx - 1] || null
  }
  if (!nextActiveId && nextTabs.length > 0) {
    nextActiveId = nextTabs[0]
  }
  return { nextTabs, nextActiveId }
}

let paneIdCounter = 1

const nextGeneratedPaneId = (panes: Record<WorkspacePaneId, PaneState>): WorkspacePaneId => {
  if (!panes.secondary) return 'secondary'
  paneIdCounter += 1
  return `pane-${paneIdCounter}`
}

const buildSyncedPaneFields = (
  panes: Record<WorkspacePaneId, PaneState>,
  splitTree: SplitTreeNode,
  focusedPane: WorkspacePaneId,
  notes: WorkspaceNote[]
) => {
  const leaves = collectLeafPaneIds(splitTree)
  const primaryId = leaves.includes('primary') ? 'primary' : leaves[0] || 'primary'
  const primaryPane = panes[primaryId] || { id: primaryId, tabs: [], activeTabId: null }
  const nonPrimaryId = leaves.find((id) => id !== primaryId)
  const secondaryPane = nonPrimaryId ? panes[nonPrimaryId] : undefined
  const activeFocusedPane = panes[focusedPane] ? focusedPane : primaryId
  const focusedNote = resolveNoteById(notes, panes[activeFocusedPane]?.activeTabId ?? null)

  return {
    panes,
    splitTree,
    focusedPane: activeFocusedPane,
    openTabs: primaryPane.tabs,
    activeTabId: primaryPane.activeTabId,
    splitDirection: (splitTree.kind === 'split' ? splitTree.direction : 'none') as SplitDirection,
    splitRatio: splitTree.kind === 'split' ? splitTree.ratio : 0.5,
    secondaryTabs: secondaryPane ? secondaryPane.tabs : [],
    secondaryActiveTabId: secondaryPane ? secondaryPane.activeTabId : null,
    selectedNote: focusedNote,
    selectedSnippet: focusedNote
  }
}

const sanitizeRestoredSplitLayout = (
  rawLayout: any,
  noteIdSet: Set<string>,
  fallbackTabs: string[],
  fallbackActiveId: string | null,
  notes: WorkspaceNote[]
) => {
  const isValidTab = (id: string) =>
    isVirtualTabId(id) || noteIdSet.has(id)

  if (
    !rawLayout ||
    typeof rawLayout !== 'object' ||
    !rawLayout.splitTree ||
    rawLayout.splitTree.kind !== 'split' ||
    !rawLayout.panes ||
    typeof rawLayout.panes !== 'object'
  ) {
    const primaryPane: PaneState = {
      id: 'primary',
      tabs: fallbackTabs,
      activeTabId: fallbackActiveId
    }
    return buildSyncedPaneFields(
      { primary: primaryPane },
      { kind: 'leaf', paneId: 'primary' },
      'primary',
      notes
    )
  }

  let nextTree: SplitTreeNode = rawLayout.splitTree
  const leafIds = collectLeafPaneIds(nextTree)
  const nextPanes: Record<WorkspacePaneId, PaneState> = {}

  for (const pid of leafIds) {
    const rawPane = rawLayout.panes[pid]
    const rawTabs = Array.isArray(rawPane?.tabs) ? rawPane.tabs : pid === 'primary' ? fallbackTabs : []
    const validPaneTabs = rawTabs.filter((id: any) => typeof id === 'string' && isValidTab(id))
    if (validPaneTabs.length === 0 && pid !== 'primary') {
      const reduced = removeLeafFromTree(nextTree, pid)
      if (reduced) {
        nextTree = reduced
        continue
      }
    }
    const rawActive = rawPane?.activeTabId
    const validActive =
      typeof rawActive === 'string' && validPaneTabs.includes(rawActive)
        ? rawActive
        : validPaneTabs[0] || null
    nextPanes[pid] = { id: pid, tabs: validPaneTabs, activeTabId: validActive }
  }

  if (!nextPanes.primary) {
    nextPanes.primary = { id: 'primary', tabs: fallbackTabs, activeTabId: fallbackActiveId }
  }
  const focusCandidate =
    typeof rawLayout.focusedPane === 'string' && nextPanes[rawLayout.focusedPane]
      ? rawLayout.focusedPane
      : 'primary'

  return buildSyncedPaneFields(nextPanes, nextTree, focusCandidate, notes)
}

const initialSession = getCachedSession()

export const useWorkspaceStore = create<WorkspaceStoreState>((set, get) => ({
  // Core Workspace & Note State (Hydrated synchronously from localStorage)
  notes: initialSession.notes,
  snippets: initialSession.notes,
  folders: initialSession.folders,
  folderColors: {},
  selectedNote: initialSession.selectedNote,
  selectedSnippet: initialSession.selectedNote,
  selectedFolder: null,
  isLoading: initialSession.isLoading,
  searchQuery: '',
  dirtyNoteIds: [],
  drafts: {},
  openTabs: initialSession.openTabs,
  activeTabId: initialSession.activeTabId,
  pinnedTabIds: initialSession.pinnedTabIds,
  splitDirection: 'none' as SplitDirection,
  splitRatio: 0.5,
  secondaryTabs: [] as string[],
  secondaryActiveTabId: null as string | null,
  panes: {
    primary: {
      id: 'primary',
      tabs: initialSession.openTabs,
      activeTabId: initialSession.activeTabId
    }
  } as Record<WorkspacePaneId, PaneState>,
  splitTree: { kind: 'leaf', paneId: 'primary' } as SplitTreeNode,
  focusedPane: 'primary' as WorkspacePaneId,
  clipboard: null,

  setNotes: (notes: WorkspaceNote[]) => set({ notes, snippets: notes }),
  setSelectedFolder: (selectedFolder: string | null) => set({ selectedFolder }),
  setClipboard: (clipboard: any) => set({ clipboard }),

  restoreSession: (
    tabs: string[],
    activeId: string | null,
    pinnedIds: string[] = [],
    splitLayout?: any
  ) => {
    set((state) => {
      const allNotes = state.notes || []
      const noteIdSet = new Set(allNotes.map((n) => n.id))
      const validTabs = tabs.filter(
        (id) => isVirtualTabId(id) || noteIdSet.has(id)
      )
      const validPinned = pinnedIds.filter((id) => validTabs.includes(id)).slice(0, 1)

      const validActiveId = activeId && validTabs.includes(activeId) ? activeId : null
      const finalActiveId = validActiveId || (validTabs.length ? validTabs[0] : null)

      const activeNote =
        isVirtualTabId(finalActiveId)
          ? null
          : finalActiveId
            ? allNotes.find((n) => n.id === finalActiveId) || null
            : null

      const layoutToRestore =
        splitLayout !== undefined
          ? splitLayout
          : state.splitTree.kind === 'split'
            ? { splitTree: state.splitTree, panes: state.panes, focusedPane: state.focusedPane }
            : null

      const syncedLayout = sanitizeRestoredSplitLayout(
        layoutToRestore,
        noteIdSet,
        validTabs,
        finalActiveId,
        allNotes
      )

      return {
        ...syncedLayout,
        pinnedTabIds: validPinned,
        ...(syncedLayout.splitTree.kind === 'leaf'
          ? { selectedNote: activeNote, selectedSnippet: activeNote }
          : {})
      }
    })
  },

  setSelectedNote: (note: WorkspaceNote | null) => {
    if (!note) {
      set((state) => ({
        selectedNote: null,
        selectedSnippet: null,
        activeTabId: null,
        panes: {
          ...state.panes,
          primary: { ...(state.panes.primary || { id: 'primary', tabs: [] }), activeTabId: null }
        }
      }))
      return
    }

    set((state) => {
      const targetPaneId =
        state.splitTree.kind === 'split' && state.panes[state.focusedPane]
          ? state.focusedPane
          : 'primary'

      if (targetPaneId !== 'primary') {
        const targetPane = state.panes[targetPaneId]
        const isAlreadyOpen = targetPane.tabs.includes(note.id)
        if (
          targetPane.activeTabId === note.id &&
          state.selectedNote?.id === note.id &&
          isAlreadyOpen
        ) {
          return state
        }
        const nextTabs = isAlreadyOpen ? targetPane.tabs : [...targetPane.tabs, note.id]
        const nextPanes = {
          ...state.panes,
          [targetPaneId]: { ...targetPane, tabs: nextTabs, activeTabId: note.id }
        }
        return buildSyncedPaneFields(nextPanes, state.splitTree, targetPaneId, state.notes || [])
      }

      if (
        state.activeTabId === note.id &&
        state.selectedNote?.id === note.id &&
        state.openTabs.includes(note.id)
      ) {
        return state
      }
      const isAlreadyOpen = state.openTabs.includes(note.id)
      const nextTabs = isAlreadyOpen ? state.openTabs : [...state.openTabs, note.id]
      const nextPanes = {
        ...state.panes,
        primary: { id: 'primary', tabs: nextTabs, activeTabId: note.id }
      }
      return {
        ...buildSyncedPaneFields(nextPanes, state.splitTree, 'primary', state.notes || []),
        selectedNote: note,
        selectedSnippet: note
      }
    })
  },

  setSelectedSnippet: (note: WorkspaceNote | null) => get().setSelectedNote(note),
  saveSnippet: (note: Partial<WorkspaceNote> & { id: string }) => get().saveNote(note),
  deleteSnippet: (id: string, skipConfirm?: boolean) => get().deleteNote(id, skipConfirm),

  setActiveTabId: (id: string | null) => {
    let selectedItem: WorkspaceNote | null = null
    set((state) => {
      if (
        state.activeTabId === id &&
        (!id || state.selectedNote?.id === id || isVirtualTabId(id)) &&
        state.panes.primary?.activeTabId === id
      ) {
        return state
      }
      if (isVirtualTabId(id) && id) {
        const isAlreadyOpen = state.openTabs.includes(id)
        const nextTabs = isAlreadyOpen ? state.openTabs : [...state.openTabs, id]
        return {
          activeTabId: id,
          selectedNote: null,
          selectedSnippet: null,
          openTabs: nextTabs,
          panes: {
            ...state.panes,
            primary: { id: 'primary', tabs: nextTabs, activeTabId: id }
          }
        }
      }
      if (!id) {
        return {
          activeTabId: null,
          selectedNote: null,
          selectedSnippet: null,
          panes: {
            ...state.panes,
            primary: { id: 'primary', tabs: state.openTabs, activeTabId: null }
          }
        }
      }
      const allNotes = state.notes || []
      const note = allNotes.find((n) => n.id === id) || null
      const isAlreadyOpen = state.openTabs.includes(id)
      const nextTabs = isAlreadyOpen ? state.openTabs : [...state.openTabs, id]
      selectedItem = note
      return {
        activeTabId: id,
        selectedNote: selectedItem,
        selectedSnippet: selectedItem,
        openTabs: nextTabs,
        panes: {
          ...state.panes,
          primary: { id: 'primary', tabs: nextTabs, activeTabId: id }
        }
      }
    })
  },

  closeTab: (id: string) =>
    set((state) => {
      const nextTabs = state.openTabs.filter((tid) => tid !== id)
      const isClosingActive = state.activeTabId === id || state.selectedNote?.id === id

      let nextActiveId = state.activeTabId
      if (isClosingActive || !nextTabs.includes(nextActiveId || '')) {
        const idx = state.openTabs.indexOf(id)
        if (idx === -1) {
          nextActiveId = nextTabs[0] || null
        } else {
          nextActiveId = nextTabs[idx] || nextTabs[idx - 1] || null
        }
      }

      if (!nextActiveId && nextTabs.length > 0) {
        nextActiveId = nextTabs[0]
      }

      const allNotes = state.notes || []
      const nextSelected = isClosingActive
        ? nextActiveId && !isVirtualTabId(nextActiveId)
          ? allNotes.find((n) => n.id === nextActiveId) || null
          : null
        : state.selectedNote

      const nextPanes: Record<WorkspacePaneId, PaneState> = {
        ...state.panes,
        primary: { id: 'primary', tabs: nextTabs, activeTabId: nextActiveId }
      }

      return {
        openTabs: nextTabs,
        pinnedTabIds: state.pinnedTabIds.filter((tabId) => nextTabs.includes(tabId)),
        activeTabId: nextActiveId,
        selectedNote: nextSelected,
        selectedSnippet: nextSelected,
        panes: nextPanes
      }
    }),

  reorderTabs: (newTabs: string[]) => {
    set((state) => {
      const pinnedSet = new Set(state.pinnedTabIds)
      const pTabs = newTabs.filter((tid) => pinnedSet.has(tid))
      const rTabs = newTabs.filter((tid) => !pinnedSet.has(tid))
      const nextTabs = [...pTabs, ...rTabs]

      return {
        openTabs: nextTabs,
        panes: {
          ...state.panes,
          primary: { id: 'primary', tabs: nextTabs, activeTabId: state.activeTabId }
        }
      }
    })
  },

  closeOtherTabs: (keepId: string) => {
    set((state) => {
      const nextActiveId = keepId
      const allNotes = state.notes || []
      const nextSelected = allNotes.find((n) => n.id === keepId) || null
      return {
        openTabs: [keepId],
        pinnedTabIds: state.pinnedTabIds.includes(keepId) ? [keepId] : [],
        activeTabId: nextActiveId,
        selectedNote: nextSelected,
        selectedSnippet: nextSelected,
        panes: {
          ...state.panes,
          primary: { id: 'primary', tabs: [keepId], activeTabId: nextActiveId }
        }
      }
    })
  },

  closeTabsToRight: (id: string) => {
    set((state) => {
      const idx = state.openTabs.indexOf(id)
      const nextTabs = state.openTabs.slice(0, idx + 1)
      let nextActiveId = state.activeTabId
      if (!nextTabs.includes(state.activeTabId || '')) {
        nextActiveId = id
      }
      const allNotes = state.notes || []
      const nextSelected = allNotes.find((n) => n.id === nextActiveId) || null
      return {
        openTabs: nextTabs,
        pinnedTabIds: state.pinnedTabIds.filter((tabId) => nextTabs.includes(tabId)),
        activeTabId: nextActiveId,
        selectedNote: nextSelected,
        selectedSnippet: nextSelected,
        panes: {
          ...state.panes,
          primary: { id: 'primary', tabs: nextTabs, activeTabId: nextActiveId }
        }
      }
    })
  },

  closeAllTabs: () => {
    set((state) => {
      const allNotes = state.notes || []
      const activeId = state.pinnedTabIds.length > 0 ? state.pinnedTabIds[0] : null
      const activeNote = activeId ? allNotes.find((n) => n.id === activeId) || null : null
      const nextTabs = state.openTabs.filter((id) => state.pinnedTabIds.includes(id))
      return {
        openTabs: nextTabs,
        activeTabId: activeId,
        selectedNote: activeNote,
        selectedSnippet: activeNote,
        panes: {
          ...state.panes,
          primary: { id: 'primary', tabs: nextTabs, activeTabId: activeId }
        }
      }
    })
  },

  togglePinTab: (id: string) => {
    set((state) => {
      const isPinned = state.pinnedTabIds.includes(id)
      // Tabs use a single pinned slot. Pinning another tab replaces the
      // previous one; unpinning the current tab leaves the slot empty.
      const nextPinned = isPinned ? [] : [id]

      const pinnedSet = new Set(nextPinned)
      const pTabs = state.openTabs.filter((tid) => pinnedSet.has(tid))
      const rTabs = state.openTabs.filter((tid) => !pinnedSet.has(tid))
      const nextTabs = [...pTabs, ...rTabs]

      return {
        pinnedTabIds: nextPinned,
        openTabs: nextTabs,
        panes: {
          ...state.panes,
          primary: { id: 'primary', tabs: nextTabs, activeTabId: state.activeTabId }
        }
      }
    })
  },

  openGraphTab: () => {
    set((state) => {
      const isAlreadyOpen = state.openTabs.includes(GRAPH_TAB_ID)
      const nextTabs = isAlreadyOpen ? state.openTabs : [...state.openTabs, GRAPH_TAB_ID]
      return {
        openTabs: nextTabs,
        activeTabId: GRAPH_TAB_ID,
        selectedNote: null,
        panes: {
          ...state.panes,
          primary: { id: 'primary', tabs: nextTabs, activeTabId: GRAPH_TAB_ID }
        }
      }
    })
  },

  openLuminaTab: () =>
    set((state) => {
      const isAlreadyOpen = state.openTabs.includes(LUMINA_TAB_ID)
      const nextTabs = isAlreadyOpen ? state.openTabs : [...state.openTabs, LUMINA_TAB_ID]
      return {
        openTabs: nextTabs,
        activeTabId: LUMINA_TAB_ID,
        selectedNote: null,
        selectedSnippet: null,
        panes: {
          ...state.panes,
          primary: { id: 'primary', tabs: nextTabs, activeTabId: LUMINA_TAB_ID }
        }
      }
    }),

  openReleaseNotesTab: () =>
    set((state) => {
      const isAlreadyOpen = state.openTabs.includes(RELEASE_NOTES_TAB_ID)
      const nextTabs = isAlreadyOpen
        ? state.openTabs
        : [...state.openTabs, RELEASE_NOTES_TAB_ID]
      const nextPanes = {
        ...state.panes,
        primary: {
          ...(state.panes.primary || { id: 'primary', tabs: [] }),
          tabs: nextTabs,
          activeTabId: RELEASE_NOTES_TAB_ID
        }
      }
      return {
        openTabs: nextTabs,
        activeTabId: RELEASE_NOTES_TAB_ID,
        panes: nextPanes,
        selectedNote: null,
        selectedSnippet: null
      }
    }),

  setPinnedTabs: (pinnedTabIds: string[]) =>
    set((state) => ({
      pinnedTabIds: pinnedTabIds.filter((id) => state.openTabs.includes(id)).slice(0, 1)
    })),

  setFocusedPane: (pane: WorkspacePaneId) =>
    set((state) => {
      if (state.focusedPane === pane || !state.panes[pane]) return state
      const targetNote = resolveNoteById(state.notes || [], state.panes[pane].activeTabId)
      return {
        focusedPane: pane,
        ...(targetNote ? { selectedNote: targetNote, selectedSnippet: targetNote } : {})
      }
    }),

  setSplitRatio: (ratio: number, splitId?: string) =>
    set((state) => {
      if (state.splitTree.kind !== 'split') {
        return { splitRatio: clampSplitRatio(ratio) }
      }
      const targetSplitId = splitId || state.splitTree.id
      const nextTree = updateSplitRatioInTree(state.splitTree, targetSplitId, ratio)
      return {
        splitTree: nextTree,
        splitRatio: nextTree.kind === 'split' ? nextTree.ratio : clampSplitRatio(ratio)
      }
    }),

  splitPane: (
    direction: 'vertical' | 'horizontal',
    tabId?: string,
    targetPaneId?: WorkspacePaneId,
    position: SplitPosition = 'after'
  ) =>
    set((state) => {
      const sourcePaneId = targetPaneId && state.panes[targetPaneId] ? targetPaneId : state.focusedPane
      const sourcePane = state.panes[sourcePaneId] || {
        id: 'primary',
        tabs: state.openTabs,
        activeTabId: state.activeTabId
      }
      const targetTabId = tabId || sourcePane.activeTabId || sourcePane.tabs[0] || state.activeTabId || state.openTabs[0] || null
      if (!targetTabId) return state

      const newPaneId = nextGeneratedPaneId(state.panes)
      const nextPanes: Record<WorkspacePaneId, PaneState> = {
        ...state.panes,
        [sourcePaneId]: sourcePane,
        [newPaneId]: {
          id: newPaneId,
          tabs: [targetTabId],
          activeTabId: targetTabId
        }
      }
      const nextTree = splitLeafInTree(state.splitTree, sourcePaneId, newPaneId, direction, position)
      return buildSyncedPaneFields(nextPanes, nextTree, newPaneId, state.notes || [])
    }),

  closePane: (paneId: WorkspacePaneId) =>
    set((state) => {
      if (state.splitTree.kind !== 'split') return state
      const nextTree = removeLeafFromTree(state.splitTree, paneId)
      if (!nextTree) return state

      const nextPanes = { ...state.panes }
      delete nextPanes[paneId]

      // If 'primary' was closed, promote the first surviving leaf to 'primary'
      if (paneId === 'primary') {
        const survivingIds = collectLeafPaneIds(nextTree)
        const firstId = survivingIds[0]
        if (firstId && nextPanes[firstId]) {
          const promoted = nextPanes[firstId]
          delete nextPanes[firstId]
          nextPanes.primary = { ...promoted, id: 'primary' }
          const renameLeaf = (n: SplitTreeNode): SplitTreeNode =>
            n.kind === 'leaf'
              ? { kind: 'leaf', paneId: n.paneId === firstId ? 'primary' : n.paneId }
              : { ...n, first: renameLeaf(n.first), second: renameLeaf(n.second) }
          const renamedTree = renameLeaf(nextTree)
          return buildSyncedPaneFields(nextPanes, renamedTree, 'primary', state.notes || [])
        }
      }

      const nextFocus = nextPanes[state.focusedPane] ? state.focusedPane : 'primary'
      return buildSyncedPaneFields(nextPanes, nextTree, nextFocus, state.notes || [])
    }),

  closeSplit: () =>
    set((state) => {
      if (state.splitTree.kind !== 'split') return state
      const primaryPane = state.panes.primary || {
        id: 'primary',
        tabs: state.openTabs,
        activeTabId: state.activeTabId
      }
      const nextPanes: Record<WorkspacePaneId, PaneState> = { primary: primaryPane }
      const nextTree: SplitTreeNode = { kind: 'leaf', paneId: 'primary' }
      return buildSyncedPaneFields(nextPanes, nextTree, 'primary', state.notes || [])
    }),

  toggleSplitDirection: (paneId?: WorkspacePaneId) =>
    set((state) => {
      if (state.splitTree.kind !== 'split') return state
      const targetId = paneId || state.focusedPane
      const nextTree = toggleSplitDirectionInTree(state.splitTree, targetId)
      return {
        splitTree: nextTree,
        splitDirection: nextTree.kind === 'split' ? nextTree.direction : 'none'
      }
    }),

  setPaneActiveTabId: (pane: WorkspacePaneId, id: string | null) => {
    if (pane === 'primary') {
      set({ focusedPane: 'primary' })
      get().setActiveTabId(id)
      set((state) => ({
        panes: {
          ...state.panes,
          primary: { id: 'primary', tabs: state.openTabs, activeTabId: state.activeTabId }
        }
      }))
      return
    }
    set((state) => {
      const targetPane = state.panes[pane]
      if (!targetPane) return state
      if (!id) {
        const nextPanes = { ...state.panes, [pane]: { ...targetPane, activeTabId: null } }
        return buildSyncedPaneFields(nextPanes, state.splitTree, pane, state.notes || [])
      }
      const nextTabs = targetPane.tabs.includes(id) ? targetPane.tabs : [...targetPane.tabs, id]
      const nextPanes = {
        ...state.panes,
        [pane]: { ...targetPane, tabs: nextTabs, activeTabId: id }
      }
      return buildSyncedPaneFields(nextPanes, state.splitTree, pane, state.notes || [])
    })
  },

  closePaneTab: (pane: WorkspacePaneId, id: string) => {
    set((state) => {
      const currentPane = state.panes[pane] || {
        id: pane,
        tabs: pane === 'primary' ? state.openTabs : [],
        activeTabId: pane === 'primary' ? state.activeTabId : null
      }
      const { nextTabs, nextActiveId } = computeTabsAfterClose(
        currentPane.tabs,
        currentPane.activeTabId,
        id
      )

      if (nextTabs.length === 0 && state.splitTree.kind === 'split') {
        const nextTree = removeLeafFromTree(state.splitTree, pane)
        if (nextTree) {
          const nextPanes = { ...state.panes }
          delete nextPanes[pane]
          if (pane === 'primary') {
            const firstId = collectLeafPaneIds(nextTree)[0]
            if (firstId && nextPanes[firstId]) {
              const promoted = nextPanes[firstId]
              delete nextPanes[firstId]
              nextPanes.primary = { ...promoted, id: 'primary' }
              const renameLeaf = (n: SplitTreeNode): SplitTreeNode =>
                n.kind === 'leaf'
                  ? { kind: 'leaf', paneId: n.paneId === firstId ? 'primary' : n.paneId }
                  : { ...n, first: renameLeaf(n.first), second: renameLeaf(n.second) }
              return {
                ...buildSyncedPaneFields(nextPanes, renameLeaf(nextTree), 'primary', state.notes || []),
                pinnedTabIds: []
              }
            }
          }
          const nextFocus = nextPanes[state.focusedPane] ? state.focusedPane : 'primary'
          return {
            ...buildSyncedPaneFields(nextPanes, nextTree, nextFocus, state.notes || []),
            ...(pane === 'primary'
              ? { pinnedTabIds: state.pinnedTabIds.filter((tid) => nextTabs.includes(tid)) }
              : {})
          }
        }
      }

      const nextPanes = {
        ...state.panes,
        [pane]: { ...currentPane, tabs: nextTabs, activeTabId: nextActiveId }
      }
      return {
        ...buildSyncedPaneFields(nextPanes, state.splitTree, pane, state.notes || []),
        ...(pane === 'primary'
          ? { pinnedTabIds: state.pinnedTabIds.filter((tid) => nextTabs.includes(tid)) }
          : {})
      }
    })
  },

  reorderPaneTabs: (pane: WorkspacePaneId, newTabs: string[]) => {
    if (pane === 'primary') {
      get().reorderTabs(newTabs)
      set((state) => ({
        panes: {
          ...state.panes,
          primary: { id: 'primary', tabs: state.openTabs, activeTabId: state.activeTabId }
        }
      }))
      return
    }
    set((state) => {
      const targetPane = state.panes[pane]
      if (!targetPane) return state
      const nextPanes = { ...state.panes, [pane]: { ...targetPane, tabs: newTabs } }
      return buildSyncedPaneFields(nextPanes, state.splitTree, state.focusedPane, state.notes || [])
    })
  },

  closeOtherPaneTabs: (pane: WorkspacePaneId, keepId: string) => {
    if (pane === 'primary') {
      get().closeOtherTabs(keepId)
      set((state) => ({
        panes: {
          ...state.panes,
          primary: { id: 'primary', tabs: state.openTabs, activeTabId: state.activeTabId }
        }
      }))
      return
    }
    set((state) => {
      const targetPane = state.panes[pane]
      if (!targetPane) return state
      const nextPanes = {
        ...state.panes,
        [pane]: { ...targetPane, tabs: [keepId], activeTabId: keepId }
      }
      return buildSyncedPaneFields(nextPanes, state.splitTree, pane, state.notes || [])
    })
  },

  closePaneTabsToRight: (pane: WorkspacePaneId, id: string) => {
    if (pane === 'primary') {
      get().closeTabsToRight(id)
      set((state) => ({
        panes: {
          ...state.panes,
          primary: { id: 'primary', tabs: state.openTabs, activeTabId: state.activeTabId }
        }
      }))
      return
    }
    set((state) => {
      const targetPane = state.panes[pane]
      if (!targetPane) return state
      const idx = targetPane.tabs.indexOf(id)
      const nextTabs = idx === -1 ? targetPane.tabs : targetPane.tabs.slice(0, idx + 1)
      const nextActiveId = nextTabs.includes(targetPane.activeTabId || '')
        ? targetPane.activeTabId
        : id
      const nextPanes = {
        ...state.panes,
        [pane]: { ...targetPane, tabs: nextTabs, activeTabId: nextActiveId }
      }
      return buildSyncedPaneFields(nextPanes, state.splitTree, pane, state.notes || [])
    })
  },

  closeAllPaneTabs: (pane: WorkspacePaneId) => {
    if (pane === 'primary') {
      get().closeAllTabs()
      set((state) => ({
        panes: {
          ...state.panes,
          primary: { id: 'primary', tabs: state.openTabs, activeTabId: state.activeTabId }
        }
      }))
      return
    }
    get().closePane(pane)
  },

  moveTabToPane: (
    id: string,
    targetPane: WorkspacePaneId,
    splitOptions?:
      | SplitOrientation
      | { direction: SplitOrientation; position?: SplitPosition; sourcePane?: WorkspacePaneId }
  ) =>
    set((state) => {
      const notes = state.notes || []
      const normalizedSplit =
        typeof splitOptions === 'string' ? { direction: splitOptions, position: 'after' as SplitPosition } : splitOptions
      const sourcePaneId =
        normalizedSplit?.sourcePane ||
        Object.keys(state.panes).find((pid) => state.panes[pid]?.tabs.includes(id)) ||
        'primary'
      const sourcePane = state.panes[sourcePaneId] || {
        id: sourcePaneId,
        tabs: state.openTabs,
        activeTabId: state.activeTabId
      }

      // Case 1: Split targetPane into a new column/row and place tab there
      if (normalizedSplit) {
        const { direction, position = 'after' } = normalizedSplit
        const anchorPaneId = state.panes[targetPane] ? targetPane : sourcePaneId
        const newPaneId = nextGeneratedPaneId(state.panes)
        const nextPanes: Record<WorkspacePaneId, PaneState> = { ...state.panes }
        let nextTree = splitLeafInTree(state.splitTree, anchorPaneId, newPaneId, direction, position)
        nextPanes[newPaneId] = { id: newPaneId, tabs: [id], activeTabId: id }

        const { nextTabs: nextSrcTabs, nextActiveId: nextSrcActive } = computeTabsAfterClose(
          sourcePane.tabs,
          sourcePane.activeTabId,
          id
        )

        if (nextSrcTabs.length > 0) {
          nextPanes[sourcePaneId] = { ...sourcePane, tabs: nextSrcTabs, activeTabId: nextSrcActive }
        } else if (sourcePaneId !== anchorPaneId && state.splitTree.kind === 'split') {
          const collapsed = removeLeafFromTree(nextTree, sourcePaneId)
          if (collapsed) {
            nextTree = collapsed
            delete nextPanes[sourcePaneId]
          }
        }

        return {
          ...buildSyncedPaneFields(nextPanes, nextTree, newPaneId, notes),
          pinnedTabIds:
            sourcePaneId === 'primary'
              ? state.pinnedTabIds.filter((tid) => nextPanes.primary?.tabs.includes(tid))
              : state.pinnedTabIds
        }
      }

      // Case 2: Move tab into an existing targetPane (or create 'secondary' if not yet open)
      if (!state.panes[targetPane]) {
        const newPaneId = targetPane
        const nextPanes: Record<WorkspacePaneId, PaneState> = { ...state.panes }
        const nextTree = splitLeafInTree(state.splitTree, sourcePaneId, newPaneId, 'vertical', 'after')
        nextPanes[newPaneId] = { id: newPaneId, tabs: [id], activeTabId: id }
        const { nextTabs: nextSrcTabs, nextActiveId: nextSrcActive } = computeTabsAfterClose(
          sourcePane.tabs,
          sourcePane.activeTabId,
          id
        )
        if (nextSrcTabs.length > 0) {
          nextPanes[sourcePaneId] = { ...sourcePane, tabs: nextSrcTabs, activeTabId: nextSrcActive }
        }
        return {
          ...buildSyncedPaneFields(nextPanes, nextTree, newPaneId, notes),
          pinnedTabIds:
            sourcePaneId === 'primary'
              ? state.pinnedTabIds.filter((tid) => nextPanes.primary?.tabs.includes(tid))
              : state.pinnedTabIds
        }
      }

      if (sourcePaneId === targetPane) return state

      const destPane = state.panes[targetPane]
      const nextDestTabs = destPane.tabs.includes(id) ? destPane.tabs : [...destPane.tabs, id]
      const nextPanes: Record<WorkspacePaneId, PaneState> = {
        ...state.panes,
        [targetPane]: { ...destPane, tabs: nextDestTabs, activeTabId: id }
      }
      let nextTree = state.splitTree
      const { nextTabs: nextSrcTabs, nextActiveId: nextSrcActive } = computeTabsAfterClose(
        sourcePane.tabs,
        sourcePane.activeTabId,
        id
      )

      if (nextSrcTabs.length > 0) {
        nextPanes[sourcePaneId] = { ...sourcePane, tabs: nextSrcTabs, activeTabId: nextSrcActive }
      } else if (nextTree.kind === 'split') {
        const collapsed = removeLeafFromTree(nextTree, sourcePaneId)
        if (collapsed) {
          nextTree = collapsed
          delete nextPanes[sourcePaneId]
          if (sourcePaneId === 'primary' && targetPane !== 'primary') {
            nextPanes.primary = { ...nextPanes[targetPane], id: 'primary' }
            delete nextPanes[targetPane]
            const renameLeaf = (n: SplitTreeNode): SplitTreeNode =>
              n.kind === 'leaf'
                ? { kind: 'leaf', paneId: n.paneId === targetPane ? 'primary' : n.paneId }
                : { ...n, first: renameLeaf(n.first), second: renameLeaf(n.second) }
            nextTree = renameLeaf(nextTree)
            return {
              ...buildSyncedPaneFields(nextPanes, nextTree, 'primary', notes),
              pinnedTabIds: []
            }
          }
        }
      }

      return {
        ...buildSyncedPaneFields(nextPanes, nextTree, targetPane, notes),
        pinnedTabIds:
          sourcePaneId === 'primary'
            ? state.pinnedTabIds.filter((tid) => nextPanes.primary?.tabs.includes(tid))
            : state.pinnedTabIds
      }
    }),

  setLoading: (isLoading: boolean) => set({ isLoading }),
  setSearchQuery: (query: string) => set({ searchQuery: query }),
  setDraft: (id: string, code: string) =>
    set((state) => ({
      drafts: { ...state.drafts, [id]: code }
    })),
  addFolder: (folderPath: string) => {
    if (!folderPath || typeof folderPath !== 'string') return
    const normalized = folderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
    if (!normalized) return

    set((state) => {
      const currentFolders = Array.isArray(state.folders) ? state.folders : []
      const folderSet = new Set(currentFolders)
      let current = ''
      normalized.split('/').forEach((part) => {
        if (!part) return
        current = current ? `${current}/${part}` : part
        folderSet.add(current)
      })
      const nextFolders = Array.from(folderSet)
      persistFoldersSnapshot(nextFolders)
      return { folders: nextFolders }
    })
  },

  setDirty: (id: string, isDirty: boolean) =>
    set((state) => {
      const currentDirty = state.dirtyNoteIds || []
      const hasId = currentDirty.includes(id)

      if ((isDirty && hasId) || (!isDirty && !hasId)) {
        return state
      }

      const next = isDirty ? [...currentDirty, id] : currentDirty.filter((dId) => dId !== id)

      return { dirtyNoteIds: next }
    }),

  /**
   * Synchronizes workspace data (notes, folders, tab state) from the main process.
   */
  loadWorkspace: async () => {
    const isInitialLoad = !hasLoadedWorkspaceOnce
    if (isInitialLoad && get().notes.length === 0) {
      set({ isLoading: true })
    }

    try {
      const getItems = (window as any).api?.getNotes || (window as any).api?.getSnippets
      if (getItems) {
        const freshData = await getItems()
        const rawNotes = freshData?.notes || freshData?.snippets

        if (freshData && rawNotes) {
          hasLoadedWorkspaceOnce = true
          let merged: WorkspaceNote[] = rawNotes
          let folderColors: Record<string, string> = {}
          let persistedOpenTabs = get().openTabs
          let persistedPinnedTabs = get().pinnedTabIds
          let persistedActiveId = get().activeTabId
          let persistedSplitLayout: any =
            get().splitTree.kind === 'split'
              ? { splitTree: get().splitTree, panes: get().panes, focusedPane: get().focusedPane }
              : null

          try {
            let allSettings = useSettingsStore.getState().settings as any
            if (!allSettings || Object.keys(allSettings).length === 0) {
              allSettings = (await (window as any).api.getSetting()) || {}
            }
            const freshFolderColors = (await (window as any).api?.getSetting?.('folderColors')) || null
            const noteColors = allSettings.noteColors || {}
            folderColors = freshFolderColors || allSettings.folderColors || get().folderColors || {}
            if (allSettings) {
              allSettings.folderColors = folderColors
            }
            merged = rawNotes.map((n: WorkspaceNote) => ({
              ...n,
              color: n.color || noteColors[n.id] || null
            }))

            if (isInitialLoad) {
              if (Array.isArray(allSettings.openTabs) && allSettings.openTabs.length > 0) {
                persistedOpenTabs = allSettings.openTabs
              }
              if (Array.isArray(allSettings.pinnedTabIds)) {
                persistedPinnedTabs = allSettings.pinnedTabIds
              }
              if (allSettings.lastNoteId) {
                persistedActiveId = allSettings.lastNoteId
              }
              if (allSettings.splitLayout) {
                persistedSplitLayout = allSettings.splitLayout
              }
            }
          } catch {
            folderColors = {}
          }

          const noteIdSet = new Set(merged.map((n) => n.id))
          const validTabs = persistedOpenTabs.filter(
            (id) => isVirtualTabId(id) || noteIdSet.has(id)
          )
          const validPinned = persistedPinnedTabs.filter((id) => validTabs.includes(id)).slice(0, 1)
          const validActiveId =
            persistedActiveId && validTabs.includes(persistedActiveId)
              ? persistedActiveId
              : validTabs[0] || null
          const activeNote =
            validActiveId && !isVirtualTabId(validActiveId)
              ? merged.find((n) => n.id === validActiveId) || null
              : null

          const rawFolderList: string[] = freshData.folders || []
          const folderSet = new Set<string>()
          const addFolderAndParents = (raw?: string) => {
            const clean = String(raw || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
            if (!clean || clean === '.' || clean.startsWith('.')) return
            let current = ''
            for (const part of clean.split('/')) {
              if (!part || part === '.' || part.startsWith('.')) return
              current = current ? `${current}/${part}` : part
              folderSet.add(current)
            }
          }
          rawFolderList.forEach((f) => addFolderAndParents(f))
          merged.forEach((n) => {
            if (n.folderId && typeof n.folderId === 'string') {
              addFolderAndParents(n.folderId)
            }
          })
          const allFolders = Array.from(folderSet)

          const syncedLayout = sanitizeRestoredSplitLayout(
            persistedSplitLayout,
            noteIdSet,
            validTabs,
            validActiveId,
            merged
          )

          set({
            notes: merged,
            snippets: merged,
            folders: allFolders,
            folderColors,
            ...syncedLayout,
            pinnedTabIds: validPinned,
            ...(syncedLayout.splitTree.kind === 'leaf'
              ? { selectedNote: activeNote, selectedSnippet: activeNote }
              : {})
          })
        } else {
          console.warn('[WorkspaceStore] ✗ Received invalid data from sync.')
        }
      }
    } catch (err) {
      console.error('[WorkspaceStore] ✗ Workspace sync failed:', err)
    } finally {
      set({ isLoading: false })
    }
  },

  /**
   * Deprecated alias for `loadWorkspace`.
   * @deprecated Use `loadWorkspace` instead.
   */
  loadVault: function () {
    return get().loadWorkspace()
  },

  saveNote: async (note: Partial<WorkspaceNote> & { id: string }) => {
    if (!note) {
      console.error('[WorkspaceStore] Cannot save: note is null or undefined')
      throw new Error('Note is required')
    }

    if (!note.id) {
      console.error('[WorkspaceStore] Cannot save: note ID is missing')
      throw new Error('Note ID is required')
    }

    if (recentlyDeletedIds.has(note.id)) {
      console.warn('[WorkspaceStore] Ignoring save for recently deleted item:', note.id)
      return null
    }

    try {
      const saveApi = (window as any).api?.saveNote || (window as any).api?.saveSnippet
      if (!saveApi) {
        throw new Error('Save API is not available. Please restart the application.')
      }

      const current = get().notes || []
      const existing = current.find((n) => n.id === note.id)

      const returnedNote = await saveApi(note)
      const updatedNote: WorkspaceNote =
        returnedNote && typeof returnedNote === 'object'
          ? returnedNote
          : ({ ...(existing || {}), ...note } as WorkspaceNote)

      if (note.color && (!existing || existing.color !== note.color)) {
        const currentColors = (await (window as any).api.getSetting('noteColors')) || {}
        await (window as any).api.saveSetting('noteColors', {
          ...currentColors,
          [note.id]: note.color
        })
      }

      set((state) => {
        const currentNotes = state.notes || []
        let nextNotes = currentNotes.map((n) =>
          n.id === note.id ? { ...updatedNote, color: note.color } : n
        )
        const isNew = !currentNotes.some((n) => n.id === note.id)
        if (isNew) {
          nextNotes.push({ ...updatedNote, color: note.color })
        }

        const nextDrafts = { ...state.drafts }
        delete nextDrafts[note.id]

        if (
          existing &&
          existing.title &&
          updatedNote?.title &&
          existing.title !== updatedNote.title
        ) {
          const oldTitle = existing.title
          const newTitle = updatedNote.title
          const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const linkRegex = new RegExp('\\[\\[' + escapeRegExp(oldTitle) + '([\\|#\\]])', 'gi')

          const updates: WorkspaceNote[] = []
          nextNotes = nextNotes.map((n) => {
            if (n.id !== note.id && n.code && linkRegex.test(n.code)) {
              const newCode = n.code.replace(linkRegex, '[[' + newTitle + '$1')
              const updatedLinkNote = { ...n, code: newCode }
              updates.push(updatedLinkNote)
              return updatedLinkNote
            }
            return n
          })

          updates.forEach((u) => {
            const apiSave = (window as any).api?.saveNote || (window as any).api?.saveSnippet
            if (apiSave) apiSave(u).catch(console.error)
          })
        }

        let nextFolders = state.folders || []
        const rawFolderId = updatedNote.folderId || note.folderId
        if (rawFolderId && typeof rawFolderId === 'string') {
          const normalizedFolder = rawFolderId.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
          if (normalizedFolder) {
            const folderSet = new Set(nextFolders)
            let curr = ''
            normalizedFolder.split('/').forEach((part) => {
              if (!part) return
              curr = curr ? `${curr}/${part}` : part
              folderSet.add(curr)
            })
            nextFolders = Array.from(folderSet)
          }
        }

        const dirtyNotes = (state.dirtyNoteIds || []).filter((dId) => dId !== note.id)

        return {
          notes: nextNotes,
          snippets: nextNotes,
          folders: nextFolders,
          drafts: nextDrafts,
          dirtyNoteIds: dirtyNotes
        }
      })

      if (get().selectedNote?.id === note.id) {
        set({ selectedNote: updatedNote, selectedSnippet: updatedNote })
      }

      persistNotesSnapshot(get().notes, get().openTabs)
      persistFoldersSnapshot(get().folders)

      return updatedNote
    } catch (err) {
      console.error('[WorkspaceStore] Save failed:', err)
      throw err
    }
  },

  deleteNote: async (id: string, skipConfirm: boolean = false) => {
    if (!id) {
      console.error('[WorkspaceStore] Cannot delete: ID is missing')
      throw new Error('Note ID is required')
    }

    recentlyDeletedIds.add(id)
    setTimeout(() => recentlyDeletedIds.delete(id), 5000)

    const deleteApi = (window as any).api?.deleteNote || (window as any).api?.deleteSnippet
    if (!deleteApi) {
      throw new Error('Delete API is not available. Please restart the application.')
    }

    if (!skipConfirm) {
      const confirmed = await (window as any).api.confirmDelete('Permanently delete this note?')
      if (!confirmed) return
    }

    set((state) => {
      const allNotes = state.notes || []
      const next = allNotes.filter((s) => s.id !== id)
      const nextTabs = state.openTabs.filter((tid) => tid !== id)

      let nextActiveId = state.activeTabId
      if (
        state.activeTabId === id ||
        state.selectedNote?.id === id ||
        !nextTabs.includes(nextActiveId || '')
      ) {
        const idx = state.openTabs.indexOf(id)
        if (idx === -1) {
          nextActiveId = nextTabs[0] || null
        } else {
          nextActiveId = nextTabs[idx] || nextTabs[idx - 1] || null
        }
      }

      if (!nextActiveId && nextTabs.length > 0) {
        nextActiveId = nextTabs[0]
      }

      const nextSelectedNote =
        nextActiveId && !isVirtualTabId(nextActiveId)
          ? next.find((n) => n.id === nextActiveId) || null
          : null

      const nextDrafts = { ...state.drafts }
      delete nextDrafts[id]

      const dirtyNotes = (state.dirtyNoteIds || []).filter((dId) => dId !== id)

      let nextTree = state.splitTree
      const nextPanes: Record<WorkspacePaneId, PaneState> = {}
      Object.entries(state.panes).forEach(([pid, pane]) => {
        const cleaned = computeTabsAfterClose(pane.tabs, pane.activeTabId, id)
        if (cleaned.nextTabs.length === 0 && pid !== 'primary' && nextTree.kind === 'split') {
          const reduced = removeLeafFromTree(nextTree, pid)
          if (reduced) {
            nextTree = reduced
            return
          }
        }
        nextPanes[pid] = {
          ...pane,
          tabs: pid === 'primary' ? nextTabs : cleaned.nextTabs,
          activeTabId: pid === 'primary' ? nextActiveId : cleaned.nextActiveId
        }
      })
      if (!nextPanes.primary) {
        nextPanes.primary = { id: 'primary', tabs: nextTabs, activeTabId: nextActiveId }
      }
      const nextFocus = nextPanes[state.focusedPane] ? state.focusedPane : 'primary'

      return {
        notes: next,
        snippets: next,
        drafts: nextDrafts,
        dirtyNoteIds: dirtyNotes,
        ...buildSyncedPaneFields(nextPanes, nextTree, nextFocus, next),
        selectedNote: nextSelectedNote,
        selectedSnippet: nextSelectedNote
      }
    })

    try {
      await deleteApi(id)
    } catch (err) {
      console.error('[WorkspaceStore] ✗ Delete failed:', err)
      useWorkspaceStore.getState().loadWorkspace()
      throw err
    }
  },

  setFolderColor: async (folderId: string, color: string | null) => {
    try {
      const persistedColors = (await (window as any).api?.getSetting?.('folderColors')) || {}
      const currentColors = { ...persistedColors, ...(get().folderColors || {}) }
      const newColors = { ...currentColors }
      if (color) {
        newColors[folderId] = color
      } else {
        delete newColors[folderId]
      }
      const settingsObj = useSettingsStore.getState().settings as any
      if (settingsObj) {
        settingsObj.folderColors = newColors
      }
      await (window as any).api.saveSetting('folderColors', newColors)
      set({ folderColors: newColors })
    } catch (err) {
      console.error('[WorkspaceStore] Failed to save folder color', err)
    }
  },

  migrateFolderColor: async (oldFolderId: string, newFolderId: string) => {
    if (!oldFolderId || !newFolderId || oldFolderId === newFolderId) return
    try {
      const persistedColors = (await (window as any).api?.getSetting?.('folderColors')) || {}
      const currentColors = { ...persistedColors, ...(get().folderColors || {}) }
      const newColors: Record<string, string> = { ...currentColors }
      let changed = false

      Object.keys(currentColors).forEach((key) => {
        if (key === oldFolderId) {
          newColors[newFolderId] = currentColors[key]
          delete newColors[key]
          changed = true
        } else if (key.startsWith(`${oldFolderId}/`)) {
          const suffix = key.slice(oldFolderId.length)
          newColors[`${newFolderId}${suffix}`] = currentColors[key]
          delete newColors[key]
          changed = true
        }
      })

      if (changed) {
        const settingsObj = useSettingsStore.getState().settings as any
        if (settingsObj) {
          settingsObj.folderColors = newColors
        }
        await (window as any).api?.saveSetting?.('folderColors', newColors)
        set({ folderColors: newColors })
      }
    } catch (err) {
      console.error('[WorkspaceStore] Failed to migrate folder color', err)
    }
  },

  updateNoteSelection: (id: string, selection: any) => {
    set((state: WorkspaceStoreState): any => {
      const allNotes = state.notes || []
      const nextNotes = allNotes.map((n) => (n.id === id ? { ...n, selection } : n))
      const isSelected = state.selectedNote?.id === id
      const nextSelected = isSelected
        ? ({ ...state.selectedNote, selection } as any)
        : state.selectedNote

      return {
        notes: nextNotes,
        selectedNote: nextSelected
      }
    })
  }
}))

let isStoreInitialized = false
let lastWorkspaceState = useWorkspaceStore.getState()
let saveLastNoteTimeout: any = null
let saveOpenTabsTimeout: any = null
let savePinnedTabsTimeout: any = null
let saveSplitLayoutTimeout: any = null

const serializeSplitLayout = (state: WorkspaceStoreState) =>
  state.splitTree.kind === 'split'
    ? { splitTree: state.splitTree, panes: state.panes, focusedPane: state.focusedPane }
    : null

const flushPendingWorkspaceSaves = () => {
  if (saveLastNoteTimeout) {
    clearTimeout(saveLastNoteTimeout)
    saveLastNoteTimeout = null
    const activeTabId = useWorkspaceStore.getState().activeTabId
    ;(window as any).api?.saveSetting('lastNoteId', activeTabId)?.catch?.(() => {})
  }
  if (saveOpenTabsTimeout) {
    clearTimeout(saveOpenTabsTimeout)
    saveOpenTabsTimeout = null
    const openTabs = useWorkspaceStore.getState().openTabs
    ;(window as any).api?.saveSetting('openTabs', openTabs)?.catch?.(() => {})
  }
  if (savePinnedTabsTimeout) {
    clearTimeout(savePinnedTabsTimeout)
    savePinnedTabsTimeout = null
    const pinnedTabIds = useWorkspaceStore.getState().pinnedTabIds
    ;(window as any).api?.saveSetting('pinnedTabIds', pinnedTabIds)?.catch?.(() => {})
  }
  if (saveSplitLayoutTimeout) {
    clearTimeout(saveSplitLayoutTimeout)
    saveSplitLayoutTimeout = null
    const layout = serializeSplitLayout(useWorkspaceStore.getState())
    ;(window as any).api?.saveSetting('splitLayout', layout)?.catch?.(() => {})
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushPendingWorkspaceSaves)
}

useWorkspaceStore.subscribe((state) => {
  if (state.isLoading) return
  if (!isStoreInitialized) {
    if ((state.notes && state.notes.length > 0) || hasLoadedWorkspaceOnce) {
      isStoreInitialized = true
      // 4. Split-view layout persistence: debounced IPC to settings
  if (
    state.splitTree !== lastWorkspaceState.splitTree ||
    state.panes !== lastWorkspaceState.panes ||
    state.focusedPane !== lastWorkspaceState.focusedPane
  ) {
    if (saveSplitLayoutTimeout) clearTimeout(saveSplitLayoutTimeout)
    saveSplitLayoutTimeout = setTimeout(() => {
      saveSplitLayoutTimeout = null
      const layout = serializeSplitLayout(state)
      useSettingsStore.getState().updateSetting?.('splitLayout', layout)
    }, 500)
  }

  lastWorkspaceState = state
    }
    return
  }

  // 1. Open tabs persistence: debounced IPC to settings
  if (state.openTabs !== lastWorkspaceState.openTabs) {
    if (saveOpenTabsTimeout) clearTimeout(saveOpenTabsTimeout)
    saveOpenTabsTimeout = setTimeout(() => {
      saveOpenTabsTimeout = null
      useSettingsStore.getState().updateSetting?.('openTabs', state.openTabs)
    }, 800)
  }

  // 2. Pinned tabs persistence: debounced IPC to settings
  if (state.pinnedTabIds !== lastWorkspaceState.pinnedTabIds) {
    if (savePinnedTabsTimeout) clearTimeout(savePinnedTabsTimeout)
    savePinnedTabsTimeout = setTimeout(() => {
      savePinnedTabsTimeout = null
      useSettingsStore.getState().updateSetting?.('pinnedTabIds', state.pinnedTabIds)
    }, 800)
  }

  // 3. Active tab persistence: in-memory update with debounced IPC
  if (state.activeTabId !== lastWorkspaceState.activeTabId) {
    const settingsObj = useSettingsStore.getState().settings
    if (settingsObj) {
      settingsObj.lastNoteId = state.activeTabId
    }
    if (saveLastNoteTimeout) clearTimeout(saveLastNoteTimeout)
    saveLastNoteTimeout = setTimeout(() => {
      saveLastNoteTimeout = null
      ;(window as any).api?.saveSetting('lastNoteId', state.activeTabId)?.catch?.(() => {})
    }, 1200)
  }

  // 4. Split-view layout persistence: debounced IPC to settings
  if (
    state.splitTree !== lastWorkspaceState.splitTree ||
    state.panes !== lastWorkspaceState.panes ||
    state.focusedPane !== lastWorkspaceState.focusedPane
  ) {
    if (saveSplitLayoutTimeout) clearTimeout(saveSplitLayoutTimeout)
    saveSplitLayoutTimeout = setTimeout(() => {
      saveSplitLayoutTimeout = null
      const layout = serializeSplitLayout(state)
      useSettingsStore.getState().updateSetting?.('splitLayout', layout)
    }, 500)
  }

  lastWorkspaceState = state
})

export const useVaultStore = useWorkspaceStore
export default useWorkspaceStore
