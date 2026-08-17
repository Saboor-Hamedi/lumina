import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useResizeWindowValue } from '../../src/main/handlers/useResizeWindowValue'

const settingsSet = vi.fn()

vi.mock('../../src/main/SettingsManager', () => ({
  default: {
    set: (...args) => settingsSet(...args)
  }
}))

function makeWindow({
  maximized = false,
  minimized = false,
  bounds = { x: 1, y: 2, width: 800, height: 600 }
} = {}) {
  const listeners = {}
  return {
    isMaximized: vi.fn(() => maximized),
    isMinimized: vi.fn(() => minimized),
    getBounds: vi.fn(() => ({ ...bounds })),
    on: vi.fn((event, cb) => {
      listeners[event] = cb
    }),
    _listeners: listeners
  }
}

describe('useResizeWindowValue', () => {
  beforeEach(() => {
    settingsSet.mockReset()
    settingsSet.mockResolvedValue(true)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('registers resized, moved, and close listeners', () => {
    const win = makeWindow()
    useResizeWindowValue(win)
    expect(win.on).toHaveBeenCalledWith('resized', expect.any(Function))
    expect(win.on).toHaveBeenCalledWith('moved', expect.any(Function))
    expect(win.on).toHaveBeenCalledWith('close', expect.any(Function))
  })

  it('saves bounds after resize (debounced)', async () => {
    const win = makeWindow({ bounds: { x: 10, y: 20, width: 900, height: 700 } })
    useResizeWindowValue(win)

    win._listeners.resized()
    win._listeners.resized()
    expect(settingsSet).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(500)

    expect(settingsSet).toHaveBeenCalledTimes(1)
    expect(settingsSet).toHaveBeenCalledWith('windowBounds', {
      x: 10,
      y: 20,
      width: 900,
      height: 700
    })
  })

  it('saves bounds after move (debounced)', async () => {
    const win = makeWindow({ bounds: { x: 5, y: 6, width: 800, height: 600 } })
    useResizeWindowValue(win)

    win._listeners.moved()
    await vi.advanceTimersByTimeAsync(500)

    expect(settingsSet).toHaveBeenCalledTimes(1)
    expect(settingsSet).toHaveBeenCalledWith('windowBounds', {
      x: 5,
      y: 6,
      width: 800,
      height: 600
    })
  })

  it('debounces multiple rapid events into a single save', async () => {
    const win = makeWindow({ bounds: { x: 1, y: 2, width: 100, height: 100 } })
    useResizeWindowValue(win)

    win._listeners.resized()
    await vi.advanceTimersByTimeAsync(300)
    win._listeners.resized()
    await vi.advanceTimersByTimeAsync(300)
    win._listeners.moved()
    await vi.advanceTimersByTimeAsync(500)

    expect(settingsSet).toHaveBeenCalledTimes(1)
  })

  it('saves bounds immediately on close when not maximized/minimized', async () => {
    const win = makeWindow({ bounds: { x: 3, y: 4, width: 1024, height: 768 } })
    useResizeWindowValue(win)

    win._listeners.close()

    expect(settingsSet).toHaveBeenCalledTimes(1)
    expect(settingsSet).toHaveBeenCalledWith('windowBounds', {
      x: 3,
      y: 4,
      width: 1024,
      height: 768
    })
  })

  it('does not save bounds when maximized', async () => {
    const win = makeWindow({ maximized: true })
    useResizeWindowValue(win)

    win._listeners.close()
    win._listeners.resized()
    await vi.advanceTimersByTimeAsync(500)

    expect(settingsSet).not.toHaveBeenCalled()
  })

  it('does not save bounds when minimized', async () => {
    const win = makeWindow({ minimized: true })
    useResizeWindowValue(win)

    win._listeners.close()
    win._listeners.moved()
    await vi.advanceTimersByTimeAsync(500)

    expect(settingsSet).not.toHaveBeenCalled()
  })

  it('clears the debounce timer on close so a stale save is skipped', async () => {
    const win = makeWindow({ bounds: { x: 7, y: 8, width: 500, height: 400 } })
    useResizeWindowValue(win)

    win._listeners.resized()
    win._listeners.close()
    await vi.advanceTimersByTimeAsync(500)

    // Only the close save should happen, not a second stale save from the debounced resize
    expect(settingsSet).toHaveBeenCalledTimes(1)
  })

  it('handles settings save rejection gracefully', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    settingsSet.mockRejectedValue(new Error('disk full'))
    const win = makeWindow()
    useResizeWindowValue(win)

    // Should not throw
    win._listeners.close()

    await vi.advanceTimersByTimeAsync(0)
    expect(settingsSet).toHaveBeenCalledTimes(1)
    consoleError.mockRestore()
  })
})
