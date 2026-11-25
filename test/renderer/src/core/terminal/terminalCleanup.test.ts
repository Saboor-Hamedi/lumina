import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  constructorOptions: [] as any[],
  disposals: [] as string[]
}))

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    cols = 80
    rows = 24
    modes = {}
    buffer = {
      active: { viewportY: 0, length: 0, getLine: () => ({ translateToString: () => '' }) }
    }
    constructor(options: any) {
      mocks.constructorOptions.push(options)
    }
    loadAddon() {}
    open() {}
    clear() {}
    hasSelection() {
      return false
    }
    attachCustomWheelEventHandler() {
      return { dispose() {} }
    }
    attachCustomKeyEventHandler() {
      return { dispose() {} }
    }
    registerCharacterJoiner() {
      return 1
    }
    deregisterCharacterJoiner() {}
    registerLinkProvider() {
      return { dispose() {} }
    }
    onWriteParsed() {
      return { dispose() {} }
    }
    onScroll() {
      return { dispose() {} }
    }
    onResize() {
      return { dispose() {} }
    }
    onLineFeed() {
      return { dispose() {} }
    }
    dispose() {
      mocks.disposals.push('terminal')
    }
  }
}))

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit() {}
    proposeDimensions() {
      return { cols: 80, rows: 24 }
    }
    dispose() {}
  }
}))

vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: class {
    dispose() {}
  }
}))

vi.mock('@xterm/addon-search', () => ({
  SearchAddon: class {
    dispose() {}
  }
}))

import { useTerminalInstance } from '@renderer/core/terminal/useTerminalInstance'
import { DEFAULT_SCROLLBACK } from '@renderer/core/terminal/constants'

describe('Terminal GPU/memory hygiene', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.constructorOptions.length = 0
    mocks.disposals.length = 0
    container = document.createElement('div')
    document.body.appendChild(container)
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    )
  })

  afterEach(() => {
    container.remove()
    vi.unstubAllGlobals()
  })

  it('caps xterm scrollback at 1500 lines', () => {
    expect(DEFAULT_SCROLLBACK).toBe(1500)

    renderHook(() => useTerminalInstance({ container, transport: null }))

    expect(mocks.constructorOptions).toHaveLength(1)
    expect(mocks.constructorOptions[0].scrollback).toBe(1500)
  })

  it('keeps the terminal alive while the pane is open', () => {
    renderHook(() => useTerminalInstance({ container, transport: null }))
    expect(mocks.disposals).not.toContain('terminal')
  })

  it('disposes the terminal instance when the pane is closed', () => {
    const { unmount } = renderHook(() => useTerminalInstance({ container, transport: null }))

    unmount()

    expect(mocks.disposals).toContain('terminal')
  })
})
