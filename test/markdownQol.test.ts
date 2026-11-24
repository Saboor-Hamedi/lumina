import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import {
  handleListEnter,
  handleListShiftEnter,
  handleListBackspace,
  indentListLines,
  outdentListLines,
  moveLinesUp,
  moveLinesDown,
  duplicateLines,
  parseListLine,
  isListLine
} from '../src/renderer/src/core/editor/useList'
import { handleTaskEnter, toggleTaskMark } from '../src/renderer/src/core/editor/useMark'
import { handleQuoteEnter } from '../src/renderer/src/core/editor/useQuote'
import {
  createKeymapModeCompartment,
  resolveKeymapModeExtension,
  reconfigureKeymapMode,
  DEFAULT_KEYMAP_MODE
} from '../src/renderer/src/core/editor/keymapMode'
import {
  getActiveShortcut,
  matchesShortcutEvent
} from '../src/renderer/src/core/shortcuts/defaultShortcuts'

/**
 * Lightweight mock EditorView backed by a real CodeMirror `EditorState`
 * so we can test list/task/quote/movement/renumbering transactions deterministically
 * without needing a full DOM layout engine.
 */
function createMockView(doc: string, anchor: number, head: number = anchor, extraExtensions: any[] = []) {
  let state = EditorState.create({
    doc,
    selection: { anchor, head },
    extensions: [markdown({ base: markdownLanguage }), ...extraExtensions]
  })

  const view: any = {
    get state() {
      return state
    },
    dispatch(spec: any) {
      state = state.update(spec).state
    }
  }
  return view
}

