import { describe, it, expect, vi } from 'vitest'

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

  function makeTarget(className, rect = { left: 0, width: 100, top: 0, bottom: 10 }) {
    return {
      classList: {
        contains: (c) => className === c
      },
      closest: (sel) => {
        if (
          sel === '.cm-atomic-wiki-link' ||
          sel === '.cm-atomic-wikilink-wrap' ||
          sel === '.cm-atomic-wiki-link-hidden-syntax'
        ) {
          return className
            ? {
                className,
                classList: { contains: (c) => className === c },
                getBoundingClientRect: () => rect,
                closest: () => null
              }
            : null
        }
        if (sel === '.cm-line') {
          return null
        }
        return null
      },
      getBoundingClientRect: () => rect
    }
  }

  function makeView(docText = 'hello [[target]] world', atPos = 6) {
    const dispatch = vi.fn()
    const focus = vi.fn()
    const view = {
      posAtDOM: vi.fn(() => atPos),
      state: {
        doc: {
          length: docText.length,
          lineAt: vi.fn(() => ({
            text: docText,
            from: 0,
            to: docText.length
          })),
          sliceString: (from, to) => docText.slice(from, to)
        }
      },
      dispatch,
      focus
    }
    return { view, dispatch, focus }
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

  it('moves cursor before the wikilink when clicking the left half', () => {
    const docText = 'hello [[target]] world'
    const atPos = docText.indexOf('[[') // 6
    const e = { target: makeTarget('cm-atomic-wiki-link'), clientX: 30, preventDefault: vi.fn(), stopPropagation: vi.fn() } // left half of 100px width
    const { view, dispatch } = makeView(docText, atPos)
    const result = handler(e, view)
    expect(result).toBe(true)
    expect(dispatch).toHaveBeenCalledWith({
      selection: { anchor: atPos, head: atPos },
      userEvent: 'select'
    })
  })

  it('moves cursor after the wikilink when clicking the right half', () => {
    const docText = 'hello [[target]] world'
    const atPos = docText.indexOf('[[') // 6
    const e = { target: makeTarget('cm-atomic-wiki-link'), clientX: 70, preventDefault: vi.fn(), stopPropagation: vi.fn() } // right half
    const { view, dispatch } = makeView(docText, atPos)
    const result = handler(e, view)

    const match = docText.slice(atPos).match(/^\[\[.*?\]\]/)
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
    const e = { target: makeTarget('cm-atomic-wikilink-wrap'), clientX: 70, preventDefault: vi.fn(), stopPropagation: vi.fn() }
    const { view, dispatch } = makeView(docText, atPos)
    const result = handler(e, view)

    expect(result).toBe(true)
    expect(dispatch).toHaveBeenCalled()
  })

  it('handles clicks on cm-atomic-wiki-link-hidden-syntax', () => {
    const docText = 'start [[my-doc]] end'
    const atPos = docText.indexOf('[[')
    const e = { target: makeTarget('cm-atomic-wiki-link-hidden-syntax'), clientX: 80, preventDefault: vi.fn(), stopPropagation: vi.fn() }
    const { view, dispatch } = makeView(docText, atPos)
    const result = handler(e, view)

    expect(result).toBe(true)
    expect(dispatch).toHaveBeenCalled()
  })
})
