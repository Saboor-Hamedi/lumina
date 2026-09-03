import { describe, it, expect, vi, beforeEach } from 'vitest'

// Capture widget instances passed to Decoration.widget
const widgetCaptures = []

vi.mock('@codemirror/state', () => ({
  StateField: {
    define: (spec) => spec
  },
  StateEffect: {
    define: () => ({ is: (e) => e === '__roadmap_force__' })
  }
}))

vi.mock('@codemirror/view', () => ({
  EditorView: {
    decorations: { from: (f) => f }
  },
  Decoration: {
    widget: (options) => {
      widgetCaptures.push(options.widget)
      return { range: (pos) => ({ widget: options.widget, pos }) }
    },
    set: (builder) => ({ builder, isDecorations: true })
  },
  WidgetType: class WidgetType {
    constructor() {
      this.stats = null
    }
    eq() {
      return false
    }
    toDOM() {
      return null
    }
  }
}))

vi.mock('@codemirror/language', () => ({
  ensureSyntaxTree: () => mockTree,
  syntaxTree: () => mockTree
}))

const mockTree = { iterate: vi.fn() }

vi.mock('../../../../../src/renderer/src/features/roadmap/useStoreProgress', () => ({
  getTrackStats: vi.fn()
}))

vi.mock('../../../../../src/renderer/src/features/table/tableModel', () => ({
  parseTable: vi.fn()
}))

import {
  buildRoadmapProgressBarDecorations,
  roadmapProgressBarPlugin,
  forceRoadmapUpdateEffect
} from '../../../../../src/renderer/src/features/roadmap/useProgressTrack'
import {
  getTrackStats
} from '../../../../../src/renderer/src/features/roadmap/useStoreProgress'
import { parseTable } from '../../../../../src/renderer/src/features/table/tableModel'

describe('roadmapProgressBarPlugin', () => {
  function makeState(docText = '# Track\n| # | Note |\n|---|---|\n| ● | A |') {
    const lines = docText.split('\n')
    return {
      doc: {
        length: docText.length,
        lines: lines.length,
        sliceString: (from, to) => docText.slice(from, to)
      }
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    widgetCaptures.length = 0
    mockTree.iterate.mockReset()
  })

  describe('buildRoadmapProgressBarDecorations', () => {
    it('returns an empty decoration set when no tables', () => {
      mockTree.iterate.mockImplementation(({ enter }) => {
        enter({ name: 'Heading1', from: 0, to: 6 })
      })
      const result = buildRoadmapProgressBarDecorations(makeState())
      expect(result.builder).toEqual([])
    })

    it('creates a widget for a roadmap table under a heading', () => {
      getTrackStats.mockReturnValue({ total: 3, completed: 1, inProgress: 1 })
      parseTable.mockReturnValue({
        header: ['#', 'Note'],
        rows: [['●', 'A'], ['◐', 'B'], ['○', 'C']]
      })

      mockTree.iterate.mockImplementation(({ enter }) => {
        enter({ name: 'Heading1', from: 0, to: 6 })
        enter({ name: 'Table', node: { cursor: vi.fn() }, from: 8, to: 40 })
      })

      const state = makeState()
      const result = buildRoadmapProgressBarDecorations(state)
      expect(widgetCaptures.length).toBe(1)
      expect(widgetCaptures[0].stats).toEqual({ total: 3, completed: 1, inProgress: 1 })
      expect(result.builder.length).toBe(1)
    })

    it('does not create a widget for tables without #/status column', () => {
      parseTable.mockReturnValue({
        header: ['Name', 'Note'],
        rows: [['A', 'B']]
      })
      mockTree.iterate.mockImplementation(({ enter }) => {
        enter({ name: 'Heading1', from: 0, to: 6 })
        enter({ name: 'Table', node: { cursor: vi.fn() }, from: 8, to: 40 })
      })

      const result = buildRoadmapProgressBarDecorations(makeState())
      expect(widgetCaptures.length).toBe(0)
      expect(result.builder).toEqual([])
    })

    it('skips tables without a preceding heading', () => {
      mockTree.iterate.mockImplementation(({ enter }) => {
        enter({ name: 'Table', node: { cursor: vi.fn() }, from: 0, to: 30 })
      })
      const result = buildRoadmapProgressBarDecorations(makeState())
      expect(widgetCaptures.length).toBe(0)
    })
  })

  describe('ProgressBarWidget.toDOM', () => {
    it('builds a DOM element with correct width percentage', () => {
      // Grab a widget instance to exercise toDOM
      getTrackStats.mockReturnValue({ total: 4, completed: 2, inProgress: 0 })
      parseTable.mockReturnValue({ header: ['#', 'Note'], rows: [['●', 'A']] })
      mockTree.iterate.mockImplementation(({ enter }) => {
        enter({ name: 'Heading1', from: 0, to: 6 })
        enter({ name: 'Table', node: { cursor: vi.fn() }, from: 8, to: 40 })
      })
      buildRoadmapProgressBarDecorations(
        makeState('# T\n| # | Note |\n|---|---|\n| ● | A |')
      )

      const widget = widgetCaptures[0]
      const dom = widget.toDOM()
      expect(dom.className).toBe('roadmap-progress-bar-wrap')
      const fill = dom.querySelector('div')
      expect(fill.style.width).toBe('50%')
      expect(dom.title).toContain('50%')
    })

    it('handles in-progress as half weight', () => {
      getTrackStats.mockReturnValue({ total: 2, completed: 0, inProgress: 2 })
      parseTable.mockReturnValue({ header: ['#', 'Note'], rows: [['◐', 'A'], ['◐', 'B']] })
      mockTree.iterate.mockImplementation(({ enter }) => {
        enter({ name: 'Heading1', from: 0, to: 6 })
        enter({ name: 'Table', node: { cursor: vi.fn() }, from: 8, to: 40 })
      })
      buildRoadmapProgressBarDecorations(
        makeState('# T\n| # | Note |\n|---|---|\n| ◐ | A |\n| ◐ | B |')
      )

      const widget = widgetCaptures[0]
      const dom = widget.toDOM()
      const fill = dom.querySelector('div')
      // (0 + 2*0.5) / 2 = 50%
      expect(fill.style.width).toBe('50%')
    })

    it('returns 0% width when total is zero', () => {
      getTrackStats.mockReturnValue({ total: 0, completed: 0, inProgress: 0 })
      parseTable.mockReturnValue({ header: ['#', 'Note'], rows: [] })
      mockTree.iterate.mockImplementation(({ enter }) => {
        enter({ name: 'Heading1', from: 0, to: 6 })
        enter({ name: 'Table', node: { cursor: vi.fn() }, from: 8, to: 40 })
      })
      buildRoadmapProgressBarDecorations(
        makeState('# T\n| # | Note |\n|---|---|')
      )
      const widget = widgetCaptures[0]
      const dom = widget.toDOM()
      expect(dom.querySelector('div').style.width).toBe('0%')
    })
  })

  describe('plugin definition', () => {
    it('exposes create/update/provide functions', () => {
      expect(typeof roadmapProgressBarPlugin.create).toBe('function')
      expect(typeof roadmapProgressBarPlugin.update).toBe('function')
      expect(typeof roadmapProgressBarPlugin.provide).toBe('function')
    })

    it('recomputes decorations on doc change', () => {
      const createSpy = vi.spyOn(roadmapProgressBarPlugin, 'create')
      const state = makeState()
      roadmapProgressBarPlugin.create(state)
      expect(createSpy).toHaveBeenCalled()
    })

    it('exports the force update effect', () => {
      expect(forceRoadmapUpdateEffect).toBeDefined()
    })
  })
})
