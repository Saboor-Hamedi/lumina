import { create } from 'zustand'
import { useSettingsStore } from './useSettingsStore'

export const GRAPH_TAB_ID = '__graph__'

let selectionTimeout = null

export const useWorkspaceStore = create((set, get) => ({
  snippets: [],
  folders: [],
  folderColors: {},
  selectedSnippet: null,
  selectedFolder: null,
  isLoading: true,
  searchQuery: '',
  dirtySnippetIds: [],
  drafts: {},
  openTabs: [],
  activeTabId: null,
  pinnedTabIds: [],
  clipboard: null,

  setSnippets: (snippets) => set({ snippets }),
  setSelectedFolder: (selectedFolder) => set({ selectedFolder }),
  setClipboard: (clipboard) => set({ clipboard }),

  restoreSession: (tabs, activeId, pinnedIds = []) => {
    set((state) => {
      const validTabs = tabs.filter(
        (id) => id === GRAPH_TAB_ID || state.snippets.some((s) => s.id === id)
      )
      const validPinned = pinnedIds.filter((id) => validTabs.includes(id))

      const validActiveId = activeId && validTabs.includes(activeId) ? activeId : null
      const finalActiveId = validActiveId || (validTabs.length ? validTabs[0] : null)

      const activeSnippet =
        finalActiveId === GRAPH_TAB_ID
          ? null
          : finalActiveId
            ? state.snippets.find((s) => s.id === finalActiveId)
            : null

      return {
        openTabs: validTabs,
        pinnedTabIds: validPinned,
        activeTabId: finalActiveId,
        selectedSnippet: activeSnippet
      }
    })
  },

  setSelectedSnippet: (snippet) => {
    if (!snippet) {
      set({ selectedSnippet: null, activeTabId: null })
      return
    }

    set((state) => {
      const isAlreadyOpen = state.openTabs.includes(snippet.id)
      const nextTabs = isAlreadyOpen ? state.openTabs : [...state.openTabs, snippet.id]
      return {
        selectedSnippet: snippet,
        openTabs: nextTabs,
        activeTabId: snippet.id
      }
    })
  },

  setActiveTabId: (id) => {
    set((state) => {
      if (id === GRAPH_TAB_ID) {
        const isAlreadyOpen = state.openTabs.includes(GRAPH_TAB_ID)
        const nextTabs = isAlreadyOpen ? state.openTabs : [...state.openTabs, GRAPH_TAB_ID]
        return {
          activeTabId: GRAPH_TAB_ID,
          selectedSnippet: null,
          openTabs: nextTabs
        }
      }
      if (!id) {
        return { activeTabId: null, selectedSnippet: null }
      }
      const snippet = state.snippets.find((s) => s.id === id) || null
      const isAlreadyOpen = state.openTabs.includes(id)
      const nextTabs = isAlreadyOpen ? state.openTabs : [...state.openTabs, id]
      return {
        activeTabId: id,
        selectedSnippet: snippet,
        openTabs: nextTabs
      }
    })
  },

  closeTab: (id) =>
    set((state) => {
      const nextTabs = state.openTabs.filter((tid) => tid !== id)

      let nextActiveId = state.activeTabId
      if (
        state.activeTabId === id ||
        state.selectedSnippet?.id === id ||
        !nextTabs.includes(nextActiveId)
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

      const nextSelected =
        nextActiveId && nextActiveId !== GRAPH_TAB_ID
          ? state.snippets.find((s) => s.id === nextActiveId) || null
          : null

      return {
        openTabs: nextTabs,
        activeTabId: nextActiveId,
        selectedSnippet: nextSelected
      }
    }),

  reorderTabs: (newTabs) => {
    set((state) => {
      const pinnedSet = new Set(state.pinnedTabIds)
      const pTabs = newTabs.filter((tid) => pinnedSet.has(tid))
      const rTabs = newTabs.filter((tid) => !pinnedSet.has(tid))

      return { openTabs: [...pTabs, ...rTabs] }
    })
  },

  closeOtherTabs: (keepId) => {
    set((state) => {
      const nextActiveId = keepId
      const nextSelected = state.snippets.find((s) => s.id === keepId)
      return {
        openTabs: [keepId],
        activeTabId: nextActiveId,
        selectedSnippet: nextSelected
      }
    })
  },

  closeTabsToRight: (id) => {
    set((state) => {
      const idx = state.openTabs.indexOf(id)
      const nextTabs = state.openTabs.slice(0, idx + 1)
      let nextActiveId = state.activeTabId
      if (!nextTabs.includes(state.activeTabId)) {
        nextActiveId = id
      }
      const nextSelected = state.snippets.find((s) => s.id === nextActiveId)
      return {
        openTabs: nextTabs,
        activeTabId: nextActiveId,
        selectedSnippet: nextSelected
      }
    })
  },

  closeAllTabs: () => {
    set((state) => ({
      openTabs: state.openTabs.filter((id) => state.pinnedTabIds.includes(id)),
      activeTabId: state.pinnedTabIds.length > 0 ? state.pinnedTabIds[0] : null,
      selectedSnippet:
        state.pinnedTabIds.length > 0
          ? state.snippets.find((s) => s.id === state.pinnedTabIds[0])
          : null
    }))
  },

  togglePinTab: (id) => {
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
        selectedSnippet: null
      }
    }),

  setPinnedTabs: (pinnedTabIds) => set({ pinnedTabIds }),

  setLoading: (isLoading) => set({ isLoading }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setDraft: (id, code) =>
    set((state) => ({
      drafts: { ...state.drafts, [id]: code }
    })),
  setDirty: (id, isDirty) =>
    set((state) => {
      const hasId = state.dirtySnippetIds.includes(id)

      if ((isDirty && hasId) || (!isDirty && !hasId)) {
        return state
      }

      const next = isDirty
        ? [...state.dirtySnippetIds, id]
        : state.dirtySnippetIds.filter((dId) => dId !== id)

      return { dirtySnippetIds: next }
    }),

  loadVault: async () => {
    const isInitialLoad = get().snippets.length === 0
    if (isInitialLoad) {
      set({ isLoading: true })
    }

    try {
      if (window.api?.getSnippets) {
        const freshData = await window.api.getSnippets()

        if (freshData && freshData.snippets) {
          let merged = freshData.snippets
          let folderColors = {}
          let persistedOpenTabs = get().openTabs
          let persistedPinnedTabs = get().pinnedTabIds
          let persistedActiveId = get().activeTabId

          try {
            const allSettings = (await window.api.getSetting()) || {}
            const noteColors = allSettings.noteColors || {}
            folderColors = allSettings.folderColors || {}
            merged = freshData.snippets.map((s) => ({
              ...s,
              color: s.color || noteColors[s.id] || null
            }))

            if (isInitialLoad || persistedOpenTabs.length === 0) {
              if (Array.isArray(allSettings.openTabs) && allSettings.openTabs.length > 0) {
                persistedOpenTabs = allSettings.openTabs
              }
              if (Array.isArray(allSettings.pinnedTabIds)) {
                persistedPinnedTabs = allSettings.pinnedTabIds
              }
              if (allSettings.lastSnippetId) {
                persistedActiveId = allSettings.lastSnippetId
              }
            }
          } catch {
            folderColors = {}
          }

          const snippetIdSet = new Set(merged.map((s) => s.id))
          const validTabs = persistedOpenTabs.filter(
            (id) => id === GRAPH_TAB_ID || snippetIdSet.has(id)
          )
          const validPinned = persistedPinnedTabs.filter((id) => validTabs.includes(id))
          const validActiveId =
            persistedActiveId && validTabs.includes(persistedActiveId)
              ? persistedActiveId
              : validTabs[0] || null
          const activeSnippet =
            validActiveId && validActiveId !== GRAPH_TAB_ID
              ? merged.find((s) => s.id === validActiveId) || null
              : null

          set({
            snippets: merged,
            folders: freshData.folders || [],
            folderColors,
            openTabs: validTabs,
            pinnedTabIds: validPinned,
            activeTabId: validActiveId,
            selectedSnippet: activeSnippet
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

  saveSnippet: async (snippet) => {
    if (!snippet) {
      console.error('[WorkspaceStore] Cannot save: snippet is null or undefined')
      throw new Error('Snippet is required')
    }

    if (!snippet.id) {
      console.error('[WorkspaceStore] Cannot save: snippet ID is missing')
      throw new Error('Snippet ID is required')
    }

    try {
      if (!window.api?.saveSnippet) {
        throw new Error('Save API is not available. Please restart the application.')
      }

      const current = get().snippets
      const existing = current.find((s) => s.id === snippet.id)

      const updatedSnippet = await window.api.saveSnippet(snippet)

      if (snippet.color && (!existing || existing.color !== snippet.color)) {
        const currentColors = (await window.api.getSetting('noteColors')) || {}
        await window.api.saveSetting('noteColors', {
          ...currentColors,
          [snippet.id]: snippet.color
        })
      }

      set((state) => {
        let nextSnippets = state.snippets.map((s) =>
          s.id === snippet.id ? { ...updatedSnippet, color: snippet.color } : s
        )
        const isNew = !state.snippets.some((s) => s.id === snippet.id)
        if (isNew) {
          nextSnippets.push({ ...updatedSnippet, color: snippet.color })
        }

        const nextDrafts = { ...state.drafts }
        delete nextDrafts[snippet.id]

        if (existing && existing.title && existing.title !== updatedSnippet.title) {
          const oldTitle = existing.title
          const newTitle = updatedSnippet.title
          const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const linkRegex = new RegExp('\\[\\[' + escapeRegExp(oldTitle) + '([\\|#\\]])', 'gi')

          const updates = []
          nextSnippets = nextSnippets.map((s) => {
            if (s.id !== snippet.id && s.code && linkRegex.test(s.code)) {
              const newCode = s.code.replace(linkRegex, '[[' + newTitle + '$1')
              const updatedLinkSnippet = { ...s, code: newCode }
              updates.push(updatedLinkSnippet)
              return updatedLinkSnippet
            }
            return s
          })

          updates.forEach((u) => window.api.saveSnippet(u).catch(console.error))
        }

        return {
          snippets: nextSnippets,
          drafts: nextDrafts,
          dirtySnippetIds: state.dirtySnippetIds.filter((dId) => dId !== snippet.id)
        }
      })

      if (get().selectedSnippet?.id === snippet.id) {
        set({ selectedSnippet: updatedSnippet })
      }

      return updatedSnippet
    } catch (err) {
      console.error('[WorkspaceStore] Save failed:', err)
      throw err
    }
  },

  deleteSnippet: async (id, skipConfirm = false) => {
    if (!id) {
      console.error('[WorkspaceStore] Cannot delete: ID is missing')
      throw new Error('Snippet ID is required')
    }

    if (!window.api?.deleteSnippet) {
      throw new Error('Delete API is not available. Please restart the application.')
    }

    if (!skipConfirm) {
      const confirmed = await window.api.confirmDelete('Permanently delete this note?')
      if (!confirmed) return
    }

    set((state) => {
      const next = state.snippets.filter((s) => s.id !== id)
      const nextTabs = state.openTabs.filter((tid) => tid !== id)

      let nextActiveId = state.activeTabId
      if (
        state.activeTabId === id ||
        state.selectedSnippet?.id === id ||
        !nextTabs.includes(nextActiveId)
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

      const nextSelectedSnippet =
        nextActiveId && nextActiveId !== GRAPH_TAB_ID
          ? next.find((s) => s.id === nextActiveId) || null
          : null

      const nextDrafts = { ...state.drafts }
      delete nextDrafts[id]

      return {
        snippets: next,
        openTabs: nextTabs,
        activeTabId: nextActiveId,
        selectedSnippet: nextSelectedSnippet,
        drafts: nextDrafts,
        dirtySnippetIds: state.dirtySnippetIds.filter((dId) => dId !== id)
      }
    })

    try {
      await window.api.deleteSnippet(id)
    } catch (err) {
      console.error('[WorkspaceStore] ✗ Delete failed:', err)
      useWorkspaceStore.getState().loadVault()
      throw err
    }
  },

  setFolderColor: async (folderId, color) => {
    try {
      const currentColors = (await window.api.getSetting('folderColors')) || {}
      const newColors = { ...currentColors }
      if (color) {
        newColors[folderId] = color
      } else {
        delete newColors[folderId]
      }
      await window.api.saveSetting('folderColors', newColors)
      set({ folderColors: newColors })
    } catch (err) {
      console.error('[WorkspaceStore] Failed to save folder color', err)
    }
  },

  updateSnippetSelection: (id, selection) => {
    set((state) => ({
      snippets: state.snippets.map((s) => (s.id === id ? { ...s, selection } : s)),
      selectedSnippet:
        state.selectedSnippet?.id === id
          ? { ...state.selectedSnippet, selection }
          : state.selectedSnippet
    }))
  },

  reorderSnippets: (orderedIds) => {
    useSettingsStore.getState().updateSetting('noteOrder', orderedIds)
  }
}))

let isStoreInitialized = false
let lastVaultState = useWorkspaceStore.getState()

useWorkspaceStore.subscribe((state) => {
  if (state.isLoading) return
  if (!isStoreInitialized) {
    if (state.snippets.length > 0) {
      isStoreInitialized = true
      lastVaultState = state
    }
    return
  }
  if (state.openTabs !== lastVaultState.openTabs) {
    window.api?.saveSetting('openTabs', state.openTabs)
  }
  if (state.pinnedTabIds !== lastVaultState.pinnedTabIds) {
    window.api?.saveSetting('pinnedTabIds', state.pinnedTabIds)
  }
  if (state.activeTabId !== lastVaultState.activeTabId) {
    window.api?.saveSetting('lastSnippetId', state.activeTabId)
  }
  lastVaultState = state
})

export const useVaultStore = useWorkspaceStore
export default useWorkspaceStore
