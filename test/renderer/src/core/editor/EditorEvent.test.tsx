import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderHook } from '@testing-library/react'
import { useEditorEvents } from '../../../../../src/renderer/src/core/editor/EditorEvent'
import type { EditorView } from '@codemirror/view'

describe('EditorEvent - handleAISave cursor and focus protection', () => {
  let mockView: any
  let realViewRef: React.MutableRefObject<EditorView | null>
  let titleRef: React.RefObject<HTMLInputElement | null>
  let lastSaveTimeRef: React.MutableRefObject<number>
  let lastSavedCodeRef: React.MutableRefObject<string | undefined>
  let latestCodeRef: React.MutableRefObject<string>
  let setIsDirty: any
  let setDirty: any
  let showToast: any
  let setShowFindWidget: any
  let setReplaceModeActive: any

  beforeEach(() => {
    mockView = {
      state: {
        doc: {
          toString: vi.fn().mockReturnValue('Initial line 1\nInitial line 2'),
          length: 30,
          lines: 2,
          line: vi.fn().mockReturnValue({ from: 0, to: 14 }),
          lineAt: vi.fn().mockReturnValue({ from: 0, to: 14 })
        },
        selection: {
          main: { head: 25, anchor: 25 }
        }
      },
      hasFocus: false,
      dispatch: vi.fn(),
      requestMeasure: vi.fn(),
      dom: document.createElement('div')
    }

    realViewRef = { current: mockView as any }
    titleRef = { current: null }
    lastSaveTimeRef = { current: 0 }
    lastSavedCodeRef = { current: 'Initial line 1\nInitial line 2' }
    latestCodeRef = { current: 'Initial line 1\nInitial line 2' }
    setIsDirty = vi.fn()
    setDirty = vi.fn()
    showToast = vi.fn()
    setShowFindWidget = vi.fn()
    setReplaceModeActive = vi.fn()
  })

  it('preserves user cursor without passing selection when editor has focus', () => {
    mockView.hasFocus = true

    renderHook(() =>
      useEditorEvents({
        isActive: true,
        realViewRef,
        titleRef,
        snippet: { id: 'note-1', code: 'Initial line 1\nInitial line 2', title: 'Note' } as any,
        showToast,
        setShowFindWidget,
        setReplaceModeActive,
        lastSaveTimeRef,
        lastSavedCodeRef,
        latestCodeRef,
        setIsDirty,
        setDirty
      })
    )

    // Lumina AI writes to the note
    const newCode = 'Initial line 1\nInitial line 2\nAppended by Lumina'
    window.dispatchEvent(
      new CustomEvent('ai-saved-snippet', {
        detail: {
          id: 'note-1',
          code: newCode
        }
      })
    )

    // Dispatch was called with minimal change
    expect(mockView.dispatch).toHaveBeenCalled()
    const dispatchArg = mockView.dispatch.mock.calls[0][0]

    // Because editor has focus, selection is explicitly pinned so the user's cursor doesn't jump or follow Lumina
    expect(dispatchArg.selection).toEqual({ anchor: 25, head: 25 })
    expect(dispatchArg.scrollIntoView).toBe(false)
    expect(dispatchArg.changes).toBeDefined()
    expect(dispatchArg.changes.insert).toBe('\nAppended by Lumina')
  })

  it('preserves user cursor without passing selection when user is typing in composer/input', () => {
    mockView.hasFocus = false

    // Simulate user typing in Lumina composer textarea
    const composerTextarea = document.createElement('textarea')
    composerTextarea.className = 'composer-textarea'
    document.body.appendChild(composerTextarea)
    composerTextarea.focus()

    renderHook(() =>
      useEditorEvents({
        isActive: true,
        realViewRef,
        titleRef,
        snippet: { id: 'note-1', code: 'Initial line 1\nInitial line 2', title: 'Note' } as any,
        showToast,
        setShowFindWidget,
        setReplaceModeActive,
        lastSaveTimeRef,
        lastSavedCodeRef,
        latestCodeRef,
        setIsDirty,
        setDirty
      })
    )

    // Lumina AI writes to the note
    const newCode = 'Initial line 1\nInitial line 2\nAppended by Lumina'
    window.dispatchEvent(
      new CustomEvent('ai-saved-snippet', {
        detail: {
          id: 'note-1',
          code: newCode
        }
      })
    )

    expect(mockView.dispatch).toHaveBeenCalled()
    const dispatchArg = mockView.dispatch.mock.calls[0][0]

    // Because user is typing in composer, selection must NOT be forced onto editor
    expect(dispatchArg.selection).toBeUndefined()
    expect(dispatchArg.changes).toBeDefined()

    document.body.removeChild(composerTextarea)
  })

  it('sets selection and navigates when user is idle (not focused in editor or inputs)', () => {
    mockView.hasFocus = false
    // Ensure activeElement is body (idle user)
    document.body.focus()

    renderHook(() =>
      useEditorEvents({
        isActive: true,
        realViewRef,
        titleRef,
        snippet: { id: 'note-1', code: 'Initial line 1\nInitial line 2', title: 'Note' } as any,
        showToast,
        setShowFindWidget,
        setReplaceModeActive,
        lastSaveTimeRef,
        lastSavedCodeRef,
        latestCodeRef,
        setIsDirty,
        setDirty
      })
    )

    const newCode = 'Initial line 1\nInitial line 2\nAppended by Lumina'
    window.dispatchEvent(
      new CustomEvent('ai-saved-snippet', {
        detail: {
          id: 'note-1',
          code: newCode,
          scrollToBottom: true
        }
      })
    )

    expect(mockView.dispatch).toHaveBeenCalled()
    const dispatchArg = mockView.dispatch.mock.calls[0][0]

    // In idle mode with scrollToBottom, selection is set to newCode.length
    expect(dispatchArg.selection).toBeDefined()
    expect(dispatchArg.selection.anchor).toBe(newCode.length)
  })

  it('allows AI to write cleanly to editor even when isDirty is true, preserving user cursor', () => {
    mockView.hasFocus = true

    renderHook(() =>
      useEditorEvents({
        isActive: true,
        realViewRef,
        titleRef,
        snippet: { id: 'note-1', code: 'Initial line 1\nInitial line 2', title: 'My Note' } as any,
        showToast,
        setShowFindWidget,
        setReplaceModeActive,
        lastSaveTimeRef,
        lastSavedCodeRef,
        latestCodeRef,
        setIsDirty,
        isDirty: true,
        setDirty
      })
    )

    // Lumina AI writes to the note at the same time
    const newCode = 'Initial line 1\nInitial line 2\nAppended by Lumina'
    window.dispatchEvent(
      new CustomEvent('ai-saved-snippet', {
        detail: {
          id: 'note-1',
          code: newCode
        }
      })
    )

    // AI write MUST succeed and dispatch minimal change with pinned cursor
    expect(mockView.dispatch).toHaveBeenCalled()
    const dispatchArg = mockView.dispatch.mock.calls[0][0]
    expect(dispatchArg.changes).toBeDefined()
    expect(dispatchArg.selection).toEqual({ anchor: 25, head: 25 })
    expect(dispatchArg.scrollIntoView).toBe(false)
  })
})
