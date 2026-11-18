import { describe, it, expect, beforeEach, vi } from 'vitest'
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
      pinnedTabIds: [],
      splitDirection: 'none',
      splitRatio: 0.5,
      secondaryTabs: [],
      secondaryActiveTabId: null,
      panes: { primary: { id: 'primary', tabs: [], activeTabId: null } },
      splitTree: { kind: 'leaf', paneId: 'primary' },
      focusedPane: 'primary'
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

  describe('Split View / Multi-Pane Editing', () => {
    it('splits vertically and horizontally and clamps split ratio', () => {
      const n1 = { id: 'n1', title: 'Note 1', code: 'One' }
      const n2 = { id: 'n2', title: 'Note 2', code: 'Two' }
      useWorkspaceStore.getState().setNotes([n1, n2])
      useWorkspaceStore.getState().setSelectedNote(n1)

      useWorkspaceStore.getState().splitPane('vertical', 'n2')
      let state = useWorkspaceStore.getState()
      expect(state.splitDirection).toBe('vertical')
      expect(state.secondaryTabs).toEqual(['n2'])
      expect(state.secondaryActiveTabId).toBe('n2')
      expect(state.focusedPane).toBe('secondary')
      expect(state.selectedNote?.id).toBe('n2')

      useWorkspaceStore.getState().toggleSplitDirection()
      expect(useWorkspaceStore.getState().splitDirection).toBe('horizontal')

      useWorkspaceStore.getState().setSplitRatio(0.05)
      expect(useWorkspaceStore.getState().splitRatio).toBe(0.15)
      useWorkspaceStore.getState().setSplitRatio(0.95)
      expect(useWorkspaceStore.getState().splitRatio).toBe(0.85)
    })

    it('opens notes in focused pane and collapses split when last secondary tab closes', () => {
      const n1 = { id: 'n1', title: 'Note 1', code: 'One' }
      const n2 = { id: 'n2', title: 'Note 2', code: 'Two' }
      const n3 = { id: 'n3', title: 'Note 3', code: 'Three' }
      useWorkspaceStore.getState().setNotes([n1, n2, n3])
      useWorkspaceStore.getState().setSelectedNote(n1)

      useWorkspaceStore.getState().splitPane('vertical', 'n2')
      // Focused pane is 'secondary', so setSelectedNote opens n3 in secondaryTabs
      useWorkspaceStore.getState().setSelectedNote(n3)
      expect(useWorkspaceStore.getState().secondaryTabs).toEqual(['n2', 'n3'])
      expect(useWorkspaceStore.getState().secondaryActiveTabId).toBe('n3')

      useWorkspaceStore.getState().closePaneTab('secondary', 'n3')
      expect(useWorkspaceStore.getState().secondaryTabs).toEqual(['n2'])
      expect(useWorkspaceStore.getState().secondaryActiveTabId).toBe('n2')

      // Closing the last secondary tab collapses split back to primary
      useWorkspaceStore.getState().closePaneTab('secondary', 'n2')
      const state = useWorkspaceStore.getState()
      expect(state.splitDirection).toBe('none')
      expect(state.secondaryTabs).toEqual([])
      expect(state.focusedPane).toBe('primary')
      expect(state.selectedNote?.id).toBe('n1')
    })

    it('moves tabs between primary and secondary panes', () => {
      const n1 = { id: 'n1', title: 'Note 1', code: 'One' }
      const n2 = { id: 'n2', title: 'Note 2', code: 'Two' }
      useWorkspaceStore.getState().setNotes([n1, n2])
      useWorkspaceStore.getState().setSelectedNote(n1)
      useWorkspaceStore.getState().setSelectedNote(n2)

      useWorkspaceStore.getState().moveTabToPane('n2', 'secondary')
      let state = useWorkspaceStore.getState()
      expect(state.splitDirection).toBe('vertical')
      expect(state.openTabs).toEqual(['n1'])
      expect(state.secondaryTabs).toEqual(['n2'])

      useWorkspaceStore.getState().moveTabToPane('n2', 'primary')
      state = useWorkspaceStore.getState()
      expect(state.splitDirection).toBe('none')
      expect(state.openTabs).toEqual(['n1', 'n2'])
      expect(state.activeTabId).toBe('n2')
    })

    it('supports multiple columns and nested rows in splitTree', () => {
      const n1 = { id: 'n1', title: 'Note 1', code: 'One' }
      const n2 = { id: 'n2', title: 'Note 2', code: 'Two' }
      const n3 = { id: 'n3', title: 'Note 3', code: 'Three' }
      useWorkspaceStore.getState().setNotes([n1, n2, n3])
      useWorkspaceStore.getState().setSelectedNote(n1)

      // Column 1 -> split vertically into Column 1 & Column 2
      useWorkspaceStore.getState().splitPane('vertical', 'n2', 'primary', 'after')
      const col2Id = useWorkspaceStore.getState().focusedPane
      expect(col2Id).not.toBe('primary')

      // Split Column 2 horizontally into two rows
      useWorkspaceStore.getState().splitPane('horizontal', 'n3', col2Id, 'after')
      const row2Id = useWorkspaceStore.getState().focusedPane
      expect(Object.keys(useWorkspaceStore.getState().panes)).toHaveLength(3)
      expect(useWorkspaceStore.getState().panes[row2Id].activeTabId).toBe('n3')

      // Close row2 -> collapses back to 2 columns
      useWorkspaceStore.getState().closePane(row2Id)
      expect(Object.keys(useWorkspaceStore.getState().panes)).toHaveLength(2)
      expect(useWorkspaceStore.getState().splitTree.kind).toBe('split')
    })

    it('restores splitLayout across sessions and prunes missing notes', () => {
      const n1 = { id: 'n1', title: 'Note 1', code: 'One' }
      const n2 = { id: 'n2', title: 'Note 2', code: 'Two' }
      useWorkspaceStore.getState().setNotes([n1, n2])

      const savedLayout = {
        splitTree: {
          kind: 'split',
          id: 'split-1',
          direction: 'vertical',
          ratio: 0.6,
          first: { kind: 'leaf', paneId: 'primary' },
          second: { kind: 'leaf', paneId: 'secondary' }
        },
        panes: {
          primary: { id: 'primary', tabs: ['n1'], activeTabId: 'n1' },
          secondary: { id: 'secondary', tabs: ['n2', 'deleted-note'], activeTabId: 'deleted-note' }
        },
        focusedPane: 'secondary'
      }

      useWorkspaceStore.getState().restoreSession(['n1'], 'n1', [], savedLayout)
      const state = useWorkspaceStore.getState()
      expect(state.splitDirection).toBe('vertical')
      expect(state.splitRatio).toBe(0.6)
      expect(state.openTabs).toEqual(['n1'])
      expect(state.secondaryTabs).toEqual(['n2'])
      expect(state.secondaryActiveTabId).toBe('n2')
      expect(state.focusedPane).toBe('secondary')
      expect(state.selectedNote?.id).toBe('n2')
    })
  })
})
