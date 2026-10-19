import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCanvasPaste } from '../../../../../src/renderer/src/features/canvas/hooks/useCanvasPaste'

describe('useCanvasPaste Routing & Focus Isolation', () => {
  let container: HTMLDivElement
  let sidebar: HTMLDivElement
  let addNodeMock: ReturnType<typeof vi.fn>
  let onToastMock: ReturnType<typeof vi.fn>
  let pasteNodesMock: ReturnType<typeof vi.fn>
  let hasCopiedNodesMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    container = document.createElement('div')
    container.className = 'lumina-canvas-container'
    // Mock getBoundingClientRect
    container.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 50,
        width: 800,
        height: 600,
        right: 900,
        bottom: 650,
        x: 100,
        y: 50,
        toJSON: () => {}
      }) as DOMRect
    document.body.appendChild(container)

    sidebar = document.createElement('div')
    sidebar.className = 'shell-sidebar-left'
    const explorer = document.createElement('div')
    explorer.className = 'explorer-embedded-container'
    sidebar.appendChild(explorer)
    document.body.appendChild(sidebar)

    addNodeMock = vi.fn()
    onToastMock = vi.fn()
    pasteNodesMock = vi.fn()
    hasCopiedNodesMock = vi.fn().mockReturnValue(false)
  })

  afterEach(() => {
    if (container.parentNode) document.body.removeChild(container)
    if (sidebar.parentNode) document.body.removeChild(sidebar)
    vi.clearAllMocks()
  })

  it('does NOT intercept paste when isActive is false', () => {
    const containerRef = { current: container }
    renderHook(() =>
      useCanvasPaste({
        containerRef,
        screenToCanvas: (x, y) => ({ x, y }),
        viewport: { x: 0, y: 0, zoom: 1 },
        snapToGrid: false,
        addNode: addNodeMock as any,
        hasCopiedNodes: hasCopiedNodesMock as any,
        pasteNodes: pasteNodesMock as any,
        onToast: onToastMock as any,
        isActive: false
      })
    )

    const file = new File(['fake-image'], 'test.png', { type: 'image/png' })
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true }) as any
    pasteEvent.clipboardData = {
      items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }],
      files: [file]
    }

    container.dispatchEvent(pasteEvent)

    expect(addNodeMock).not.toHaveBeenCalled()
    expect(onToastMock).not.toHaveBeenCalled()
  })

  it('does NOT intercept paste when user is inside sidebar or file explorer', () => {
    const containerRef = { current: container }
    renderHook(() =>
      useCanvasPaste({
        containerRef,
        screenToCanvas: (x, y) => ({ x, y }),
        viewport: { x: 0, y: 0, zoom: 1 },
        snapToGrid: false,
        addNode: addNodeMock as any,
        hasCopiedNodes: hasCopiedNodesMock as any,
        pasteNodes: pasteNodesMock as any,
        onToast: onToastMock as any,
        isActive: true
      })
    )

    const file = new File(['fake-image'], 'test.png', { type: 'image/png' })
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true }) as any
    pasteEvent.clipboardData = {
      items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }],
      files: [file]
    }

    const explorerEl = sidebar.querySelector('.explorer-embedded-container')!
    explorerEl.dispatchEvent(pasteEvent)

    expect(addNodeMock).not.toHaveBeenCalled()
    expect(onToastMock).not.toHaveBeenCalled()
  })

  it('does NOT intercept paste when activeElement is an input or textarea', () => {
    const containerRef = { current: container }
    renderHook(() =>
      useCanvasPaste({
        containerRef,
        screenToCanvas: (x, y) => ({ x, y }),
        viewport: { x: 0, y: 0, zoom: 1 },
        snapToGrid: false,
        addNode: addNodeMock as any,
        hasCopiedNodes: hasCopiedNodesMock as any,
        pasteNodes: pasteNodesMock as any,
        onToast: onToastMock as any,
        isActive: true
      })
    )

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true }) as any
    input.dispatchEvent(pasteEvent)

    expect(addNodeMock).not.toHaveBeenCalled()
    expect(onToastMock).not.toHaveBeenCalled()

    document.body.removeChild(input)
  })
})
