import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setupWikilinkHover } from '../../../../../src/renderer/src/features/Workspace/hoverWikilink'

describe('hoverWikilink.js', () => {
  let wrapper
  let mockGetVaultStore
  let cleanup

  beforeEach(() => {
    vi.useFakeTimers()
    wrapper = document.createElement('div')
    wrapper.className = 'cm-editor'
    document.body.appendChild(wrapper)

    const contentEl = document.createElement('div')
    contentEl.className = 'cm-content'
    wrapper.appendChild(contentEl)

    mockGetVaultStore = vi.fn(() => ({
      snippets: [
        {
          id: 'note-1',
          title: 'TargetNote',
          code: 'This is preview content for note 1\nLine 2\nLine 3',
          updatedAt: Date.now()
        }
      ],
      setSelectedSnippet: vi.fn(),
      saveSnippet: vi.fn()
    }))

    cleanup = setupWikilinkHover(wrapper, mockGetVaultStore)
  })

  afterEach(() => {
    if (cleanup) cleanup()
    document.body.innerHTML = ''
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('renders hover card with 2px border radius and parallel alignment on mouseover', () => {
    const linkEl = document.createElement('span')
    linkEl.className = 'cm-atomic-wiki-link'
    linkEl.setAttribute('data-wiki-link-target', 'TargetNote')
    linkEl.textContent = '[[TargetNote]]'
    wrapper.querySelector('.cm-content').appendChild(linkEl)

    linkEl.getBoundingClientRect = vi.fn(() => ({
      left: 100,
      right: 200,
      top: 50,
      bottom: 70,
      width: 100,
      height: 20
    }))

    wrapper.getBoundingClientRect = vi.fn(() => ({
      left: 20,
      right: 800,
      top: 0,
      bottom: 600,
      width: 780,
      height: 600
    }))

    wrapper.querySelector('.cm-content').getBoundingClientRect = vi.fn(() => ({
      left: 60,
      right: 740,
      top: 20,
      bottom: 580,
      width: 680,
      height: 560
    }))

    linkEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    vi.advanceTimersByTime(400)

    const hoverCard = document.querySelector('.cm-wiki-hover')
    expect(hoverCard).not.toBeNull()
    expect(hoverCard.style.borderRadius).toBe('2px')
    expect(hoverCard.style.left).toBe('100px') // Parallel with link left
    expect(hoverCard.style.top).toBe('76px') // Positioned directly below link (70 + 6)
  })

  it('scrolls the hover card content on ArrowDown and ArrowUp keypresses', () => {
    const linkEl = document.createElement('span')
    linkEl.className = 'cm-atomic-wiki-link'
    linkEl.setAttribute('data-wiki-link-target', 'TargetNote')
    linkEl.textContent = '[[TargetNote]]'
    wrapper.querySelector('.cm-content').appendChild(linkEl)

    linkEl.getBoundingClientRect = vi.fn(() => ({
      left: 100,
      right: 200,
      top: 50,
      bottom: 70,
      width: 100,
      height: 20
    }))

    linkEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    vi.advanceTimersByTime(400)

    const hoverCard = document.querySelector('.cm-wiki-hover')
    expect(hoverCard).not.toBeNull()

    const scrollWrap = hoverCard.querySelector('.wiki-hover-content-wrap')
    expect(scrollWrap).not.toBeNull()

    let scrollValue = 0
    const originalScrollTop = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop')
    Object.defineProperty(Element.prototype, 'scrollTop', {
      get: () => scrollValue,
      set: (val) => {
        scrollValue = val
      },
      configurable: true
    })

    try {
      // Test ArrowDown
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
      expect(scrollValue).toBe(40)

      // Test ArrowUp
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
      expect(scrollValue).toBe(0)
    } finally {
      if (originalScrollTop) {
        Object.defineProperty(Element.prototype, 'scrollTop', originalScrollTop)
      }
    }
  })

  it('dismisses the hover card when Escape is pressed', () => {
    const linkEl = document.createElement('span')
    linkEl.className = 'cm-atomic-wiki-link'
    linkEl.setAttribute('data-wiki-link-target', 'TargetNote')
    linkEl.textContent = '[[TargetNote]]'
    wrapper.querySelector('.cm-content').appendChild(linkEl)

    linkEl.getBoundingClientRect = vi.fn(() => ({
      left: 100,
      right: 200,
      top: 50,
      bottom: 70,
      width: 100,
      height: 20
    }))

    linkEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    vi.advanceTimersByTime(400)

    expect(document.querySelector('.cm-wiki-hover')).not.toBeNull()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(document.querySelector('.cm-wiki-hover')).toBeNull()
  })
})
