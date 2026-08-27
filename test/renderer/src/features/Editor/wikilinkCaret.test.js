import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@codemirror/view', () => ({
  EditorView: {
    domEventHandlers: (handlers) => ({ __handlers: handlers })
  }
}))

const { wikilinkCaretFix } = await import(
  '../../../../../src/renderer/src/features/Editor/wikilinkCaret'
)

describe('wikilinkCaretFix', () => {
  const handler = wikilinkCaretFix.__handlers.mousedown

  function makeTarget(className) {
    return {
      closest: (sel) => {
        if (sel === '.cm-atomic-wiki-link' || sel === '.cm-atomic-wikilink-wrap') {
          return className
            ? {
                className,
                getBoundingClientRect: () => ({ left: 0, width: 100, top: 0, bottom: 10 })
              }
            : null
        }
        return null
      }
    }
  }

  function makeView(docText = 'hello [[target]] world', atPos = 6) {
    const dispatch = vi.fn()
    const view = {
      posAtDOM: vi.fn(() => atPos),
      state: {
        doc: {
          length: docText.length,
          sliceString: (from, to) => docText.slice(from, to)
        }
      },
      dispatch
    }
    return { view, dispatch }
  }

  it('registers a mousedown handler', () => {
    expect(typeof handler).toBe('function')
  })

  it('returns false when click is not on a wikilink', () => {
    const e = { target: makeTarget(null), clientX: 50 }
    const { view } = makeView()
    const result = handler(e, view)
    expect(result).toBe(false)
  })

  it('returns false when clicking the left half of a wikilink', () => {
    const e = { target: makeTarget('cm-atomic-wiki-link'), clientX: 30 } // left half of 100px width
    const { view, dispatch } = makeView()
    const result = handler(e, view)
    expect(result).toBe(false)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('moves cursor after the wikilink when clicking the right half', () => {
    const docText = 'hello [[target]] world'
    const atPos = docText.indexOf('[[') // 6
    const e = { target: makeTarget('cm-atomic-wiki-link'), clientX: 70, preventDefault: vi.fn() } // right half
    const { view, dispatch } = makeView(docText, atPos)
    const result = handler(e, view)

    const match = docText.slice(atPos, atPos + 200).match(/^\[\[.*?\]\]/)
    const endPos = atPos + match[0].length

    expect(result).toBe(true)
    expect(dispatch).toHaveBeenCalledWith({
      selection: { anchor: endPos, head: endPos },
      userEvent: 'select'
    })
  })

  it('handles clicks on the wikilink-wrap class', () => {
    const docText = 'x [[abc]] y'
    const atPos = docText.indexOf('[[')
    const e = { target: makeTarget('cm-atomic-wikilink-wrap'), clientX: 200, preventDefault: vi.fn() }
    const { view, dispatch } = makeView(docText, atPos)
    const result = handler(e, view)

    expect(result).toBe(true)
    expect(dispatch).toHaveBeenCalled()
  })

  it('returns false when no wikilink syntax matches at the position', () => {
    const docText = 'no link here'
    const e = { target: makeTarget('cm-atomic-wiki-link'), clientX: 70 }
    const { view, dispatch } = makeView(docText, 2)
    const result = handler(e, view)

    expect(result).toBe(false)
    expect(dispatch).not.toHaveBeenCalled()
  })
})
