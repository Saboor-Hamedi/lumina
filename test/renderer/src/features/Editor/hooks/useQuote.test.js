import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { toggleQuoteMark, handleQuoteEnter } from '../../../../../../src/renderer/src/features/Editor/hooks/useQuote'

function createTestView(docText, cursorPos = 0) {
  const state = EditorState.create({
    doc: docText,
    selection: { anchor: cursorPos }
  })
  return new EditorView({ state })
}

describe('useQuote.js', () => {
  describe('toggleQuoteMark', () => {
    it('converts plain text line to a blockquote', () => {
      const view = createTestView('Hello world', 4)
      const handled = toggleQuoteMark(view)
      expect(handled).toBe(true)
      expect(view.state.doc.toString()).toBe('> Hello world')
    })

    it('removes blockquote marker from quoted line', () => {
      const view = createTestView('> Hello world', 4)
      const handled = toggleQuoteMark(view)
      expect(handled).toBe(true)
      expect(view.state.doc.toString()).toBe('Hello world')
    })
  })

  describe('handleQuoteEnter', () => {
    it('clears empty blockquote line and exits blockquote', () => {
      const view = createTestView('> ', 2)
      const handled = handleQuoteEnter(view)
      expect(handled).toBe(true)
      expect(view.state.doc.toString()).toBe('')
    })

    it('auto-continues active blockquote on Enter', () => {
      const text = '> Important quote'
      const view = createTestView(text, text.length)
      const handled = handleQuoteEnter(view)
      expect(handled).toBe(true)
      expect(view.state.doc.toString()).toBe('> Important quote\n> ')
    })
  })
})
