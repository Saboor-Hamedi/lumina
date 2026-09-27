import { create } from 'zustand'
import { useSettingsStore } from './SettingStore'

export const GRAPH_TAB_ID = '__graph__'
export const LUMINA_TAB_ID = '__lumina__'

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
  clipboard: any

  setNotes: (notes: WorkspaceNote[]) => void
  setSelectedFolder: (selectedFolder: string | null) => void
  setClipboard: (clipboard: any) => void
  restoreSession: (tabs: string[], activeId: string | null, pinnedIds?: string[]) => void
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
  setPinnedTabs: (pinnedTabIds: string[]) => void
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
  updateNoteSelection: (id: string, selection: any) => void
  reorderNotes: (orderedIds: string[]) => void

  // Backward compatibility properties & methods
  snippets?: WorkspaceNote[]
  selectedSnippet?: WorkspaceNote | null
  setSelectedSnippet?: (note: WorkspaceNote | null) => void
  saveSnippet?: (note: Partial<WorkspaceNote> & { id: string }) => Promise<any>
  deleteSnippet?: (id: string, skipConfirm?: boolean) => Promise<void>
}

let hasLoadedWorkspaceOnce = false
const recentlyDeletedIds = new Set<string>()

const persistNotesSnapshot = (notes: WorkspaceNote[], openTabs: string[] = []): void => {
  try {
    const openSet = new Set(openTabs)
    const slim = (notes || []).map((n) => {
      if (openSet.has(n.id)) return n
      const { code, ...rest } = n
      return rest
    })
    localStorage.setItem('lumina_session_notes', JSON.stringify(slim))
  } catch (err) {
    try {
      const metadataOnly = (notes || []).map(({ code, ...rest }) => rest)
      localStorage.setItem('lumina_session_notes', JSON.stringify(metadataOnly))
    } catch (_) {}
  }
}

const persistFoldersSnapshot = (folders: string[]): void => {
  try {
    if (Array.isArray(folders)) {
      localStorage.setItem('lumina_session_folders', JSON.stringify(folders))
    }
  } catch (_) {}
}

