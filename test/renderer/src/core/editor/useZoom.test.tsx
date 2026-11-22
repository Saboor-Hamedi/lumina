import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { useZoom } from '../../../../../src/renderer/src/core/editor/useZoom'
import { useSettingsStore } from '../../../../../src/renderer/src/core/store/SettingStore'

const mockUpdateEditorFontSize = vi.fn()

vi.mock('../../../../../src/renderer/src/core/hooks/useFontSettings', () => ({
  useFontSettings: () => ({
    editorFontSize: 16,
    updateEditorFontSize: mockUpdateEditorFontSize
  })
}))

describe('useZoom', () => {
  let container: HTMLDivElement
  let containerRef: React.RefObject<HTMLDivElement | null>
  let realViewRef: React.MutableRefObject<any>
  let updateSettingSpy: ReturnType<typeof vi.fn<(key: string, val: any) => void>>

  beforeEach(() => {
    vi.useFakeTimers()
    mockUpdateEditorFontSize.mockClear()
    updateSettingSpy = vi.fn<(key: string, val: any) => void>()

    useSettingsStore.setState((state: any) => ({
      ...state,
      settings: {
        ...(state.settings || {}),
        fontSize: 16
      },
      updateSetting: (key: string, val: any) => {
        updateSettingSpy(key, val)
        useSettingsStore.setState((s: any) => ({
          ...s,
          settings: { ...(s.settings || {}), [key]: val }
        }))
      }
    }))

    container = document.createElement('div')
    document.body.appendChild(container)
    containerRef = { current: container }
    realViewRef = {
      current: {
        dom: document.createElement('div'),
        contentDOM: document.createElement('div'),
        requestMeasure: vi.fn(),
        dispatch: vi.fn(),
        state: { selection: { main: { head: 0 } } }
      }
    }
    document.documentElement.style.setProperty('--font-size-editor', '16px')
  })

  afterEach(() => {
    vi.useRealTimers()
    container.remove()
  })

  it('increments and decrements font size by 1px on discrete Ctrl+wheel', () => {
    const { result } = renderHook(() =>
      useZoom({ containerRef, realViewRef, isActive: true, defaultSize: 16 })
    )

    act(() => {
      container.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          deltaY: -100,
          deltaMode: 0
        })
      )
    })

    expect(container.style.getPropertyValue('--font-size-editor')).toBe('17px')
    expect(result.current.zoomBadge).toBe('106%')

    act(() => {
      container.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          deltaY: 100,
          deltaMode: 0
        })
      )
    })

    expect(container.style.getPropertyValue('--font-size-editor')).toBe('16px')
    expect(result.current.zoomBadge).toBe('100%')

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(updateSettingSpy).toHaveBeenCalledWith('fontSize', 16)
  })

  it('accumulates fractional 2-finger trackpad pinch deltas smoothly and resets on reversal', () => {
    renderHook(() => useZoom({ containerRef, realViewRef, isActive: true, defaultSize: 16 }))

    // Sub-threshold pinch increments (-4, -4 -> total +8 < 10) should not step yet
    act(() => {
      container.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          deltaY: -4,
          deltaMode: 0
        })
      )
      container.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          deltaY: -4,
          deltaMode: 0
        })
      )
    })
    expect(container.style.getPropertyValue('--font-size-editor')).toBe('')

    // Third -4 pushes accumulator to +12 (>= 10) -> single +1px step (17px), remainder +2
    act(() => {
      container.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          deltaY: -4,
          deltaMode: 0
        })
      )
    })
    expect(container.style.getPropertyValue('--font-size-editor')).toBe('17px')

    // Reverse direction (+6 -> delta -6): accumulator must reset to 0 before accumulating -6
    // so an immediate reverse doesn't eat stale +2 remainder, and another +6 reaches -12 -> 16px
    act(() => {
      container.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          deltaY: 6,
          deltaMode: 0
        })
      )
    })
    expect(container.style.getPropertyValue('--font-size-editor')).toBe('17px')

    act(() => {
      container.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          deltaY: 6,
          deltaMode: 0
        })
      )
    })
    expect(container.style.getPropertyValue('--font-size-editor')).toBe('16px')
  })

  it('ignores Ctrl+wheel events targeting embedded graphs, inline graphs, or canvas elements', () => {
    renderHook(() => useZoom({ containerRef, realViewRef, isActive: true, defaultSize: 16 }))

    const selectors = ['nexus-embedded-graph', 'inline-graph-container', 'graph-container']
    for (const cls of selectors) {
      const graphEl = document.createElement('div')
      graphEl.className = cls
      const inner = document.createElement('div')
      graphEl.appendChild(inner)
      container.appendChild(graphEl)

      const evt = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        deltaY: -120,
        deltaMode: 0
      })
      act(() => {
        inner.dispatchEvent(evt)
      })
      expect(evt.defaultPrevented).toBe(false)
      expect(container.style.getPropertyValue('--font-size-editor')).toBe('')
      graphEl.remove()
    }

    const canvasEl = document.createElement('canvas')
    container.appendChild(canvasEl)
    const canvasEvt = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      deltaY: -120,
      deltaMode: 0
    })
    act(() => {
      canvasEl.dispatchEvent(canvasEvt)
    })
    expect(canvasEvt.defaultPrevented).toBe(false)
    expect(container.style.getPropertyValue('--font-size-editor')).toBe('')
  })

  it('supports Ctrl+=, Ctrl+-, and Ctrl+0 keyboard zoom shortcuts', () => {
    renderHook(() => useZoom({ containerRef, realViewRef, isActive: true, defaultSize: 16 }))

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: '=', code: 'Equal', ctrlKey: true, cancelable: true })
      )
    })
    expect(container.style.getPropertyValue('--font-size-editor')).toBe('18px')

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: '-', code: 'Minus', ctrlKey: true, cancelable: true })
      )
    })
    expect(container.style.getPropertyValue('--font-size-editor')).toBe('16px')

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: '=', code: 'Equal', ctrlKey: true, cancelable: true })
      )
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: '0', code: 'Digit0', ctrlKey: true, cancelable: true })
      )
    })
    expect(container.style.getPropertyValue('--font-size-editor')).toBe('16px')
  })
})
