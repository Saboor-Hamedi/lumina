import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import {
  buildHighlightDecorations,
  toggleHighlight,
  highlightExtension
} from '../../../../../src/renderer/src/core/editor/useHighlight'

function createTestView(docText: string, cursorPos = 0): EditorView {
  const state = EditorState.create({
    doc: docText,
    selection: { anchor: cursorPos },
    extensions: [highlightExtension]
  })
  return new EditorView({ state })
}

describe('useHighlight.ts', () => {
  describe('buildHighlightDecorations', () => {
    it('creates decorations for == Hello == when cursor is outside', () => {
      const text = 'This is == Hello == in text'
      // Cursor is at position 0 (outside)
      const view = createTestView(text, 0)
      const decos = buildHighlightDecorations(view)
      expect(decos.size).toBe(3) // 2 replace decos for '==' + 1 mark deco for ' Hello '
    })

    it('creates decorations for ==Hello== without spaces', () => {
      const text = 'Here is ==Hello== test'
      const view = createTestView(text, 0)
      const decos = buildHighlightDecorations(view)
      expect(decos.size).toBe(3)
    })

    it('returns empty decorations when no == in text', () => {
      const text = 'Plain text without highlight'
      const view = createTestView(text, 0)
      const decos = buildHighlightDecorations(view)
      expect(decos.size).toBe(0)
    })
  })

  describe('toggleHighlight', () => {
    it('inserts ==== when no selection', () => {
      const view = createTestView('Hello ', 6)
      const handled = toggleHighlight(view)
      expect(handled).toBe(true)
      expect(view.state.doc.toString()).toBe('Hello ====')
      expect(view.state.selection.main.head).toBe(8)
    })

    it('wraps selected text with ==', () => {
      const state = EditorState.create({
        doc: 'Hello World',
        selection: { anchor: 0, head: 5 }
      })
      const view = new EditorView({ state })
      const handled = toggleHighlight(view)
      expect(handled).toBe(true)
      expect(view.state.doc.toString()).toBe('==Hello== World')
    })

    it('unwraps text if already wrapped with ==', () => {
      const state = EditorState.create({
        doc: '==Hello== World',
        selection: { anchor: 0, head: 9 }
      })
      const view = new EditorView({ state })
      const handled = toggleHighlight(view)
      expect(handled).toBe(true)
      expect(view.state.doc.toString()).toBe('Hello World')
    })

    it('safely handles null or undefined view', () => {
      expect(toggleHighlight(null)).toBe(false)
      expect(toggleHighlight(undefined)).toBe(false)
    })
  })

  describe('multiple highlights on single line', () => {
    it('creates correct decorations for multiple highlights in sequence', () => {
      const text = '==First== and ==Second=='
      const view = createTestView(text, 0)
      const decos = buildHighlightDecorations(view)
      // 3 decos for First (2 replace, 1 mark) + 3 decos for Second (2 replace, 1 mark) = 6 decos
      expect(decos.size).toBe(6)
    })
  })
})
