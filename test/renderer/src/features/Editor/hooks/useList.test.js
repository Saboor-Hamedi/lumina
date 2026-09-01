import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { handleListEnter, isListLine } from '../../../../../../src/renderer/src/features/Editor/hooks/useList'

function createTestView(docText, cursorPos = 0) {
  const state = EditorState.create({
    doc: docText,
    selection: { anchor: cursorPos }
  })
  return new EditorView({ state })
}

describe('useList.js', () => {
  describe('isListLine', () => {
    it('identifies bullet items', () => {
      expect(isListLine('- Bullet item')).toBe(true)
      expect(isListLine('* Asterisk item')).toBe(true)
      expect(isListLine('+ Plus item')).toBe(true)
    })

    it('identifies ordered numbers', () => {
      expect(isListLine('1. First item')).toBe(true)
      expect(isListLine('12. Twelfth item')).toBe(true)
    })

    it('identifies task items', () => {
      expect(isListLine('- [ ] Task')).toBe(true)
      expect(isListLine('- [x] Done')).toBe(true)
    })

    it('returns false for plain paragraphs', () => {
      expect(isListLine('Just some regular text')).toBe(false)
    })
  })

  describe('handleListEnter', () => {
    it('clears empty bullet item on Enter', () => {
      const view = createTestView('- ', 2)
      const handled = handleListEnter(view)
      expect(handled).toBe(true)
      expect(view.state.doc.toString()).toBe('')
    })

    it('clears empty numbered item on Enter', () => {
      const view = createTestView('1. ', 3)
      const handled = handleListEnter(view)
      expect(handled).toBe(true)
      expect(view.state.doc.toString()).toBe('')
    })

    it('continues bullet list on Enter', () => {
      const text = '- First bullet'
      const view = createTestView(text, text.length)
      const handled = handleListEnter(view)
      expect(handled).toBe(true)
      expect(view.state.doc.toString()).toBe('- First bullet\n- ')
    })

    it('increments numbered list on Enter', () => {
      const text = '1. First item'
      const view = createTestView(text, text.length)
      const handled = handleListEnter(view)
      expect(handled).toBe(true)
      expect(view.state.doc.toString()).toBe('1. First item\n2. ')
    })

    it('increments alphabetical list on Enter', () => {
      const text = 'a. First section'
      const view = createTestView(text, text.length)
      const handled = handleListEnter(view)
      expect(handled).toBe(true)
      expect(view.state.doc.toString()).toBe('a. First section\nb. ')
    })
  })
})
