import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTextEditor } from '../../../../../src/renderer/src/core/hooks/useTextEditor'

describe('useTextEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with empty string by default', () => {
    const { result } = renderHook(() => useTextEditor())
    expect(result.current.code).toBe('')
  })

  it('initializes with provided value', () => {
    const { result } = renderHook(() => useTextEditor('hello'))
    expect(result.current.code).toBe('hello')
  })

  it('updates code when initialValue changes', () => {
    const { result, rerender } = renderHook(({ val }) => useTextEditor(val), {
      initialProps: { val: 'initial' }
    })
    expect(result.current.code).toBe('initial')

    rerender({ val: 'updated' })
    expect(result.current.code).toBe('updated')
  })

  it('inserts 2 spaces on Tab key', () => {
    const { result } = renderHook(() => useTextEditor('abc'))

    const mockEvent = {
      key: 'Tab',
      target: {
        selectionStart: 1,
        selectionEnd: 1,
        value: 'abc'
      },
      preventDefault: vi.fn()
    }

    act(() => {
      result.current.handleKeyDown(mockEvent)
    })

    expect(result.current.code).toBe('a  bc')
    expect(mockEvent.preventDefault).toHaveBeenCalled()
  })

  it('deletes 2 spaces on Backspace when preceded by double space', () => {
    const { result } = renderHook(() => useTextEditor('a  bc'))

    const mockEvent = {
      key: 'Backspace',
      target: {
        selectionStart: 3,
        selectionEnd: 3,
        value: 'a  bc'
      },
      preventDefault: vi.fn()
    }

    act(() => {
      result.current.handleKeyDown(mockEvent)
    })

    expect(result.current.code).toBe('abc')
    expect(mockEvent.preventDefault).toHaveBeenCalled()
  })

  it('does not delete more chars than available on Backspace', () => {
    const { result } = renderHook(() => useTextEditor('ab'))

    const mockEvent = {
      key: 'Backspace',
      target: {
        selectionStart: 1,
        selectionEnd: 1,
        value: 'ab'
      },
      preventDefault: vi.fn()
    }

    act(() => {
      result.current.handleKeyDown(mockEvent)
    })

    expect(result.current.code).toBe('ab')
  })

  it('preserves indentation on Enter', () => {
    const { result } = renderHook(() => useTextEditor('  hello'))

    const mockEvent = {
      key: 'Enter',
      target: {
        selectionStart: 7,
        selectionEnd: 7,
        value: '  hello'
      },
      preventDefault: vi.fn()
    }

    act(() => {
      result.current.handleKeyDown(mockEvent)
    })

    expect(result.current.code).toBe('  hello\n  ')
    expect(mockEvent.preventDefault).toHaveBeenCalled()
  })

  it('inserts text at cursor position via insertText', () => {
    const { result } = renderHook(() => useTextEditor('hello'))

    const mockTextarea = {
      selectionStart: 5,
      selectionEnd: 5,
      value: 'hello'
    }
    result.current.textareaRef.current = mockTextarea

    act(() => {
      result.current.insertText(' world')
    })

    expect(result.current.code).toBe('hello world')
  })

  it('sets code directly via setCode', () => {
    const { result } = renderHook(() => useTextEditor())

    act(() => {
      result.current.setCode('new content')
    })

    expect(result.current.code).toBe('new content')
  })
})
