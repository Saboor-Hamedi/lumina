import { create } from 'zustand'
import { cacheSnippets, getCachedSnippets } from '../db/cache'

/**
 * Atomic State Store (FB Standard #2)
 * Enhanced with IndexedDB Caching for instant startup (#10).
 */
export const useVaultStore = create((set, get) => ({
  snippets: [],
  selectedSnippet: null,
  isLoading: true,
  searchQuery: '',

  setSnippets: (snippets) => set({ snippets }),
  setSelectedSnippet: (snippet) => set({ selectedSnippet: snippet }),
  setLoading: (isLoading) => set({ isLoading }),
  setSearchQuery: (query) => set({ searchQuery: query }),

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
        console.log('[VaultStore] 📡 Syncing from File System...')
        const freshData = await window.api.getSnippets()
        
        if (freshData) {
          console.log(`[VaultStore] ✓ Sync complete. Found ${freshData.length} snippets on disk.`)
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
        const exists = current.find(s => s.id === snippet.id)
        const next = exists
          ? current.map(s => s.id === snippet.id ? snippet : s)
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

  deleteSnippet: async (id) => {
    try {
      if (window.api?.deleteSnippet) {
        const confirmed = await window.api.confirmDelete('Permenantly delete this note?')
        if (!confirmed) return

        await window.api.deleteSnippet(id)
        const next = get().snippets.filter(s => s.id !== id)
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
    set(state => ({
      snippets: state.snippets.map(s => s.id === id ? { ...s, selection } : s),
      selectedSnippet: state.selectedSnippet?.id === id 
        ? { ...state.selectedSnippet, selection } 
        : state.selectedSnippet
    }))

    // FB Standard #11: Robust Persistence (Sync selection to cache debounced)
    const store = get()
    if (this._selectionTimeout) clearTimeout(this._selectionTimeout)
    this._selectionTimeout = setTimeout(() => {
      cacheSnippets(get().snippets).catch(err => console.warn('[VaultStore] Selection cache failed:', err))
    }, 1000)
  }
}))
