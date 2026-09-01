import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import {
  CALLOUT_TYPES,
  CalloutHeaderWidget,
  insertCallout,
  calloutExtension
} from '../../../../../../src/renderer/src/features/Editor/hooks/useCallout'

describe('useCallout.js', () => {
  it('defines standard CALLOUT_TYPES with metadata', () => {
    expect(CALLOUT_TYPES.note).toBeDefined()
    expect(CALLOUT_TYPES.tip).toBeDefined()
    expect(CALLOUT_TYPES.warning).toBeDefined()
    expect(CALLOUT_TYPES.important).toBeDefined()
    expect(CALLOUT_TYPES.caution).toBeDefined()
    expect(CALLOUT_TYPES.info).toBeDefined()
    expect(CALLOUT_TYPES.success).toBeDefined()
    expect(CALLOUT_TYPES.bug).toBeDefined()
  })

  it('renders CalloutHeaderWidget DOM correctly for different types', () => {
    const noteWidget = new CalloutHeaderWidget('note', 'My Note Title')
    const noteEl = noteWidget.toDOM()
    expect(noteEl.className).toContain('lumina-callout-header')
    expect(noteEl.className).toContain('lumina-callout-note')
    expect(noteEl.textContent).toContain('My Note Title')

    const warningWidget = new CalloutHeaderWidget('warning', 'Be Careful')
    const warningEl = warningWidget.toDOM()
    expect(warningEl.className).toContain('lumina-callout-warning')
    expect(warningEl.textContent).toContain('Be Careful')

    const tipWidget = new CalloutHeaderWidget('tip', '')
    const tipEl = tipWidget.toDOM()
    expect(tipEl.className).toContain('lumina-callout-tip')
    expect(tipEl.textContent).toBe('TIP')
  })

  it('insertCallout inserts a new callout block at caret position', () => {
    const parent = document.createElement('div')
    const state = EditorState.create({
      doc: 'Hello world',
      extensions: [calloutExtension]
    })
    const view = new EditorView({ state, parent })

    // Move cursor to start
    view.dispatch({ selection: { anchor: 0 } })

    const handled = insertCallout(view, 'tip', 'Quick Tip')
    expect(handled).toBe(true)

    const docText = view.state.doc.toString()
    expect(docText).toContain('> [!tip] Quick Tip')
    expect(docText).toContain('> Content')
  })

  it('insertCallout wraps selected text in a callout', () => {
    const parent = document.createElement('div')
    const state = EditorState.create({
      doc: 'Important line 1\nImportant line 2',
      extensions: [calloutExtension]
    })
    const view = new EditorView({ state, parent })

    // Select all
    view.dispatch({ selection: { anchor: 0, head: state.doc.length } })

    const handled = insertCallout(view, 'warning', 'Security Alert')
    expect(handled).toBe(true)

    const docText = view.state.doc.toString()
    expect(docText).toContain('> [!warning] Security Alert')
    expect(docText).toContain('> Important line 1')
    expect(docText).toContain('> Important line 2')
  })
})
