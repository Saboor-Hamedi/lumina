import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { toggleTaskMark, handleTaskEnter } from '../../../../../../src/renderer/src/features/Editor/hooks/useMark'

function createTestView(docText, cursorPos = 0) {
  const state = EditorState.create({
    doc: docText,
    selection: { anchor: cursorPos }
  })
  return new EditorView({ state })
}

describe('useMark.js', () => {
  describe('toggleTaskMark', () => {
    it('converts plain text line to a task item', () => {
      const view = createTestView('Buy groceries', 4)
      const handled = toggleTaskMark(view)
      expect(handled).toBe(true)
      expect(view.state.doc.toString()).toBe('- [ ] Buy groceries')
    })

    it('converts a bullet point to a task item', () => {
      const view = createTestView('- Buy groceries', 4)
      const handled = toggleTaskMark(view)
      expect(handled).toBe(true)
      expect(view.state.doc.toString()).toBe('- [ ] Buy groceries')
    })

    it('toggles an unchecked task to checked', () => {
      const view = createTestView('- [ ] Buy groceries', 6)
      const handled = toggleTaskMark(view)
      expect(handled).toBe(true)
      expect(view.state.doc.toString()).toBe('- [x] Buy groceries')
    })

    it('toggles a checked task back to unchecked', () => {
      const view = createTestView('- [x] Buy groceries', 6)
      const handled = toggleTaskMark(view)
      expect(handled).toBe(true)
      expect(view.state.doc.toString()).toBe('- [ ] Buy groceries')
    })
  })

  describe('handleTaskEnter', () => {
    it('clears empty task line and exits task list', () => {
      const view = createTestView('- [ ] ', 6)
      const handled = handleTaskEnter(view)
      expect(handled).toBe(true)
      expect(view.state.doc.toString()).toBe('')
    })

    it('auto-continues active task list item on Enter', () => {
      const text = '- [ ] First task'
      const view = createTestView(text, text.length)
      const handled = handleTaskEnter(view)
      expect(handled).toBe(true)
      expect(view.state.doc.toString()).toBe('- [ ] First task\n- [ ] ')
    })

    it('auto-continues checked task as a new unchecked task on Enter', () => {
      const text = '- [x] Completed task'
      const view = createTestView(text, text.length)
      const handled = handleTaskEnter(view)
      expect(handled).toBe(true)
      expect(view.state.doc.toString()).toBe('- [x] Completed task\n- [ ] ')
    })
  })
})
