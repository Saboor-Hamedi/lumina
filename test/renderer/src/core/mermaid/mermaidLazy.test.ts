import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInitialize = vi.fn()
const mockParse = vi.fn().mockResolvedValue(true)
const mockRender = vi.fn().mockResolvedValue({
  svg: '<svg viewBox="0 0 120 60"><g><text>Flow</text></g></svg>'
})

vi.mock('mermaid', () => ({
  default: {
    initialize: mockInitialize,
    parse: mockParse,
    render: mockRender
  }
}))

describe('mermaidExtension lazy loading & render pipeline', () => {
  beforeEach(() => {
    mockInitialize.mockClear()
    mockParse.mockClear()
    mockRender.mockClear()
  })

  it('does not eagerly initialize mermaid on import, and initializes & renders cleanly on demand', async () => {
    const { renderMermaidToElement, clearMermaidCache } = await import(
      '@renderer/core/mermaid/mermaidExtension'
    )

    expect(mockInitialize).not.toHaveBeenCalled()

    const container = document.createElement('div')
    document.body.appendChild(container)
    renderMermaidToElement(container, 'graph TD\nA --> B', 'lazy-test-1')

    await vi.waitFor(() => {
      expect(mockInitialize).toHaveBeenCalledTimes(1)
      expect(mockRender).toHaveBeenCalledWith('lazy-test-1', 'graph TD\nA --> B')
      expect(container.querySelector('svg')).not.toBeNull()
    })

    // Theme switch re-initializes loaded mermaid and clears cached SVGs cleanly
    clearMermaidCache()
    expect(mockInitialize).toHaveBeenCalledTimes(2)
  })
})
