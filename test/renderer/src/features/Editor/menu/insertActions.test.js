import { describe, it, expect, vi } from 'vitest'
import { insertSnippet } from '../../../../../../src/renderer/src/features/Editor/menu/insertActions'

describe('insertSnippet', () => {
  it('does nothing when view is missing', () => {
    expect(() => insertSnippet(null, 'text')).not.toThrow()
  })

  it('inserts snippet text at the current selection', () => {
    const view = {
      state: { selection: { main: { from: 2, to: 4 } } },
      dispatch: vi.fn(),
      focus: vi.fn()
    }

    insertSnippet(view, '| column |')

    expect(view.dispatch).toHaveBeenCalledWith({
      changes: { from: 2, to: 4, insert: '| column |' }
    })
    expect(view.focus).toHaveBeenCalled()
  })

  it('replaces selected text with the snippet', () => {
    const view = {
      state: { selection: { main: { from: 0, to: 6 } } },
      dispatch: vi.fn(),
      focus: vi.fn()
    }

    insertSnippet(view, '```')

    expect(view.dispatch).toHaveBeenCalledWith({
      changes: { from: 0, to: 6, insert: '```' }
    })
  })
})