const getCachedSession = () => {
  try {
    const rawNotes = localStorage.getItem('lumina_session_notes')
    const rawFolders = localStorage.getItem('lumina_session_folders')
    const rawTabs = localStorage.getItem('lumina_session_openTabs')
    const rawPinned = localStorage.getItem('lumina_session_pinnedTabIds')
    const lastNoteId = localStorage.getItem('lumina_session_lastNoteId')

    const notes: WorkspaceNote[] = rawNotes ? JSON.parse(rawNotes) : []
    const parsedFolders: string[] = rawFolders ? JSON.parse(rawFolders) : []

    // Always derive all folders from notes AND merge with cached folders
    const folderSet = new Set<string>(Array.isArray(parsedFolders) ? parsedFolders : [])
    notes.forEach((n) => {
      if (n.folderId && typeof n.folderId === 'string') {
        const clean = n.folderId.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
        let current = ''
        clean.split('/').filter(Boolean).forEach((part) => {
          current = current ? `${current}/${part}` : part
          folderSet.add(current)
        })
      }
    })
    const folders = Array.from(folderSet)

    const openTabs: string[] = rawTabs ? JSON.parse(rawTabs) : []
    const pinnedTabIds: string[] = rawPinned ? JSON.parse(rawPinned) : []
    const noteIdSet = new Set(notes.map((n) => n.id))
    const validTabs = openTabs.filter(
      (id) => id === GRAPH_TAB_ID || id === LUMINA_TAB_ID || noteIdSet.has(id)
    )
    const validPinned = pinnedTabIds.filter((id) => validTabs.includes(id))
    const activeTabId =
      lastNoteId && validTabs.includes(lastNoteId) ? lastNoteId : validTabs[0] || null
    const selectedNote =
      activeTabId && activeTabId !== GRAPH_TAB_ID && activeTabId !== LUMINA_TAB_ID
        ? notes.find((n) => n.id === activeTabId) || null
        : null

    if (folders.length > 0 && (!parsedFolders || parsedFolders.length < folders.length)) {
      persistFoldersSnapshot(folders)
    }

    return {
      notes,
      folders,
      openTabs: validTabs,
      pinnedTabIds: validPinned,
      activeTabId,
      selectedNote,
      isLoading: notes.length === 0
    }
  } catch {
    return {
      notes: [],
      folders: [],
      openTabs: [],
      pinnedTabIds: [],
      activeTabId: null,
      selectedNote: null,
      isLoading: true
    }
  }
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
  clipboard: null,

  setNotes: (notes: WorkspaceNote[]) => set({ notes, snippets: notes }),
  setSelectedFolder: (selectedFolder: string | null) => set({ selectedFolder }),
  setClipboard: (clipboard: any) => set({ clipboard }),

  restoreSession: (tabs: string[], activeId: string | null, pinnedIds: string[] = []) => {
    set((state) => {
      const allNotes = state.notes || []
      const validTabs = tabs.filter(
        (id) =>
          id === GRAPH_TAB_ID ||
          id === LUMINA_TAB_ID ||
          allNotes.some((idMatch) => idMatch.id === id)
      )
      const validPinned = pinnedIds.filter((id) => validTabs.includes(id))

      const validActiveId = activeId && validTabs.includes(activeId) ? activeId : null
      const finalActiveId = validActiveId || (validTabs.length ? validTabs[0] : null)

      const activeNote =
        finalActiveId === GRAPH_TAB_ID || finalActiveId === LUMINA_TAB_ID
          ? null
          : finalActiveId
            ? allNotes.find((n) => n.id === finalActiveId) || null
            : null

      return {
        openTabs: validTabs,
        pinnedTabIds: validPinned,
        activeTabId: finalActiveId,
        selectedNote: activeNote,
        selectedSnippet: activeNote
      }
    })
  },

  setSelectedNote: (note: WorkspaceNote | null) => {
    if (!note) {
      set({ selectedNote: null, selectedSnippet: null, activeTabId: null })
      return
    }

    set((state) => {
      if (
        state.activeTabId === note.id &&
        state.selectedNote?.id === note.id &&
        state.openTabs.includes(note.id)
      ) {
        return state
      }
      const isAlreadyOpen = state.openTabs.includes(note.id)
      const nextTabs = isAlreadyOpen ? state.openTabs : [...state.openTabs, note.id]
      return {
        selectedNote: note,
        selectedSnippet: note,
        openTabs: nextTabs,
        activeTabId: note.id
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
        (!id ||
          state.selectedNote?.id === id ||
          id === GRAPH_TAB_ID ||
          id === LUMINA_TAB_ID)
      ) {
        return state
      }
      if (id === GRAPH_TAB_ID) {
        const isAlreadyOpen = state.openTabs.includes(GRAPH_TAB_ID)
        const nextTabs = isAlreadyOpen ? state.openTabs : [...state.openTabs, GRAPH_TAB_ID]
        return {
          activeTabId: GRAPH_TAB_ID,
          selectedNote: null,
          selectedSnippet: null,
          openTabs: nextTabs
        }
      }
      if (id === LUMINA_TAB_ID) {
        const isAlreadyOpen = state.openTabs.includes(LUMINA_TAB_ID)
        const nextTabs = isAlreadyOpen ? state.openTabs : [...state.openTabs, LUMINA_TAB_ID]
        return {
          activeTabId: LUMINA_TAB_ID,
          selectedNote: null,
          selectedSnippet: null,
          openTabs: nextTabs
        }
      }
      if (!id) {
        return { activeTabId: null, selectedNote: null, selectedSnippet: null }
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
        openTabs: nextTabs
      }
    })
  },

  closeTab: (id: string) =>
    set((state) => {
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

      const allNotes = state.notes || []
      const nextSelected =
        nextActiveId &&
        nextActiveId !== GRAPH_TAB_ID &&
        nextActiveId !== LUMINA_TAB_ID
          ? allNotes.find((n) => n.id === nextActiveId) || null
          : null

      return {
        openTabs: nextTabs,
        activeTabId: nextActiveId,
        selectedNote: nextSelected
      }
    }),

  reorderTabs: (newTabs: string[]) => {
    set((state) => {
      const pinnedSet = new Set(state.pinnedTabIds)
      const pTabs = newTabs.filter((tid) => pinnedSet.has(tid))
      const rTabs = newTabs.filter((tid) => !pinnedSet.has(tid))

      return { openTabs: [...pTabs, ...rTabs] }
    })
  },

  closeOtherTabs: (keepId: string) => {
    set((state) => {
      const nextActiveId = keepId
      const allNotes = state.notes || []
      const nextSelected = allNotes.find((n) => n.id === keepId) || null
      return {
        openTabs: [keepId],
        activeTabId: nextActiveId,
        selectedNote: nextSelected
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
        activeTabId: nextActiveId,
        selectedNote: nextSelected
      }
    })
  },

  closeAllTabs: () => {
    set((state) => {
      const allNotes = state.notes || []
      const activeId = state.pinnedTabIds.length > 0 ? state.pinnedTabIds[0] : null
      const activeNote =
        activeId ? allNotes.find((n) => n.id === activeId) || null : null
      return {
        openTabs: state.openTabs.filter((id) => state.pinnedTabIds.includes(id)),
        activeTabId: activeId,
        selectedNote: activeNote
      }
    })
  },

  togglePinTab: (id: string) => {
    set((state) => {
      const isPinned = state.pinnedTabIds.includes(id)
      const nextPinned = isPinned
        ? state.pinnedTabIds.filter((pid) => pid !== id)
        : [...state.pinnedTabIds, id]

      const pinnedSet = new Set(nextPinned)
      const pTabs = state.openTabs.filter((tid) => pinnedSet.has(tid))
      const rTabs = state.openTabs.filter((tid) => !pinnedSet.has(tid))

      return {
        pinnedTabIds: nextPinned,
        openTabs: [...pTabs, ...rTabs]
      }
    })
  },

  openGraphTab: () =>
    set((state) => {
      const isAlreadyOpen = state.openTabs.includes(GRAPH_TAB_ID)
      const nextTabs = isAlreadyOpen ? state.openTabs : [...state.openTabs, GRAPH_TAB_ID]
      return {
        openTabs: nextTabs,
        activeTabId: GRAPH_TAB_ID,
        selectedNote: null
      }
    }),

  openLuminaTab: () =>
    set((state) => {
      const isAlreadyOpen = state.openTabs.includes(LUMINA_TAB_ID)
      const nextTabs = isAlreadyOpen ? state.openTabs : [...state.openTabs, LUMINA_TAB_ID]
      return {
        openTabs: nextTabs,
        activeTabId: LUMINA_TAB_ID,
        selectedNote: null,
        selectedSnippet: null
      }
    }),

  setPinnedTabs: (pinnedTabIds: string[]) => set({ pinnedTabIds }),

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

      const next = isDirty
        ? [...currentDirty, id]
        : currentDirty.filter((dId) => dId !== id)

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

          try {
            let allSettings = useSettingsStore.getState().settings as any
            if (!allSettings || Object.keys(allSettings).length === 0) {
              allSettings = (await (window as any).api.getSetting()) || {}
            }
            const noteColors = allSettings.noteColors || {}
            folderColors = allSettings.folderColors || {}
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
            }
          } catch {
            folderColors = {}
          }

          const noteIdSet = new Set(merged.map((n) => n.id))
          const validTabs = persistedOpenTabs.filter(
            (id) => id === GRAPH_TAB_ID || id === LUMINA_TAB_ID || noteIdSet.has(id)
          )
          const validPinned = persistedPinnedTabs.filter((id) => validTabs.includes(id))
          const validActiveId =
            persistedActiveId && validTabs.includes(persistedActiveId)
              ? persistedActiveId
              : validTabs[0] || null
          const activeNote =
            validActiveId &&
            validActiveId !== GRAPH_TAB_ID &&
            validActiveId !== LUMINA_TAB_ID
              ? merged.find((n) => n.id === validActiveId) || null
              : null

          const rawFolderList: string[] = freshData.folders || []
          const folderSet = new Set<string>(rawFolderList)
          merged.forEach((n) => {
            if (n.folderId && typeof n.folderId === 'string') {
              const clean = n.folderId.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
              let current = ''
              clean.split('/').filter(Boolean).forEach((part) => {
                current = current ? `${current}/${part}` : part
                folderSet.add(current)
              })
            }
          })
          const allFolders = Array.from(folderSet)

          set({
            notes: merged,
            folders: allFolders,
            folderColors,
            openTabs: validTabs,
            pinnedTabIds: validPinned,
            activeTabId: validActiveId,
            selectedNote: activeNote
          })

          // Write fresh session keys for next cold start
          persistNotesSnapshot(merged, validTabs)
          persistFoldersSnapshot(allFolders)
          try {
            localStorage.setItem('lumina_session_openTabs', JSON.stringify(validTabs))
            localStorage.setItem('lumina_session_pinnedTabIds', JSON.stringify(validPinned))
            localStorage.setItem('lumina_session_lastNoteId', validActiveId ?? '')
          } catch {}
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

        if (existing && existing.title && updatedNote?.title && existing.title !== updatedNote.title) {
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
        nextActiveId &&
        nextActiveId !== GRAPH_TAB_ID &&
        nextActiveId !== LUMINA_TAB_ID
          ? next.find((n) => n.id === nextActiveId) || null
          : null

      const nextDrafts = { ...state.drafts }
      delete nextDrafts[id]

      const dirtyNotes = (state.dirtyNoteIds || []).filter((dId) => dId !== id)

      return {
        notes: next,
        snippets: next,
        openTabs: nextTabs,
        activeTabId: nextActiveId,
        selectedNote: nextSelectedNote,
        selectedSnippet: nextSelectedNote,
        drafts: nextDrafts,
        dirtyNoteIds: dirtyNotes
      }
    })

    persistNotesSnapshot(get().notes, get().openTabs)
    persistFoldersSnapshot(get().folders)
    try {
      localStorage.setItem('lumina_session_openTabs', JSON.stringify(get().openTabs))
    } catch {}

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
      const currentColors = (await (window as any).api.getSetting('folderColors')) || {}
      const newColors = { ...currentColors }
      if (color) {
        newColors[folderId] = color
      } else {
        delete newColors[folderId]
      }
      await (window as any).api.saveSetting('folderColors', newColors)
      set({ folderColors: newColors })
    } catch (err) {
      console.error('[WorkspaceStore] Failed to save folder color', err)
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
  },

  reorderNotes: (orderedIds: string[]) => {
    useSettingsStore.getState().updateSetting('noteOrder', orderedIds)
  }
}))

