import { create } from 'zustand'
import { useSettingsStore } from './useSettingsStore'
/**
 * Atomic State Store (FB Standard #2)
 */

// Special tab ID for Graph View (not a snippet)
export const GRAPH_TAB_ID = '__graph__'

let selectionTimeout = null

export const useVaultStore = create((set, get) => ({
  snippets: [],
  folders: [],
  folderColors: {},
  selectedSnippet: null,
  isLoading: true,
  searchQuery: '',
  dirtySnippetIds: [],
  openTabs: [], // List of snippet IDs currently open (can include GRAPH_TAB_ID)
  activeTabId: null, // The ID of the currently focused tab
  pinnedTabIds: [], // List of IDs for pinned tabs

  setSnippets: (snippets) => set({ snippets }),

  restoreSession: (tabs, activeId, pinnedIds = []) => {
    set((state) => {
      // Trust the saved tabs; TabBar handles missing snippets gracefully.
      const validTabs = tabs
      const validPinned = pinnedIds

      // Handle active tab: can be a snippet or GRAPH_TAB_ID
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

  // Enhanced selection: Sync with Tab System
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

  closeTab: (id) =>
    set((state) => {
      const nextTabs = state.openTabs.filter((tid) => tid !== id)

      // If we are closing the active tab, find a new one
      let nextActiveId = state.activeTabId
      if (state.activeTabId === id) {
        const idx = state.openTabs.indexOf(id)
        nextActiveId = nextTabs[idx] || nextTabs[idx - 1] || null
      }

      // Handle next selected snippet (only if nextActiveId is not GRAPH_TAB_ID)
      const nextSelected =
        nextActiveId && nextActiveId !== GRAPH_TAB_ID
          ? state.snippets.find((s) => s.id === nextActiveId)
          : null

      return {
        openTabs: nextTabs,
        activeTabId: nextActiveId,
        selectedSnippet: nextSelected
      }
    }),

  reorderTabs: (newTabs) => {
    set((state) => {
      // High-performance boundary enforcement: ensure pinned tabs stay at the start
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

      // Move pinned tabs to the front of openTabs
      const pinnedSet = new Set(nextPinned)
      const pTabs = state.openTabs.filter((tid) => pinnedSet.has(tid))
      const rTabs = state.openTabs.filter((tid) => !pinnedSet.has(tid))

      return {
        pinnedTabIds: nextPinned,
        openTabs: [...pTabs, ...rTabs] // Re-order openTabs based on pinned status
      }
    })
  },

  /**
   * Open Graph View as a Tab
   *
   * Creates a special graph tab that appears in the tab bar alongside regular note tabs.
   * This allows users to switch between graph view and notes seamlessly.
   *
   * The graph tab uses GRAPH_TAB_ID as its identifier and is handled specially
   * throughout the application (not a snippet, but appears in tabs).
   */
  openGraphTab: () =>
    set((state) => {
      const isAlreadyOpen = state.openTabs.includes(GRAPH_TAB_ID)
      const nextTabs = isAlreadyOpen ? state.openTabs : [...state.openTabs, GRAPH_TAB_ID]
      return {
        openTabs: nextTabs,
        activeTabId: GRAPH_TAB_ID,
        selectedSnippet: null // Clear selected snippet when opening graph
      }
    }),

  setPinnedTabs: (pinnedTabIds) => set({ pinnedTabIds }),

  setLoading: (isLoading) => set({ isLoading }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setDirty: (id, isDirty) =>
    set((state) => {
      const hasId = state.dirtySnippetIds.includes(id)

      // No-op if state is already in the desired shape
      if ((isDirty && hasId) || (!isDirty && !hasId)) {
        return state
      }

      const next = isDirty
        ? [...state.dirtySnippetIds, id]
        : state.dirtySnippetIds.filter((dId) => dId !== id)

      return { dirtySnippetIds: next }
    }),

  loadVault: async () => {
    // Only show loading skeleton on initial load to prevent UI flicker
    const isInitialLoad = get().snippets.length === 0
    if (isInitialLoad) {
      set({ isLoading: true })
    }

    try {
      // Background Sync from File System (SQLite via IPC)
      if (window.api?.getSnippets) {
        const freshData = await window.api.getSnippets()

        if (freshData && freshData.snippets) {
          // Merge note colors from settings.json as fallback
          try {
            const noteColors = (await window.api.getSetting('noteColors')) || {}
            const folderColors = (await window.api.getSetting('folderColors')) || {}
            const merged = freshData.snippets.map((s) => ({
              ...s,
              color: s.color || noteColors[s.id] || null
            }))
            set({ snippets: merged, folders: freshData.folders || [], folderColors })
          } catch {
            // settings.json unavailable, use fresh data as-is
            set({
              snippets: freshData.snippets,
              folders: freshData.folders || [],
              folderColors: {}
            })
          }
        } else {
          console.warn('[VaultStore] ✗ Received invalid data from sync.')
        }
      }
    } catch (err) {
      console.error('[VaultStore] ✗ Vault sync failed:', err)
    } finally {
      set({ isLoading: false })
    }
  },

  saveSnippet: async (snippet) => {
    if (!snippet) {
      console.error('[VaultStore] Cannot save: snippet is null or undefined')
      throw new Error('Snippet is required')
    }

    if (!snippet.id) {
      console.error('[VaultStore] Cannot save: snippet ID is missing')
      throw new Error('Snippet ID is required')
    }

    try {
      if (!window.api?.saveSnippet) {
        throw new Error('Save API is not available. Please restart the application.')
      }

      // Sync note color to settings.json when it changes
      const current = get().snippets
      const existing = current.find((s) => s.id === snippet.id)

      // Call IPC save
      const updatedSnippet = await window.api.saveSnippet(snippet)

      if (snippet.color && (!existing || existing.color !== snippet.color)) {
        const currentColors = (await window.api.getSetting('noteColors')) || {}
        await window.api.saveSetting('noteColors', {
          ...currentColors,
          [snippet.id]: snippet.color
        })
      }

      // Update local state by merging the saved snippet
      set((state) => {
        let nextSnippets = state.snippets.map((s) =>
          s.id === snippet.id ? { ...updatedSnippet, color: snippet.color } : s
        )
        const isNew = !state.snippets.some((s) => s.id === snippet.id)
        if (isNew) {
          nextSnippets.push({ ...updatedSnippet, color: snippet.color })
        }

        // Auto-update Wikilinks across the vault if the title changed!
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

          // Save all updated files to disk asynchronously in the background
          updates.forEach((u) => window.api.saveSnippet(u).catch(console.error))
        }

        return {
          snippets: nextSnippets,
          dirtySnippetIds: state.dirtySnippetIds.filter((dId) => dId !== snippet.id)
        }
      })

      if (get().selectedSnippet?.id === snippet.id) {
        set({ selectedSnippet: updatedSnippet })
      }

      // Return the updated snippet so callers can use the cleaned title
      return updatedSnippet
    } catch (err) {
      console.error('[VaultStore] Save failed:', err)
      throw err // Re-throw so callers can handle the error
    }
  },

  deleteSnippet: async (id, skipConfirm = false) => {
    if (!id) {
      console.error('[VaultStore] Cannot delete: ID is missing')
      throw new Error('Snippet ID is required')
    }

    try {
      if (!window.api?.deleteSnippet) {
        throw new Error('Delete API is not available. Please restart the application.')
      }

      if (!skipConfirm) {
        const confirmed = await window.api.confirmDelete('Permenantly delete this note?')
        if (!confirmed) return
      }

      await window.api.deleteSnippet(id)
      const next = get().snippets.filter((s) => s.id !== id)
      set({ snippets: next })

      // Close tab if it was open and update selected snippet
      set((state) => {
        const nextTabs = state.openTabs.filter((tid) => tid !== id)
        const wasOnlyTab = state.openTabs.length === 1
        const isActiveTab = state.activeTabId === id

        let nextActiveId = state.activeTabId
        let nextSelectedSnippet = state.selectedSnippet

        // If the deleted snippet was selected or was the active tab
        if (state.selectedSnippet?.id === id || isActiveTab) {
          if (wasOnlyTab) {
            // This was the only tab open: show welcome page, don't auto-open another
            nextActiveId = null
            nextSelectedSnippet = null
          } else if (nextTabs.length > 0) {
            // Multiple tabs: jump to the next tab
            if (isActiveTab) {
              // Find next tab (use same index, or last if we were at the end)
              const currentIdx = state.openTabs.indexOf(id)
              const nextIdx = currentIdx < nextTabs.length ? currentIdx : nextTabs.length - 1
              nextActiveId = nextTabs[nextIdx]
            } else {
              // Was selected but not active tab, jump to first open tab
              nextActiveId = nextTabs[0]
            }

            // Find the snippet for the next tab (if not graph tab)
            if (nextActiveId !== GRAPH_TAB_ID) {
              nextSelectedSnippet = next.find((s) => s.id === nextActiveId) || null
            } else {
              nextSelectedSnippet = null
            }
          } else {
            // No more tabs open: show welcome page, don't auto-open
            nextActiveId = null
            nextSelectedSnippet = null
          }
        }

        return {
          openTabs: nextTabs,
          activeTabId: nextActiveId,
          selectedSnippet: nextSelectedSnippet
        }
      })
    } catch (err) {
      console.error('[VaultStore] ✗ Delete failed:', err)
      throw err // Re-throw so callers can handle the error
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
      console.error('[VaultStore] Failed to save folder color', err)
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

// Subscribe to state changes to persist tabs directly, bypassing React lifecycles
let lastVaultState = useVaultStore.getState()
useVaultStore.subscribe((state) => {
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
