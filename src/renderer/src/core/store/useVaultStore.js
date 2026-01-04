import { create } from 'zustand'
import { cacheSnippets, getCachedSnippets } from '../db/cache'

/**
 * Atomic State Store (FB Standard #2)
 * Enhanced with IndexedDB Caching for instant startup (#10).
 */
let selectionTimeout = null

export const useVaultStore = create((set, get) => ({
  snippets: [],
  selectedSnippet: null,
  isLoading: true,
  searchQuery: '',
  dirtySnippetIds: [],
  openTabs: [], // List of snippet IDs currently open
  activeTabId: null, // The ID of the currently focused tab

  setSnippets: (snippets) => set({ snippets }),

  restoreSession: (tabs, activeId) => {
    set((state) => {
      const validTabs = tabs.filter((id) => state.snippets.some((s) => s.id === id))
      const activeSnippet =
        state.snippets.find((s) => s.id === activeId) ||
        (validTabs.length ? state.snippets.find((s) => s.id === validTabs[0]) : null)

      return {
        openTabs: validTabs,
        activeTabId: activeSnippet ? activeSnippet.id : null,
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
      const nextTabs = state.dirtySnippetIds.includes(id)
        ? state.openTabs // Prevent closing if dirty? Or let the component handle the modal?
        : state.openTabs.filter((tid) => tid !== id)

      // If we are closing the active tab, find a new one
      let nextActiveId = state.activeTabId
      if (state.activeTabId === id) {
        const idx = state.openTabs.indexOf(id)
        nextActiveId = state.openTabs[idx + 1] || state.openTabs[idx - 1] || null
      }

      const nextSelected = nextActiveId ? state.snippets.find((s) => s.id === nextActiveId) : null

      return {
        openTabs: state.openTabs.filter((tid) => tid !== id),
        activeTabId: nextActiveId,
        selectedSnippet: nextSelected
      }
    }),

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
    console.log('[VaultStore] 🚀 Initializing Vault Load...')
    set({ isLoading: true })

    // 1. Instant Load from Cache (Zero-Jump)
    try {
      const cached = await getCachedSnippets()
      if (cached && cached.length > 0) {
        console.log(`[VaultStore] ✓ Loaded ${cached.length} snippets from IndexedDB cache`)
        set({ snippets: cached, isLoading: false })
      } else {
        console.log('[VaultStore] Cache is empty, waiting for file system...')
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

        console.log(`[VaultStore] ✓ Save complete. ID: ${snippet.id}. Existed: ${!!exists}`)
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