let isStoreInitialized = false
let lastWorkspaceState = useWorkspaceStore.getState()

useWorkspaceStore.subscribe((state) => {
  if (state.isLoading) return
  if (!isStoreInitialized) {
    if (
      (state.notes && state.notes.length > 0) ||
      hasLoadedWorkspaceOnce
    ) {
      isStoreInitialized = true
      lastWorkspaceState = state
    }
    return
  }
  if (state.openTabs !== lastWorkspaceState.openTabs) {
    useSettingsStore.getState().updateSetting?.('openTabs', state.openTabs)
    ;(window as any).api?.saveSetting('openTabs', state.openTabs)?.catch?.(() => {})
    try { localStorage.setItem('lumina_session_openTabs', JSON.stringify(state.openTabs)) } catch {}
  }
  if (state.pinnedTabIds !== lastWorkspaceState.pinnedTabIds) {
    useSettingsStore.getState().updateSetting?.('pinnedTabIds', state.pinnedTabIds)
    ;(window as any).api?.saveSetting('pinnedTabIds', state.pinnedTabIds)?.catch?.(() => {})
    try { localStorage.setItem('lumina_session_pinnedTabIds', JSON.stringify(state.pinnedTabIds)) } catch {}
  }
  if (state.activeTabId !== lastWorkspaceState.activeTabId) {
    useSettingsStore.getState().updateSetting?.('lastNoteId', state.activeTabId)
    ;(window as any).api?.saveSetting('lastNoteId', state.activeTabId)?.catch?.(() => {})
    try { localStorage.setItem('lumina_session_lastNoteId', state.activeTabId ?? '') } catch {}
  }
  lastWorkspaceState = state
})

export const useVaultStore = useWorkspaceStore
export default useWorkspaceStore
