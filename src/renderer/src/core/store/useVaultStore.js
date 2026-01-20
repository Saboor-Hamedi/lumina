import { create } from 'zustand'
import { cacheSnippets, getCachedSnippets } from '../db/cache'

/**
 * Atomic State Store (FB Standard #2)
 * Enhanced with IndexedDB Caching for instant startup (#10).
 */

// Special tab ID for Graph View (not a snippet)
export const GRAPH_TAB_ID = '__graph__'

let selectionTimeout = null

export const useVaultStore = create((set, get) => ({
  snippets: [],
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
      // Filter tabs: keep valid snippet IDs and GRAPH_TAB_ID
      const validTabs = tabs.filter(
        (id) => id === GRAPH_TAB_ID || state.snippets.some((s) => s.id === id)
      )
      const validPinned = pinnedIds.filter(
        (id) => id === GRAPH_TAB_ID || state.snippets.some((s) => s.id === id)
      )
      
      // Handle active tab: can be a snippet or GRAPH_TAB_ID
      const activeSnippet =
        activeId === GRAPH_TAB_ID
          ? null
          : state.snippets.find((s) => s.id === activeId) ||
            (validTabs.length && validTabs[0] !== GRAPH_TAB_ID
              ? state.snippets.find((s) => s.id === validTabs[0])
              : null)

      return {
        openTabs: validTabs,
        pinnedTabIds: validPinned,
        activeTabId: activeId && validTabs.includes(activeId) ? activeId : null,
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
      const pTabs = newTabs.filter(tid => pinnedSet.has(tid))
      const rTabs = newTabs.filter(tid => !pinnedSet.has(tid))
      
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
      openTabs: state.openTabs.filter(id => state.pinnedTabIds.includes(id)),
      activeTabId: state.pinnedTabIds.length > 0 ? state.pinnedTabIds[0] : null,
      selectedSnippet: state.pinnedTabIds.length > 0 ? state.snippets.find(s => s.id === state.pinnedTabIds[0]) : null
    }))
  },

  togglePinTab: (id) => {
    set((state) => {
      const isPinned = state.pinnedTabIds.includes(id)
      const nextPinned = isPinned
        ? state.pinnedTabIds.filter(pid => pid !== id)
        : [...state.pinnedTabIds, id]
      
      // Move pinned tabs to the front of openTabs
      const pinnedSet = new Set(nextPinned)
      const pTabs = state.openTabs.filter(tid => pinnedSet.has(tid))
      const rTabs = state.openTabs.filter(tid => !pinnedSet.has(tid))
      
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
      const next = isDirty
        ? [...new Set([...state.dirtySnippetIds, id])]
        : state.dirtySnippetIds.filter((dId) => dId !== id)
      return { dirtySnippetIds: next }
    }),

  loadVault: async () => {
    // Initializing Vault Load (silent)
    set({ isLoading: true })

    // 1. Instant Load from Cache (Zero-Jump)
    try {
      const cached = await getCachedSnippets()
      if (cached && cached.length > 0) {
        set({ snippets: cached, isLoading: false })
      }
    } catch (err) {
      console.warn('[VaultStore] Cache read error:', err)
    }

    try {
      // 2. Background Sync from File System
      if (window.api?.getSnippets) {
        const freshData = await window.api.getSnippets()

        if (freshData) {
          set({ snippets: freshData })
          // 3. Update Cache for next visit
          await cacheSnippets(freshData)
        } else {
          console.warn('[VaultStore] ✗ Received invalid data from sync, keeping cache state.')
        }
      }
    } catch (err) {
      console.error('[VaultStore] ✗ Vault sync failed:', err)
    } finally {
      set({ isLoading: false })
    }
  },

  saveSnippet: async (snippet) => {
    try {
      if (window.api?.saveSnippet) {
        await window.api.saveSnippet(snippet)

        const current = get().snippets
        const exists = current.find((s) => s.id === snippet.id)
        const next = exists
          ? current.map((s) => (s.id === snippet.id ? snippet : s))
          : [snippet, ...current]

        // Save complete (silent)
        set({ snippets: next })
        await cacheSnippets(next)

        if (get().selectedSnippet?.id === snippet.id) {
          set({ selectedSnippet: snippet })
        }
      }
    } catch (err) {
      console.error('Save failed:', err)
    }
  },

  deleteSnippet: async (id, skipConfirm = false) => {
    try {
      if (window.api?.deleteSnippet) {
        if (!skipConfirm) {
          const confirmed = await window.api.confirmDelete('Permenantly delete this note?')
          if (!confirmed) return
        }

        await window.api.deleteSnippet(id)
        const next = get().snippets.filter((s) => s.id !== id)
        set({ snippets: next })
        await cacheSnippets(next)

        if (get().selectedSnippet?.id === id) {
          set({ selectedSnippet: next.length ? next[0] : null })
        }
      }
    } catch (err) {
      console.error('Delete failed:', err)
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

    // FB Standard #11: Robust Persistence (Sync selection to cache debounced)
    if (selectionTimeout) clearTimeout(selectionTimeout)
    selectionTimeout = setTimeout(() => {
      cacheSnippets(get().snippets).catch((err) =>
        console.warn('[VaultStore] Selection cache failed:', err)
      )
    }, 1000)
  }
}))
