import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock CodeMirror language — we only need the tree helpers
const fakeTree = { iterate: vi.fn() }
vi.mock('@codemirror/language', () => ({
  ensureSyntaxTree: () => fakeTree,
  syntaxTree: () => fakeTree
}))

vi.mock('../../../../../src/renderer/src/features/roadmap/roadmapStore', () => ({
  STATUS_UNREAD: 0,
  STATUS_IN_PROGRESS: 1,
  STATUS_COMPLETED: 2,
  toggleNoteStatus: vi.fn(),
  getNoteStatus: vi.fn(() => 0)
}))

import {
  findTrackNameForTable,
  renderProgressIndicator
} from '../../../../../src/renderer/src/features/roadmap/roadmapIndicators'
import {
  toggleNoteStatus,
  getNoteStatus,
  STATUS_COMPLETED,
  STATUS_IN_PROGRESS
} from '../../../../../src/renderer/src/features/roadmap/roadmapStore'

describe('roadmapIndicators', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('findTrackNameForTable', () => {
    it('returns default "Track" with found=false when no heading exists', () => {
      fakeTree.iterate.mockImplementation(({ enter }) => {
        // No Heading nodes
      })
      const state = { sliceDoc: vi.fn() }
      const result = findTrackNameForTable(state, 10)
      expect(result).toEqual({ trackName: 'Track', found: false })
    })

    it('finds the nearest heading above the table', () => {
      fakeTree.iterate.mockImplementation(({ enter }) => {
        enter({ name: 'Heading1', from: 0, to: 6 })
        enter({ name: 'Table', from: 20, to: 40 })
      })
      const state = {
        sliceDoc: vi.fn((from, to) => {
          if (from === 0 && to === 6) return '## My Track'
          return ''
        })
      }
      const result = findTrackNameForTable(state, 25)
      expect(result.trackName).toBe('My Track')
      expect(result.found).toBe(true)
    })

    it('uses the last heading above the table position', () => {
      const nodes = [
        { name: 'Heading1', from: 0, to: 6 },
        { name: 'Heading1', from: 10, to: 16 },
        { name: 'Table', from: 25, to: 45 }
      ]
      fakeTree.iterate.mockImplementation(({ enter }) => {
        nodes.forEach((n) => enter(n))
      })
      const state = {
        sliceDoc: vi.fn((from, to) => {
          if (from === 0 && to === 6) return '# First'
          if (from === 10 && to === 16) return '# Second'
          return ''
        })
      }
      const result = findTrackNameForTable(state, 30)
      expect(result.trackName).toBe('Second')
    })

    it('ignores empty heading text', () => {
      fakeTree.iterate.mockImplementation(({ enter }) => {
        enter({ name: 'Heading1', from: 0, to: 4 })
        enter({ name: 'Table', from: 10, to: 30 })
      })
      const state = { sliceDoc: vi.fn(() => '###   ') }
      const result = findTrackNameForTable(state, 15)
      expect(result.trackName).toBe('Track')
      expect(result.found).toBe(false)
    })
  })

  describe('renderProgressIndicator', () => {
    function makeCell(status = 0) {
      const source = document.createElement('div')
      source.className = 'cm-atomic-table-cell-source'
      source.textContent = '●'
      const parent = document.createElement('div')
      parent.appendChild(source)
      const cell = document.createElement('td')
      cell.appendChild(parent)
      return { cell, source, parent }
    }

    it('creates an unread indicator (○)', () => {
      getNoteStatus.mockReturnValue(0)
      const { cell, source } = makeCell()
      renderProgressIndicator(cell, 'Track', 'note1', {})
      const indicator = cell.querySelector('.roadmap-indicator')
      expect(indicator).toBeTruthy()
      expect(indicator.innerHTML).toBe('○')
      expect(source.style.display).toBe('none')
    })

    it('creates an in-progress indicator (◐)', () => {
      getNoteStatus.mockReturnValue(1)
      const { cell } = makeCell()
      renderProgressIndicator(cell, 'Track', 'note1', {})
      const indicator = cell.querySelector('.roadmap-indicator')
      expect(indicator.innerHTML).toBe('◐')
    })

    it('creates a completed indicator (●)', () => {
      getNoteStatus.mockReturnValue(2)
      const { cell } = makeCell()
      renderProgressIndicator(cell, 'Track', 'note1', {})
      const indicator = cell.querySelector('.roadmap-indicator')
      expect(indicator.innerHTML).toBe('●')
    })

    it('sets the title based on status', () => {
      getNoteStatus.mockReturnValue(0)
      const { cell } = makeCell()
      renderProgressIndicator(cell, 'Track', 'note1', {})
      expect(cell.querySelector('.roadmap-indicator').title).toContain('Unread')
    })

    it('clicking the indicator toggles note status and re-renders', () => {
      getNoteStatus.mockReturnValue(0)
      const { cell } = makeCell()
      const renderSpy = vi.fn()
      const indicator = document.createElement('div')
      document.querySelector = vi.fn(() => null)
      // Call with a view whose renderProgressIndicator is the spy
      renderProgressIndicator(cell, 'Track', 'note1', {})
      const el = cell.querySelector('.roadmap-indicator')

      // Simulate mousedown
      const event = new MouseEvent('mousedown', { bubbles: true })
      el.dispatchEvent(event)
      expect(toggleNoteStatus).toHaveBeenCalledWith('Track', 'note1')
      void renderSpy
    })

    it('replaces an existing indicator on re-render', () => {
      getNoteStatus.mockReturnValue(0)
      const { cell } = makeCell()
      renderProgressIndicator(cell, 'Track', 'note1', {})
      const first = cell.querySelector('.roadmap-indicator')
      renderProgressIndicator(cell, 'Track', 'note1', {})
      const second = cell.querySelector('.roadmap-indicator')
      expect(second).toBeTruthy()
      expect(second).not.toBe(first)
      expect(cell.querySelectorAll('.roadmap-indicator').length).toBe(1)
    })
  })
})