describe('Smart List Continuation & Markdown QoL', () => {
  it('continues bullet lists and exits at root level on empty item', () => {
    const view = createMockView('- hello', 7)
    expect(handleListEnter(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('- hello\n- ')

    // Second Enter on empty root bullet exits the list cleanly
    expect(handleListEnter(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('- hello\n')
  })

  it('outdents nested empty list items on Enter instead of destroying nesting', () => {
    const view = createMockView('- parent\n    - ', 15)
    expect(handleListEnter(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('- parent\n  - ')

    expect(handleListEnter(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('- parent\n- ')

    expect(handleListEnter(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('- parent\n')
  })

  it('auto-renumbers subsequent ordered list items when inserting in the middle', () => {
    const doc = '1. first\n2. second\n3. third'
    const view = createMockView(doc, 8) // end of `1. first`
    expect(handleListEnter(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('1. first\n2. \n3. second\n4. third')
  })

  it('renumbers ordered lists cleanly on Tab indent and Shift-Tab outdent', () => {
    const doc = '1. first\n2. second\n3. third'
    const view = createMockView(doc, 12) // inside `2. second`
    expect(indentListLines(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('1. first\n  1. second\n2. third')

    expect(outdentListLines(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('1. first\n2. second\n3. third')
  })

  it('does NOT misfire inside fenced code blocks', () => {
    const doc = '```bash\n- not a list\n```'
    const view = createMockView(doc, 20) // end of `- not a list`
    expect(handleListEnter(view)).toBe(false)
    expect(handleTaskEnter(view)).toBe(false)
    expect(handleQuoteEnter(view)).toBe(false)
  })

  it('supports quoted lists and quoted tasks seamlessly', () => {
    const listView = createMockView('> - quoted item', 15)
    expect(handleQuoteEnter(listView)).toBe(false) // defers to list handler
    expect(handleListEnter(listView)).toBe(true)
    expect(listView.state.doc.toString()).toBe('> - quoted item\n> - ')

    // Empty quoted bullet drops bullet, keeps `> `
    expect(handleListEnter(listView)).toBe(true)
    expect(listView.state.doc.toString()).toBe('> - quoted item\n> ')

    const taskView = createMockView('> - [x] done', 12)
    expect(handleTaskEnter(taskView)).toBe(true)
    expect(taskView.state.doc.toString()).toBe('> - [x] done\n> - [ ] ')
  })

  it('supports Shift-Enter soft continuation aligned to list text column', () => {
    const view = createMockView('- item one', 10)
    expect(handleListShiftEnter(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('- item one\n  ')
  })

  it('supports smart Backspace on empty list, task, and quote markers', () => {
    const taskView = createMockView('- [ ] ', 6)
    expect(handleListBackspace(taskView)).toBe(true)
    expect(taskView.state.doc.toString()).toBe('')

    const nestedView = createMockView('  - ', 4)
    expect(handleListBackspace(nestedView)).toBe(true)
    expect(nestedView.state.doc.toString()).toBe('- ')

    const quoteView = createMockView('>> ', 3)
    expect(handleListBackspace(quoteView)).toBe(true)
    expect(quoteView.state.doc.toString()).toBe('> ')
  })

  it('steps down nested blockquotes one level on Enter', () => {
    const view = createMockView('>> hello\n>> ', 12)
    expect(handleQuoteEnter(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('>> hello\n> ')

    expect(handleQuoteEnter(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('>> hello\n')
  })

  it('moves lines up/down and renumbers ordered lists automatically', () => {
    const doc = '1. alpha\n2. beta\n3. gamma'
    const view = createMockView(doc, 10) // on `2. beta`
    expect(moveLinesUp(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('1. beta\n2. alpha\n3. gamma')

    expect(moveLinesDown(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('1. alpha\n2. beta\n3. gamma')
  })

  it('duplicates lines and renumbers ordered lists', () => {
    const doc = '1. alpha\n2. beta'
    const view = createMockView(doc, 4) // on `1. alpha`
    expect(duplicateLines(view, 'down')).toBe(true)
    expect(view.state.doc.toString()).toBe('1. alpha\n2. alpha\n3. beta')
  })

  it('toggles task marks cleanly across bullets, tasks, and plain lines', () => {
    const view = createMockView('- item', 3)
    expect(toggleTaskMark(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('- [ ] item')

    expect(toggleTaskMark(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('- [x] item')

    expect(toggleTaskMark(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('- [ ] item')
  })

  it('parses list lines accurately', () => {
    expect(parseListLine('  12) hello')?.kind).toBe('ordered-num')
    expect(parseListLine('> - [x] done')?.kind).toBe('task')
    expect(isListLine('not a list')).toBe(false)
  })
})

describe('Editor Keymap Mode Scaffold (Vim slot)', () => {
  it('mounts and reconfigures cleanly without errors', () => {
    const compartment = createKeymapModeCompartment()
    const view = createMockView('hello', 0, 0, [
      compartment.of(resolveKeymapModeExtension(DEFAULT_KEYMAP_MODE))
    ])

    expect(() => reconfigureKeymapMode(view, compartment, 'vim')).not.toThrow()
    expect(() => reconfigureKeymapMode(view, compartment, 'default')).not.toThrow()
    expect(view.state.doc.toString()).toBe('hello')
  })
})

describe('Customizable Editor Line-Move Shortcuts', () => {
  it('resolves defaults and custom overrides cleanly', () => {
    expect(getActiveShortcut('moveLineUp')).toBe('Alt + Up')
    expect(getActiveShortcut('moveLineDown')).toBe('Alt + Down')
    expect(getActiveShortcut('duplicateLineUp')).toBe('Shift + Alt + Up')
    expect(getActiveShortcut('duplicateLineDown')).toBe('Shift + Alt + Down')
    expect(getActiveShortcut('toggleTask')).toBe('Ctrl + Shift + X')

    const custom = { moveLineUp: 'Ctrl + Shift + Up' }
    expect(getActiveShortcut('moveLineUp', custom)).toBe('Ctrl + Shift + Up')
  })

  it('matches KeyboardEvents accurately including arrow keys and custom bindings', () => {
    const altUp = { key: 'ArrowUp', code: 'ArrowUp', ctrlKey: false, altKey: true, shiftKey: false, metaKey: false } as KeyboardEvent
    expect(matchesShortcutEvent(altUp, 'Alt + Up')).toBe(true)
    expect(matchesShortcutEvent(altUp, 'Shift + Alt + Up')).toBe(false)

    const customUp = { key: 'ArrowUp', code: 'ArrowUp', ctrlKey: true, altKey: false, shiftKey: true, metaKey: false } as KeyboardEvent
    expect(matchesShortcutEvent(customUp, 'Ctrl + Shift + Up')).toBe(true)
    expect(matchesShortcutEvent(customUp, 'Alt + Up')).toBe(false)
  })
})
