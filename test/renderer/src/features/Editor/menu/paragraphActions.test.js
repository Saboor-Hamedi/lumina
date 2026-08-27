import { describe, it, expect, vi } from 'vitest'
import { togglePrefix } from '../../../../../../src/renderer/src/features/Editor/menu/paragraphActions'

// Build a minimal CodeMirror-like doc with line metadata
function makeDoc(text) {
  const lines = text.split('\n')
  const doc = {
    lines,
    length: text.length,
    lineAt(pos) {
      let start = 0
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const from = start
        const to = start + line.length
        if (pos >= from && pos <= to) {
          return { number: i + 1, from, to, text: line }
        }
        start = to + 1
      }
      // Fallback: last line
      const last = lines.length - 1
      const lastFrom = text.length - lines[last].length
      return { number: last + 1, from: lastFrom, to: text.length, text: lines[last] }
    },
    line(number) {
      const line = lines[number - 1]
      const from = lines.slice(0, number - 1).join('\n').length + (number > 1 ? 1 : 0)
      return { number, from, to: from + line.length, text: line }
    }
  }
  return doc
}

function makeView(doc, selection = { from: 0, to: 0 }) {
  const dispatch = vi.fn()
  const focus = vi.fn()
  const view = { state: { doc, selection: { main: selection } }, dispatch, focus }
  return { view, dispatch, focus }
}

describe('togglePrefix', () => {
  it('does nothing when view is missing', () => {
    expect(() => togglePrefix(null, '# ')).not.toThrow()
  })

  it('adds heading prefix to the current line', () => {
    const doc = makeDoc('hello world')
    const { view, dispatch } = makeView(doc, { from: 0, to: 0 })

    togglePrefix(view, '# ')

    expect(dispatch).toHaveBeenCalledWith({ changes: [{ from: 0, to: 0, insert: '# ' }] })
  })

  it('removes heading prefix when line already starts with it', () => {
    const doc = makeDoc('# hello world')
    const { view, dispatch } = makeView(doc, { from: 3, to: 3 })

    togglePrefix(view, '# ')

    expect(dispatch).toHaveBeenCalledWith({ changes: [{ from: 0, to: 2, insert: '' }] })
  })

  it('replaces an existing different block prefix', () => {
    const doc = makeDoc('> quote line')
    const { view, dispatch } = makeView(doc, { from: 0, to: 0 })

    togglePrefix(view, '- ')

    expect(dispatch).toHaveBeenCalledWith({
      changes: [{ from: 0, to: 2, insert: '- ' }]
    })
  })

  it('applies prefix to every selected line', () => {
    const doc = makeDoc('line one\nline two')
    // Selection spans both lines (0 .. end of doc)
    const { view, dispatch } = makeView(doc, { from: 0, to: doc.length })

    togglePrefix(view, '- ')

    expect(dispatch).toHaveBeenCalledWith({
      changes: [
        { from: 0, to: 0, insert: '- ' },
        { from: 9, to: 9, insert: '- ' }
      ]
    })
  })

  it('strips prefix from a task list line when the same prefix is applied', () => {
    const doc = makeDoc('- [ ] todo item')
    const { view, dispatch } = makeView(doc, { from: 6, to: 6 })

    togglePrefix(view, '- [ ] ')

    expect(dispatch).toHaveBeenCalledWith({ changes: [{ from: 0, to: 6, insert: '' }] })
  })
})
