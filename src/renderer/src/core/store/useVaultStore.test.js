import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useVaultStore, GRAPH_TAB_ID } from './useVaultStore'

// Mock the cache module
vi.mock('../db/cache', () => ({
  cacheSnippets: vi.fn(() => Promise.resolve()),
  getCachedSnippets: vi.fn(() => Promise.resolve([]))
}))

describe('useVaultStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useVaultStore.setState({
      snippets: [],
      selectedSnippet: null,
      isLoading: false,
      searchQuery: '',
      dirtySnippetIds: [],
      openTabs: [],
      activeTabId: null,
      pinnedTabIds: []
    })
  })

  describe('setSnippets', () => {
    it('sets snippets array', () => {
      const snippets = [
        { id: '1', title: 'Test 1', code: 'code1' },
        { id: '2', title: 'Test 2', code: 'code2' }
      ]
      useVaultStore.getState().setSnippets(snippets)
      expect(useVaultStore.getState().snippets).toEqual(snippets)
    })
  })

  describe('setSelectedSnippet', () => {
    it('sets selected snippet and adds to open tabs', () => {
      const snippet = { id: '1', title: 'Test', code: 'code' }
      useVaultStore.getState().setSnippets([snippet])
      useVaultStore.getState().setSelectedSnippet(snippet)

      expect(useVaultStore.getState().selectedSnippet).toEqual(snippet)
      expect(useVaultStore.getState().activeTabId).toBe('1')
      expect(useVaultStore.getState().openTabs).toContain('1')
    })

    it('does not duplicate tab if already open', () => {
      const snippet = { id: '1', title: 'Test', code: 'code' }
      useVaultStore.getState().setSnippets([snippet])
      useVaultStore.getState().setSelectedSnippet(snippet)
      useVaultStore.getState().setSelectedSnippet(snippet)

      expect(useVaultStore.getState().openTabs).toEqual(['1'])
    })

    it('clears selection when null is passed', () => {
      const snippet = { id: '1', title: 'Test', code: 'code' }
      useVaultStore.getState().setSnippets([snippet])
      useVaultStore.getState().setSelectedSnippet(snippet)
      useVaultStore.getState().setSelectedSnippet(null)

      expect(useVaultStore.getState().selectedSnippet).toBeNull()
      expect(useVaultStore.getState().activeTabId).toBeNull()
    })
  })

  describe('closeTab', () => {
    it('removes tab from open tabs', () => {
      const snippets = [
        { id: '1', title: 'Test 1', code: 'code1' },
        { id: '2', title: 'Test 2', code: 'code2' }
      ]
      useVaultStore.getState().setSnippets(snippets)
      useVaultStore.getState().setSelectedSnippet(snippets[0])
      useVaultStore.getState().setSelectedSnippet(snippets[1])

      useVaultStore.getState().closeTab('1')

      expect(useVaultStore.getState().openTabs).not.toContain('1')
      expect(useVaultStore.getState().openTabs).toContain('2')
    })

    it('selects next tab when closing active tab', () => {
      const snippets = [
        { id: '1', title: 'Test 1', code: 'code1' },
        { id: '2', title: 'Test 2', code: 'code2' },
        { id: '3', title: 'Test 3', code: 'code3' }
      ]
      useVaultStore.getState().setSnippets(snippets)
      useVaultStore.getState().setSelectedSnippet(snippets[0])
      useVaultStore.getState().setSelectedSnippet(snippets[1])
      useVaultStore.getState().setSelectedSnippet(snippets[2])

      useVaultStore.getState().closeTab('2')

      expect(useVaultStore.getState().activeTabId).toBe('3')
      expect(useVaultStore.getState().selectedSnippet).toEqual(snippets[2])
    })
  })

  describe('restoreSession', () => {
    it('restores tabs and active snippet', () => {
      const snippets = [
        { id: '1', title: 'Test 1', code: 'code1' },
        { id: '2', title: 'Test 2', code: 'code2' }
      ]
      useVaultStore.getState().setSnippets(snippets)

      useVaultStore.getState().restoreSession(['1', '2'], '1', [])

      expect(useVaultStore.getState().openTabs).toEqual(['1', '2'])
      expect(useVaultStore.getState().activeTabId).toBe('1')
      expect(useVaultStore.getState().selectedSnippet).toEqual(snippets[0])
    })

    it('filters out invalid tab IDs', () => {
      const snippets = [{ id: '1', title: 'Test 1', code: 'code1' }]
      useVaultStore.getState().setSnippets(snippets)

      useVaultStore.getState().restoreSession(['1', 'invalid', '2'], '1', [])

      expect(useVaultStore.getState().openTabs).toEqual(['1'])
    })

    it('handles GRAPH_TAB_ID', () => {
      useVaultStore.getState().setSnippets([])

      useVaultStore.getState().restoreSession([GRAPH_TAB_ID], GRAPH_TAB_ID, [])

      expect(useVaultStore.getState().openTabs).toContain(GRAPH_TAB_ID)
      expect(useVaultStore.getState().activeTabId).toBe(GRAPH_TAB_ID)
      expect(useVaultStore.getState().selectedSnippet).toBeNull()
    })
  })

  describe('togglePinTab', () => {
    it('pins a tab', () => {
      const snippet = { id: '1', title: 'Test', code: 'code' }
      useVaultStore.getState().setSnippets([snippet])
      useVaultStore.getState().setSelectedSnippet(snippet)

      useVaultStore.getState().togglePinTab('1')

      expect(useVaultStore.getState().pinnedTabIds).toContain('1')
    })

    it('unpins a tab', () => {
      const snippet = { id: '1', title: 'Test', code: 'code' }
      useVaultStore.getState().setSnippets([snippet])
      useVaultStore.getState().setSelectedSnippet(snippet)
      useVaultStore.getState().togglePinTab('1')

      useVaultStore.getState().togglePinTab('1')

      expect(useVaultStore.getState().pinnedTabIds).not.toContain('1')
    })

    it('moves pinned tabs to front', () => {
      const snippets = [
        { id: '1', title: 'Test 1', code: 'code1' },
        { id: '2', title: 'Test 2', code: 'code2' }
      ]
      useVaultStore.getState().setSnippets(snippets)
      useVaultStore.getState().setSelectedSnippet(snippets[0])
      useVaultStore.getState().setSelectedSnippet(snippets[1])

      useVaultStore.getState().togglePinTab('2')

      expect(useVaultStore.getState().openTabs[0]).toBe('2')
    })
  })

  describe('openGraphTab', () => {
    it('opens graph tab', () => {
      useVaultStore.getState().openGraphTab()

      expect(useVaultStore.getState().openTabs).toContain(GRAPH_TAB_ID)
      expect(useVaultStore.getState().activeTabId).toBe(GRAPH_TAB_ID)
      expect(useVaultStore.getState().selectedSnippet).toBeNull()
    })

    it('does not duplicate graph tab', () => {
      useVaultStore.getState().openGraphTab()
      useVaultStore.getState().openGraphTab()

      expect(useVaultStore.getState().openTabs.filter(id => id === GRAPH_TAB_ID).length).toBe(1)
    })
  })

  describe('setDirty', () => {
    it('marks snippet as dirty', () => {
      useVaultStore.getState().setDirty('1', true)
      expect(useVaultStore.getState().dirtySnippetIds).toContain('1')
    })

    it('unmarks snippet as dirty', () => {
      useVaultStore.getState().setDirty('1', true)
      useVaultStore.getState().setDirty('1', false)
      expect(useVaultStore.getState().dirtySnippetIds).not.toContain('1')
    })
  })
})
