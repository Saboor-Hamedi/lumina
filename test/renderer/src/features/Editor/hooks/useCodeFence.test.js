import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { handleCodeFenceEnter } from '../../../../../../src/renderer/src/features/Editor/hooks/useCodeFence'

function createTestView(docText, cursorPos = 0) {
  const state = EditorState.create({
    doc: docText,
    selection: { anchor: cursorPos }
  })
  return new EditorView({ state })
}

describe('useCodeFence.js', () => {
  describe('handleCodeFenceEnter', () => {
    it('auto-closes an unclosed code block on Enter', () => {
      const text = '```javascript'
      const view = createTestView(text, text.length)
      const handled = handleCodeFenceEnter(view)
      expect(handled).toBe(true)
      expect(view.state.doc.toString()).toBe('```javascript\n\n```')
      expect(view.state.selection.main.head).toBe(text.length + 1)
    })

    it('does not double-close if already closed below', () => {
      const text = '```javascript\nconst x = 1;\n```'
      const view = createTestView(text, 13)
      const handled = handleCodeFenceEnter(view)
      expect(handled).toBe(false)
    })

    it('auto-expands single-line fenced code block into multi-line', () => {
      const text = '```console.log("hello")```'
      const view = createTestView(text, text.length)
      const handled = handleCodeFenceEnter(view)
      expect(handled).toBe(true)
      expect(view.state.doc.toString()).toBe('```\nconsole.log("hello")\n\n```\n')
    })
  })
})
