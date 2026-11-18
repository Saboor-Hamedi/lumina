import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import {
  CALLOUT_TYPES,
  CalloutHeaderWidget,
  insertCallout,
  calloutExtension,
  parseCalloutHeaderLine,
  toggleCalloutFoldEffect,
  calloutFoldField
} from '../../../../../../src/renderer/src/core/editor'

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

  it('parses foldable callout headers (+, -, and non-foldable)', () => {
    const collapsed = parseCalloutHeaderLine('> [!note]- Collapsed Title')
    expect(collapsed).toMatchObject({
      type: 'note',
      foldMode: '-',
      title: 'Collapsed Title'
    })

    const expanded = parseCalloutHeaderLine('> [!tip]+ Expanded Title')
    expect(expanded).toMatchObject({
      type: 'tip',
      foldMode: '+',
      title: 'Expanded Title'
    })

    const standard = parseCalloutHeaderLine('> [!info] Plain Title')
    expect(standard).toMatchObject({
      type: 'info',
      foldMode: null,
      title: 'Plain Title'
    })
  })

  it('renders fold button on foldable CalloutHeaderWidget and toggles via effect', () => {
    const collapsedWidget = new CalloutHeaderWidget('note', 'Details', '-', true)
    const el = collapsedWidget.toDOM()
    expect(el.className).toContain('is-foldable')
    expect(el.className).toContain('is-collapsed')
    const foldBtn = el.querySelector('.lumina-callout-fold-btn')
    expect(foldBtn).toBeTruthy()
    expect(foldBtn?.getAttribute('aria-expanded')).toBe('false')

    const parent = document.createElement('div')
    const state = EditorState.create({
      doc: '> [!note]- Hidden Body\n> Secret line 1\n> Secret line 2\nAfter',
      extensions: [calloutExtension]
    })
    const view = new EditorView({ state, parent })

    // Initially collapsed: state field has no override yet, default is collapsed (-)
    const line1 = view.state.doc.line(1)
    expect(view.state.field(calloutFoldField).has(line1.from)).toBe(false)

    // Toggle open
    view.dispatch({
      effects: toggleCalloutFoldEffect.of({ pos: line1.from, defaultCollapsed: true })
    })
    expect(view.state.field(calloutFoldField).get(line1.from)).toBe(false)

    // Toggle back to collapsed
    view.dispatch({
      effects: toggleCalloutFoldEffect.of({ pos: line1.from, defaultCollapsed: true })
    })
    expect(view.state.field(calloutFoldField).get(line1.from)).toBe(true)
  })
})
