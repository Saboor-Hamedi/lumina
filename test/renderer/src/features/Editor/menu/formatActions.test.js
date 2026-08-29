import { describe, it, expect, vi, beforeEach } from 'vitest'
import { toggleMark, clearFormatting } from '../../../../../../src/renderer/src/features/Editor/menu/formatActions'

function makeView(doc, selection = { from: 0, to: 0 }) {
  const dispatch = vi.fn()
  const focus = vi.fn()
  const state = {
    sliceDoc: (from, to) => doc.slice(from, to),
    doc: { length: doc.length },
    selection: { main: selection }
  }
  return { view: { state, dispatch, focus }, dispatch, focus }
}

describe('formatActions', () => {
  describe('toggleMark', () => {
    it('does nothing when view is missing', () => {
      expect(() => toggleMark(null, '**')).not.toThrow()
    })

    it('wraps selected text with prefix and suffix', () => {
      const { view, dispatch } = makeView('hello world', { from: 0, to: 5 })
      toggleMark(view, '**')

      expect(dispatch).toHaveBeenCalledWith({
        changes: [
          { from: 0, insert: '**' },
          { from: 5, insert: '**' }
        ],
        selection: { anchor: 2, head: 7 }
      })
      expect(view.focus).toHaveBeenCalled()
    })

    it('unwraps when selection includes the wrapper inside', () => {
      // User highlighted "**bold**" entirely (0..8)
      const { view, dispatch } = makeView('**bold** text', { from: 0, to: 8 })
      toggleMark(view, '**')

      expect(dispatch).toHaveBeenCalledWith({
        changes: { from: 0, to: 8, insert: 'bold' },
        selection: { anchor: 0, head: 4 }
      })
    })

    it('unwraps when wrappers are just outside the selection', () => {
      const { view, dispatch } = makeView('**bold** text', { from: 2, to: 6 })
      // From 2 to 6 selects 'bold' while '**' is at 0-2 and 6-8
      toggleMark(view, '**')

      // Wait: selection 2..6 already trimmed -> text 'bold', wrapper outside
      expect(dispatch).toHaveBeenCalledWith({
        changes: [
          { from: 0, to: 2, insert: '' },
          { from: 6, to: 8, insert: '' }
        ]
      })
    })

    it('trims leading whitespace from selection before wrapping', () => {
      const { view, dispatch } = makeView('  hello', { from: 0, to: 7 })
      toggleMark(view, '*')

      expect(dispatch).toHaveBeenCalledWith({
        changes: [
          { from: 2, insert: '*' },
          { from: 7, insert: '*' }
        ],
        selection: { anchor: 3, head: 8 }
      })
    })

    it('trims trailing whitespace from selection before wrapping', () => {
      const { view, dispatch } = makeView('hello  ', { from: 0, to: 7 })
      toggleMark(view, '*')

      expect(dispatch).toHaveBeenCalledWith({
        changes: [
          { from: 0, insert: '*' },
          { from: 5, insert: '*' }
        ],
        selection: { anchor: 1, head: 6 }
      })
    })

    it('uses suffix parameter when different from prefix', () => {
      const { view, dispatch } = makeView('hello world', { from: 0, to: 5 })
      toggleMark(view, '**', '****')

      expect(dispatch).toHaveBeenCalledWith({
        changes: [
          { from: 0, insert: '**' },
          { from: 5, insert: '****' }
        ],
        selection: { anchor: 2, head: 7 }
      })
    })
  })

  describe('clearFormatting', () => {
    it('does nothing when view is missing', () => {
      expect(() => clearFormatting(null)).not.toThrow()
    })

    it('removes markdown symbols from selected text', () => {
      const { view, dispatch } = makeView('**bold** `code` _em_', { from: 0, to: 21 })
      clearFormatting(view)

      expect(dispatch).toHaveBeenCalledWith({
        changes: { from: 0, to: 21, insert: 'bold code em' }
      })
    })

    it('dispatches even when text has no symbols', () => {
      const { view, dispatch } = makeView('plain text', { from: 0, to: 5 })
      clearFormatting(view)

      expect(dispatch).toHaveBeenCalledWith({
        changes: { from: 0, to: 5, insert: 'plain' }
      })
    })
  })
})
