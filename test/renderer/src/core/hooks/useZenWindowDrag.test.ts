/**
 * @file useZenWindowDrag.test.ts
 * @description Unit tests for useZenWindowDrag hook (Alt + Left Mouse Drag window movement).
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useZenWindowDrag } from '../../../../../src/renderer/src/core/hooks/useZenWindowDrag'

describe('useZenWindowDrag Hook', () => {
  let moveWindowMock: any

  beforeEach(() => {
    moveWindowMock = vi.fn().mockResolvedValue(true)
    window.api = {
      ...(window.api || {}),
      moveWindow: moveWindowMock
    } as any
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does nothing on mouse down if Alt key is not pressed', () => {
    renderHook(() => useZenWindowDrag({ enabled: true }))

    const target = document.createElement('div')
    document.body.appendChild(target)

    const mouseDownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      altKey: false,
      screenX: 100,
      screenY: 100
    })
    target.dispatchEvent(mouseDownEvent)

    const mouseMoveEvent = new MouseEvent('mousemove', {
      bubbles: true,
      altKey: false,
      buttons: 1,
      screenX: 120,
      screenY: 130
    })
    window.dispatchEvent(mouseMoveEvent)

    expect(moveWindowMock).not.toHaveBeenCalled()
    document.body.removeChild(target)
  })

  it('does nothing if enabled is false, even with Alt key pressed', () => {
    renderHook(() => useZenWindowDrag({ enabled: false }))

    const target = document.createElement('div')
    document.body.appendChild(target)

    const mouseDownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      altKey: true,
      screenX: 100,
      screenY: 100
    })
    target.dispatchEvent(mouseDownEvent)

    const mouseMoveEvent = new MouseEvent('mousemove', {
      bubbles: true,
      altKey: true,
      buttons: 1,
      screenX: 150,
      screenY: 150
    })
    window.dispatchEvent(mouseMoveEvent)

    expect(moveWindowMock).not.toHaveBeenCalled()
    document.body.removeChild(target)
  })

  it('moves window on Alt + Left Click Drag when enabled', () => {
    renderHook(() => useZenWindowDrag({ enabled: true }))

    const target = document.createElement('div')
    document.body.appendChild(target)

    const mouseDownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      altKey: true,
      screenX: 100,
      screenY: 100
    })
    target.dispatchEvent(mouseDownEvent)

    const mouseMoveEvent = new MouseEvent('mousemove', {
      bubbles: true,
      altKey: true,
      buttons: 1,
      screenX: 120,
      screenY: 130
    })
    window.dispatchEvent(mouseMoveEvent)

    expect(moveWindowMock).toHaveBeenCalledWith(20, 30)

    // Mouse up ends drag
    const mouseUpEvent = new MouseEvent('mouseup', { bubbles: true })
    window.dispatchEvent(mouseUpEvent)

    // Further move does not call moveWindow
    moveWindowMock.mockClear()
    window.dispatchEvent(mouseMoveEvent)
    expect(moveWindowMock).not.toHaveBeenCalled()

    document.body.removeChild(target)
  })

  it('does NOT trigger drag on interactive elements (input, textarea, button)', () => {
    renderHook(() => useZenWindowDrag({ enabled: true }))

    const input = document.createElement('input')
    const textarea = document.createElement('textarea')
    const button = document.createElement('button')
    document.body.appendChild(input)
    document.body.appendChild(textarea)
    document.body.appendChild(button)

    // Test input
    input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, altKey: true, screenX: 10, screenY: 10 }))
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, altKey: true, buttons: 1, screenX: 20, screenY: 20 }))
    expect(moveWindowMock).not.toHaveBeenCalled()

    // Test textarea
    textarea.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, altKey: true, screenX: 10, screenY: 10 }))
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, altKey: true, buttons: 1, screenX: 20, screenY: 20 }))
    expect(moveWindowMock).not.toHaveBeenCalled()

    // Test button
    button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, altKey: true, screenX: 10, screenY: 10 }))
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, altKey: true, buttons: 1, screenX: 20, screenY: 20 }))
    expect(moveWindowMock).not.toHaveBeenCalled()

    document.body.removeChild(input)
    document.body.removeChild(textarea)
    document.body.removeChild(button)
  })

  it('does NOT drag when text is selected', () => {
    renderHook(() => useZenWindowDrag({ enabled: true }))

    const target = document.createElement('div')
    document.body.appendChild(target)

    vi.spyOn(window, 'getSelection').mockReturnValue({
      toString: () => 'selected text content'
    } as any)

    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, altKey: true, screenX: 50, screenY: 50 }))
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, altKey: true, buttons: 1, screenX: 80, screenY: 80 }))

    expect(moveWindowMock).not.toHaveBeenCalled()

    document.body.removeChild(target)
  })
})
