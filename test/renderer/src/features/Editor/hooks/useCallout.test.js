import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import {
  CALLOUT_TYPES,
  CALLOUT_ALIASES,
  CalloutHeaderWidget,
  CalloutIconWidget,
  resolveCalloutType,
  getCalloutSvgIcon,
  insertCallout,
  calloutExtension,
  calloutDecorationsField,
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
    expect(CALLOUT_TYPES.note).toMatchObject({
      type: 'note',
      label: 'Note',
      color: '#38bdf8'
    })
    expect(CALLOUT_TYPES.warning.label).toBe('Warning')
    expect(CALLOUT_TYPES.danger.color).toBe('#f87171')
  })

  it('maps canonical names and common aliases in CALLOUT_ALIASES', () => {
    expect(CALLOUT_ALIASES.hint).toBe('tip')
    expect(CALLOUT_ALIASES.warn).toBe('warning')
    expect(CALLOUT_ALIASES.error).toBe('danger')
    expect(CALLOUT_ALIASES.faq).toBe('question')
    expect(CALLOUT_ALIASES.cite).toBe('quote')
    for (const type of Object.keys(CALLOUT_TYPES)) {
      expect(CALLOUT_ALIASES[type]).toBe(type)
    }
  })

  it('resolves callout aliases and prefix fallbacks', () => {
    expect(resolveCalloutType('hint')).toBe('tip')
    expect(resolveCalloutType('warn')).toBe('warning')
    expect(resolveCalloutType('error')).toBe('danger')
    expect(resolveCalloutType('faq')).toBe('question')
    expect(resolveCalloutType('cite')).toBe('quote')
    expect(resolveCalloutType('impromptu')).toBe('important')
    expect(resolveCalloutType('infinite')).toBe('info')
    expect(resolveCalloutType('warnings')).toBe('warning')
    expect(resolveCalloutType('tiptoe')).toBe('tip')
    expect(resolveCalloutType('dangerzone')).toBe('danger')
    expect(resolveCalloutType('errand')).toBe('danger')
    expect(resolveCalloutType('succulent')).toBe('success')
    expect(resolveCalloutType('questioning')).toBe('question')
  })

  it('normalizes case and whitespace and defaults unknown types in resolveCalloutType', () => {
    expect(resolveCalloutType('  Hint  ')).toBe('tip')
    expect(resolveCalloutType('')).toBe('note')
    expect(resolveCalloutType('custom')).toBe('custom')
  })

  it('returns the expected SVG icon groups', () => {
    const noteIcon = getCalloutSvgIcon('note')
    expect(noteIcon).toContain('<svg')
    expect(getCalloutSvgIcon('info')).toBe(noteIcon)
    expect(getCalloutSvgIcon('NOTE')).toBe(noteIcon)
    expect(getCalloutSvgIcon('unknown')).toBe(noteIcon)
    expect(getCalloutSvgIcon('tip')).toBe(getCalloutSvgIcon('success'))
    expect(getCalloutSvgIcon('caution')).toBe(getCalloutSvgIcon('danger'))
    expect(getCalloutSvgIcon('caution')).toBe(getCalloutSvgIcon('bug'))
    expect(getCalloutSvgIcon('warning')).not.toBe(noteIcon)
    expect(getCalloutSvgIcon('question')).not.toBe(noteIcon)
    expect(getCalloutSvgIcon('todo')).not.toBe(noteIcon)
    expect(getCalloutSvgIcon('quote')).not.toBe(noteIcon)
  })

  it('renders CalloutHeaderWidget DOM correctly for different types', () => {
    const noteWidget = new CalloutHeaderWidget('note', 'My Note Title')
    const noteEl = noteWidget.toDOM()
    expect(noteEl.className).toContain('lumina-callout-block-header')
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

  it('normalizes widget type and exposes constructor defaults', () => {
    const widget = new CalloutHeaderWidget('NOTE')
    expect(widget.type).toBe('note')
    expect(widget.title).toBe('')
    expect(widget.foldMode).toBe(null)
    expect(widget.isCollapsed).toBe(false)
    expect(widget.blockStartPos).toBe(0)
    expect(widget.blockEndPos).toBe(0)
    expect(widget.bodyLineCount).toBe(0)
    expect(widget.ignoreEvent()).toBe(true)
  })

  it('renders the copy button only when a view is provided', () => {
    const bareEl = new CalloutHeaderWidget('note', 'Title').toDOM()
    expect(bareEl.getAttribute('contenteditable')).toBe('false')
    expect(bareEl.querySelector('.lumina-callout-icon svg')).toBeTruthy()
    expect(bareEl.querySelector('.lumina-callout-fold-btn')).toBeTruthy()
    expect(bareEl.querySelector('.lumina-callout-copy-btn')).toBeNull()

    const view = new EditorView({
      state: EditorState.create({
        doc: '> [!note] Title\n> body',
        extensions: [calloutExtension]
      }),
      parent: document.createElement('div')
    })
    const withView = new CalloutHeaderWidget('note', 'Title').toDOM(view)
    expect(withView.querySelector('.lumina-callout-copy-btn')).toBeTruthy()
  })

  it('renders standalone/collapsed classes and the body line count', () => {
    const emptyEl = new CalloutHeaderWidget('note', '', null, false, 0, 0, 0).toDOM()
    expect(emptyEl.className).toContain('is-standalone-card')
    expect(emptyEl.querySelector('.lumina-callout-count')).toBeNull()

    const collapsedEl = new CalloutHeaderWidget('note', 'Many', '-', true, 0, 10, 3).toDOM()
    expect(collapsedEl.className).toContain('is-collapsed')
    expect(collapsedEl.className).toContain('is-standalone-card')
    expect(collapsedEl.querySelector('.lumina-callout-count')?.textContent).toBe('3 lines')

    const singleEl = new CalloutHeaderWidget('note', 'One', '-', true, 0, 10, 1).toDOM()
    expect(singleEl.querySelector('.lumina-callout-count')?.textContent).toBe('1 line')
  })

  it('compares widgets with eq', () => {
    const widget = new CalloutHeaderWidget('note', 'Title', '-', true, 0, 5, 2)
    expect(widget.eq(new CalloutHeaderWidget('note', 'Title', '-', true, 0, 5, 2))).toBe(true)
    expect(widget.eq(new CalloutHeaderWidget('tip', 'Title', '-', true, 0, 5, 2))).toBe(false)
    expect(widget.eq(new CalloutHeaderWidget('note', 'Other', '-', true, 0, 5, 2))).toBe(false)
    expect(widget.eq(new CalloutHeaderWidget('note', 'Title', '+', true, 0, 5, 2))).toBe(false)
    expect(widget.eq(new CalloutHeaderWidget('note', 'Title', '-', false, 0, 5, 2))).toBe(false)
    expect(widget.eq(new CalloutHeaderWidget('note', 'Title', '-', true, 1, 5, 2))).toBe(false)
    expect(widget.eq(new CalloutHeaderWidget('note', 'Title', '-', true, 0, 6, 2))).toBe(false)
    expect(widget.eq(new CalloutHeaderWidget('note', 'Title', '-', true, 0, 5, 3))).toBe(false)
  })

  it('renders and compares the CalloutIconWidget preview', () => {
    const widget = new CalloutIconWidget('WARNING')
    const el = widget.toDOM()
    expect(widget.type).toBe('warning')
    expect(el.className).toContain('lumina-callout-icon-preview')
    expect(el.className).toContain('lumina-callout-warning')
    expect(el.querySelector('svg')).toBeTruthy()
    expect(widget.eq(new CalloutIconWidget('warning'))).toBe(true)
    expect(widget.eq(new CalloutIconWidget('note'))).toBe(false)
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

  it('insertCallout returns false without a view', () => {
    expect(insertCallout(null, 'tip', 'Title')).toBe(false)
    expect(insertCallout(undefined)).toBe(false)
  })

  it('insertCallout lowercases the type and omits an empty title', () => {
    const view = new EditorView({
      state: EditorState.create({ doc: '', extensions: [calloutExtension] }),
      parent: document.createElement('div')
    })
    expect(insertCallout(view, 'WARNING', 'Upper Title')).toBe(true)
    expect(view.state.doc.toString()).toContain('> [!warning] Upper Title')

    const view2 = new EditorView({
      state: EditorState.create({ doc: '', extensions: [calloutExtension] }),
      parent: document.createElement('div')
    })
    expect(insertCallout(view2, 'NOTE')).toBe(true)
    expect(view2.state.doc.toString()).toContain('> [!note]\n')
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

  it('parses nested, aliased, uppercase and whitespace-padded headers', () => {
    const nested = parseCalloutHeaderLine('  >> [!note] Deep')
    expect(nested).toMatchObject({
      level: 2,
      rawType: 'note',
      type: 'note',
      foldMode: null,
      title: 'Deep'
    })
    const nestedLine = '  >> [!note] Deep'
    expect(nestedLine.slice(nested.bracketIdx, nested.bracketEnd + 1)).toBe('[!note]')

    expect(parseCalloutHeaderLine('> [!error] Broken')).toMatchObject({
      rawType: 'error',
      type: 'danger',
      title: 'Broken'
    })
    expect(parseCalloutHeaderLine('> [!NOTE] Upper')).toMatchObject({
      rawType: 'NOTE',
      type: 'note'
    })
    expect(parseCalloutHeaderLine('> [!tip]')).toMatchObject({ title: '' })
    expect(parseCalloutHeaderLine('> [!hint] Alias')).toMatchObject({ type: 'tip' })
  })

  it('returns null for lines that are not callout headers', () => {
    expect(parseCalloutHeaderLine('> plain text')).toBeNull()
    expect(parseCalloutHeaderLine('[!note] missing quote marker')).toBeNull()
    expect(parseCalloutHeaderLine('')).toBeNull()
  })

  it('toggles fold state through toggleCalloutFoldEffect', () => {
    const state = EditorState.create({
      doc: '> [!note] Header\n> body\nAfter',
      extensions: [calloutExtension]
    })
    expect(state.field(calloutFoldField).size).toBe(0)

    const once = state.update({
      effects: toggleCalloutFoldEffect.of({ pos: 0, defaultCollapsed: false })
    }).state
    expect(once.field(calloutFoldField).get(0)).toBe(true)

    const twice = once.update({
      effects: toggleCalloutFoldEffect.of({ pos: 0, defaultCollapsed: false })
    }).state
    expect(twice.field(calloutFoldField).get(0)).toBe(false)
  })

  it('keeps fold overrides when unrelated text is appended', () => {
    const state = EditorState.create({
      doc: '> [!note] Header\n> body\nAfter',
      extensions: [calloutExtension]
    })
    const folded = state.update({
      effects: toggleCalloutFoldEffect.of({ pos: 0, defaultCollapsed: false })
    }).state
    const appended = folded.update({
      changes: { from: folded.doc.length, insert: '\nmore text' }
    }).state
    expect(appended.field(calloutFoldField).get(0)).toBe(true)
  })

  it('builds decorations for callout blocks only', () => {
    const withCallout = EditorState.create({
      doc: '> [!note] Header\n> body\nOutside',
      extensions: [calloutExtension]
    })
    let count = 0
    withCallout.field(calloutDecorationsField).between(0, withCallout.doc.length, () => {
      count += 1
    })
    expect(count).toBeGreaterThan(0)

    const plain = EditorState.create({
      doc: 'Just plain text',
      extensions: [calloutExtension]
    })
    let plainCount = 0
    plain.field(calloutDecorationsField).between(0, plain.doc.length, () => {
      plainCount += 1
    })
    expect(plainCount).toBe(0)
  })

  it('renders fold button on foldable CalloutHeaderWidget and toggles via effect', () => {
    const collapsedWidget = new CalloutHeaderWidget('note', 'Details', '-', true)
    const el = collapsedWidget.toDOM()
    expect(el.className).toContain('is-foldable')
    expect(el.className).toContain('is-collapsed')
    const foldBtn = el.querySelector('.lumina-callout-fold-btn')
    expect(foldBtn).toBeTruthy()
    expect(foldBtn?.getAttribute('aria-expanded')).toBe('false')

    const expandedEl = new CalloutHeaderWidget('note', 'Details', '-', false).toDOM()
    const expandedBtn = expandedEl.querySelector('.lumina-callout-fold-btn')
    expect(expandedBtn?.getAttribute('aria-expanded')).toBe('true')
    expect(expandedBtn?.getAttribute('title')).toBe('Collapse callout')

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

  it('toggles the fold field when the rendered header bar is clicked', () => {
    const state = EditorState.create({
      doc: '> [!tip]- Folded\n> secret\nAfter',
      extensions: [calloutExtension]
    })
    const view = new EditorView({ state, parent: document.createElement('div') })
    const line1 = view.state.doc.line(1)
    const widget = new CalloutHeaderWidget('tip', 'Folded', '-', true, line1.from, line1.to, 1)
    const el = widget.toDOM(view)

    el.querySelector('.lumina-callout-fold-btn').click()
    expect(view.state.field(calloutFoldField).get(line1.from)).toBe(false)
  })

  it('expands a folded callout and focuses the raw source on double-click', () => {
    const state = EditorState.create({
      doc: '> [!note]- Folded\n> secret\nAfter',
      extensions: [calloutExtension]
    })
    const view = new EditorView({ state, parent: document.createElement('div') })
    const line1 = view.state.doc.line(1)
    const widget = new CalloutHeaderWidget('note', 'Folded', '-', true, line1.from, line1.to, 1)
    const el = widget.toDOM(view)

    el.querySelector('.lumina-callout-header-left').dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true })
    )
    expect(view.state.field(calloutFoldField).get(line1.from)).toBe(false)
    expect(view.state.selection.main.anchor).toBe(line1.to)
  })
})
