import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  STATUS_UNREAD,
  STATUS_IN_PROGRESS,
  STATUS_COMPLETED,
  getRoadmapProgress,
  getNoteStatus,
  setNoteStatus,
  toggleNoteStatus,
  resetTrackProgress,
  getTrackStats,
  calculateDocumentRoadmapProgress
} from '../../../../../src/renderer/src/features/roadmap/useStoreProgress'
import { useSettingsStore } from '../../../../../src/renderer/src/core/store/useSettingsStore'

describe('useStoreProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSettingsStore.setState({
      settings: { roadmapProgress: {} },
      isLoading: false
    })
  })

  describe('status constants', () => {
    it('defines unread, in-progress and completed', () => {
      expect(STATUS_UNREAD).toBe(0)
      expect(STATUS_IN_PROGRESS).toBe(1)
      expect(STATUS_COMPLETED).toBe(2)
    })
  })

  describe('getRoadmapProgress', () => {
    it('returns empty object when not set', () => {
      expect(getRoadmapProgress()).toEqual({})
    })

    it('returns stored progress', () => {
      useSettingsStore.setState({ settings: { roadmapProgress: { Track: { Note: 2 } } } })
      expect(getRoadmapProgress()).toEqual({ Track: { Note: 2 } })
    })
  })

  describe('getNoteStatus', () => {
    it('returns UNREAD for missing track/note', () => {
      expect(getNoteStatus('Track', 'nope')).toBe(STATUS_UNREAD)
    })

    it('returns stored status', () => {
      useSettingsStore.setState({ settings: { roadmapProgress: { Track: { 'Note 1': 2 } } } })
      expect(getNoteStatus('Track', 'Note 1')).toBe(STATUS_COMPLETED)
    })
  })

  describe('setNoteStatus', () => {
    it('stores status under track and note', () => {
      setNoteStatus('Track', 'Note 1', STATUS_IN_PROGRESS)
      expect(useSettingsStore.getState().settings.roadmapProgress).toEqual({
        Track: { 'Note 1': 1 }
      })
    })

    it('preserves other tracks when adding a new one', () => {
      setNoteStatus('Track A', 'N1', 1)
      setNoteStatus('Track B', 'N2', 2)
      const progress = useSettingsStore.getState().settings.roadmapProgress
      expect(progress['Track A']).toEqual({ N1: 1 })
      expect(progress['Track B']).toEqual({ N2: 2 })
    })
  })

  describe('toggleNoteStatus', () => {
    it('cycles unread -> in-progress -> completed -> unread', () => {
      toggleNoteStatus('Track', 'Note')
      expect(getNoteStatus('Track', 'Note')).toBe(STATUS_IN_PROGRESS)

      toggleNoteStatus('Track', 'Note')
      expect(getNoteStatus('Track', 'Note')).toBe(STATUS_COMPLETED)

      toggleNoteStatus('Track', 'Note')
      expect(getNoteStatus('Track', 'Note')).toBe(STATUS_UNREAD)
    })
  })

  describe('resetTrackProgress', () => {
    it('removes a track from progress', () => {
      setNoteStatus('Track A', 'N1', 1)
      setNoteStatus('Track B', 'N2', 2)
      resetTrackProgress('Track A')
      const progress = useSettingsStore.getState().settings.roadmapProgress
      expect(progress['Track A']).toBeUndefined()
      expect(progress['Track B']).toEqual({ N2: 2 })
    })
  })

  describe('getTrackStats', () => {
    const tableModel = {
      header: ['#', 'Note', 'Status'],
      rows: [
        ['●', 'Note 1'],
        ['○', 'Note 2'],
        ['◐', 'Note 3']
      ]
    }

    it('returns zeros when model is null', () => {
      expect(getTrackStats('Track', null)).toEqual({ total: 0, completed: 0, inProgress: 0 })
    })

    it('counts rows but not statuses without progress', () => {
      const stats = getTrackStats('Track', tableModel)
      expect(stats.total).toBe(3)
      expect(stats.completed).toBe(0)
      expect(stats.inProgress).toBe(0)
    })

    it('counts completed and in-progress from stored progress', () => {
      useSettingsStore.setState({
        settings: {
          roadmapProgress: { Track: { 'Note 1': 2, 'Note 3': 1 } }
        }
      })
      const stats = getTrackStats('Track', tableModel)
      expect(stats.total).toBe(3)
      expect(stats.completed).toBe(1)
      expect(stats.inProgress).toBe(1)
    })

    it('skips empty note titles', () => {
      const model = {
        header: ['#', 'Note'],
        rows: [['●', ''], ['●', 'Real']]
      }
      const stats = getTrackStats('Track', model)
      expect(stats.total).toBe(1)
    })
  })

  describe('calculateDocumentRoadmapProgress', () => {
    it('returns null for empty input', () => {
      expect(calculateDocumentRoadmapProgress('', {})).toBeNull()
      expect(calculateDocumentRoadmapProgress(null, {})).toBeNull()
      expect(calculateDocumentRoadmapProgress(123, {})).toBeNull()
    })

    it('returns null when no roadmap table found', () => {
      const code = '# Just a heading\nSome plain text.'
      expect(calculateDocumentRoadmapProgress(code, {})).toBeNull()
    })

    it('calculates progress across tracks', () => {
      const code = [
        '# Track A',
        '| # | Note |',
        '|---|---|',
        '| ● | Alpha |',
        '| ○ | Beta |',
        '',
        '# Track B',
        '| # | Note |',
        '|---|---|',
        '| ● | Gamma |'
      ].join('\n')

      const progressMap = {
        'Track A': { Alpha: 2, Beta: 1 },
        'Track B': { Gamma: 2 }
      }

      const result = calculateDocumentRoadmapProgress(code, progressMap)
      expect(result).not.toBeNull()
      expect(result.total).toBe(3)
      expect(result.completed).toBe(2)
      expect(result.inProgress).toBe(1)
      // (2 + 0.5) / 3 = 83%
      expect(result.percentage).toBe(83)
    })

    it('uses store progress when no map provided', () => {
      useSettingsStore.setState({
        settings: { roadmapProgress: { Track: { Done: 2, Half: 1 } } }
      })
      const code = ['# Track', '| # | Note |', '|---|---|', '| ● | Done |', '| ○ | Half |'].join('\n')
      const result = calculateDocumentRoadmapProgress(code)
      expect(result.total).toBe(2)
      expect(result.completed).toBe(1)
      expect(result.inProgress).toBe(1)
    })

    it('handles status column variants (No., Status, #)', () => {
      const code = ['# Track', '| Status | Note |', '|---|---|', '| ● | A |'].join('\n')
      const result = calculateDocumentRoadmapProgress(code, { Track: { A: 2 } })
      expect(result.total).toBe(1)
      expect(result.completed).toBe(1)
    })

    it('resets to 100 when all completed', () => {
      const code = ['# Track', '| # | Note |', '|---|---|', '| ● | A |'].join('\n')
      const result = calculateDocumentRoadmapProgress(code, { Track: { A: 2 } })
      expect(result.percentage).toBe(100)
    })
  })
})
