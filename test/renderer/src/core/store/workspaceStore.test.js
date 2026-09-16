import {
  useWorkspaceStore,
  GRAPH_TAB_ID
} from '../../../../../src/renderer/src/core/store/workspaceStore'

// Mock the cache module
vi.mock('../../../../../src/renderer/src/core/db/cache', () => ({
  cacheSnippets: vi.fn(() => Promise.resolve()),
  getCachedSnippets: vi.fn(() => Promise.resolve([]))
}))

describe('workspaceStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useWorkspaceStore.setState({
      notes: [],
      selectedNote: null,
      isLoading: false,
      searchQuery: '',
      dirtyNoteIds: [],
      openTabs: [],
      activeTabId: null,
      pinnedTabIds: []
    })
  })

  describe('setNotes', () => {
    it('sets notes array in store state', () => {
      const notes = [
        { id: '1', title: 'Test 1', code: 'code1' },
        { id: '2', title: 'Test 2', code: 'code2' }
      ]
      useWorkspaceStore.getState().setNotes(notes)
      expect(useWorkspaceStore.getState().notes).toEqual(notes)
    })
  })

  describe('setSelectedNote', () => {
    it('sets selected note and adds to open tabs', () => {
      const note = { id: '1', title: 'Test', code: 'code' }
      useWorkspaceStore.getState().setNotes([note])
      useWorkspaceStore.getState().setSelectedNote(note)

      expect(useWorkspaceStore.getState().selectedNote).toEqual(note)
      expect(useWorkspaceStore.getState().activeTabId).toBe('1')
      expect(useWorkspaceStore.getState().openTabs).toContain('1')
    })

    it('clears selected note when null is passed', () => {
      const note = { id: '1', title: 'Test', code: 'code' }
      useWorkspaceStore.getState().setNotes([note])
      useWorkspaceStore.getState().setSelectedNote(note)
      useWorkspaceStore.getState().setSelectedNote(null)

      expect(useWorkspaceStore.getState().selectedNote).toBeNull()
      expect(useWorkspaceStore.getState().activeTabId).toBeNull()
    })

    it('does not duplicate tab if already open', () => {
      const note = { id: '1', title: 'Test', code: 'code' }
      useWorkspaceStore.getState().setNotes([note])
      useWorkspaceStore.getState().setSelectedNote(note)
      useWorkspaceStore.getState().setSelectedNote(note)

      expect(useWorkspaceStore.getState().openTabs).toEqual(['1'])
    })
  })

  describe('closeTab', () => {
    it('removes tab from open tabs', () => {
      const notes = [
        { id: '1', title: 'Test 1', code: 'code1' },
        { id: '2', title: 'Test 2', code: 'code2' }
      ]
      useWorkspaceStore.getState().setNotes(notes)
      useWorkspaceStore.getState().setSelectedNote(notes[0])
      useWorkspaceStore.getState().setSelectedNote(notes[1])

      useWorkspaceStore.getState().closeTab('1')

      expect(useWorkspaceStore.getState().openTabs).not.toContain('1')
      expect(useWorkspaceStore.getState().openTabs).toContain('2')
    })

    it('selects next tab when closing active tab', () => {
      const notes = [
        { id: '1', title: 'Test 1', code: 'code1' },
        { id: '2', title: 'Test 2', code: 'code2' },
        { id: '3', title: 'Test 3', code: 'code3' }
      ]
      useWorkspaceStore.getState().setNotes(notes)
      useWorkspaceStore.getState().setSelectedNote(notes[0])
      useWorkspaceStore.getState().setSelectedNote(notes[1])
      useWorkspaceStore.getState().setSelectedNote(notes[2])

      useWorkspaceStore.getState().closeTab('2')

      expect(useWorkspaceStore.getState().activeTabId).toBe('3')
      expect(useWorkspaceStore.getState().selectedNote).toEqual(notes[2])
    })
  })

  describe('restoreSession', () => {
    it('restores tabs and active note', () => {
      const notes = [
        { id: '1', title: 'Test 1', code: 'code1' },
        { id: '2', title: 'Test 2', code: 'code2' }
      ]
      useWorkspaceStore.getState().setNotes(notes)

      useWorkspaceStore.getState().restoreSession(['1', '2'], '1', [])

      expect(useWorkspaceStore.getState().openTabs).toEqual(['1', '2'])
      expect(useWorkspaceStore.getState().activeTabId).toBe('1')
      expect(useWorkspaceStore.getState().selectedNote).toEqual(notes[0])
    })

    it('filters out invalid tab IDs', () => {
      const notes = [{ id: '1', title: 'Test 1', code: 'code1' }]
      useWorkspaceStore.getState().setNotes(notes)

      useWorkspaceStore.getState().restoreSession(['1', 'invalid', '2'], '1', [])

      expect(useWorkspaceStore.getState().openTabs).toEqual(['1'])
    })

    it('handles GRAPH_TAB_ID', () => {
      useWorkspaceStore.getState().setNotes([])

      useWorkspaceStore.getState().restoreSession([GRAPH_TAB_ID], GRAPH_TAB_ID, [])

      expect(useWorkspaceStore.getState().openTabs).toContain(GRAPH_TAB_ID)
      expect(useWorkspaceStore.getState().activeTabId).toBe(GRAPH_TAB_ID)
      expect(useWorkspaceStore.getState().selectedNote).toBeNull()
    })
  })

  describe('togglePinTab', () => {
    it('pins a tab', () => {
      const note = { id: '1', title: 'Test', code: 'code' }
      useWorkspaceStore.getState().setNotes([note])
      useWorkspaceStore.getState().setSelectedNote(note)

      useWorkspaceStore.getState().togglePinTab('1')

      expect(useWorkspaceStore.getState().pinnedTabIds).toContain('1')
    })

    it('unpins a tab', () => {
      const note = { id: '1', title: 'Test', code: 'code' }
      useWorkspaceStore.getState().setNotes([note])
      useWorkspaceStore.getState().setSelectedNote(note)
      useWorkspaceStore.getState().togglePinTab('1')

      useWorkspaceStore.getState().togglePinTab('1')

      expect(useWorkspaceStore.getState().pinnedTabIds).not.toContain('1')
    })

    it('moves pinned tabs to front', () => {
      const notes = [
        { id: '1', title: 'Test 1', code: 'code1' },
        { id: '2', title: 'Test 2', code: 'code2' }
      ]
      useWorkspaceStore.getState().setNotes(notes)
      useWorkspaceStore.getState().setSelectedNote(notes[0])
      useWorkspaceStore.getState().setSelectedNote(notes[1])

      useWorkspaceStore.getState().togglePinTab('2')

      expect(useWorkspaceStore.getState().openTabs[0]).toBe('2')
    })
  })

  describe('openGraphTab', () => {
    it('opens graph tab', () => {
      useWorkspaceStore.getState().openGraphTab()

      expect(useWorkspaceStore.getState().openTabs).toContain(GRAPH_TAB_ID)
      expect(useWorkspaceStore.getState().activeTabId).toBe(GRAPH_TAB_ID)
      expect(useWorkspaceStore.getState().selectedNote).toBeNull()
    })

    it('does not duplicate graph tab', () => {
      useWorkspaceStore.getState().openGraphTab()
      useWorkspaceStore.getState().openGraphTab()

      expect(useWorkspaceStore.getState().openTabs.filter((id) => id === GRAPH_TAB_ID).length).toBe(1)
    })
  })

  describe('setDirty', () => {
    it('marks note as dirty', () => {
      useWorkspaceStore.getState().setDirty('1', true)
      expect(useWorkspaceStore.getState().dirtyNoteIds).toContain('1')
    })

    it('unmarks note as dirty', () => {
      useWorkspaceStore.getState().setDirty('1', true)
      useWorkspaceStore.getState().setDirty('1', false)
      expect(useWorkspaceStore.getState().dirtyNoteIds).not.toContain('1')
    })
  })
})
