import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import ChatPreBlock from '@renderer/features/AI/components/LuminaChatPreBlock'

describe('LuminaChatPreBlock', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('highlights code with highlight.js and supports clipboard copy without react-syntax-highlighter', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    })

    const { container } = render(
      <ChatPreBlock>
        <code className="language-ts">{'const total: number = 42\n'}</code>
      </ChatPreBlock>
    )

    expect(screen.getByText('TS')).toBeInTheDocument()
    expect(screen.getByText('1 line')).toBeInTheDocument()
    const codeEl = container.querySelector('.chat-code-pre code.hljs') as HTMLElement
    expect(codeEl).not.toBeNull()
    expect(codeEl.innerHTML).toContain('hljs-keyword')
    expect(codeEl.textContent).toBe('const total: number = 42')

    fireEvent.click(screen.getByTitle('Copy code'))
    expect(writeText).toHaveBeenCalledWith('const total: number = 42')
  })

  it('delegates folder trees to LuminaFolderTree', () => {
    const { container } = render(
      <ChatPreBlock>
        <code className="language-tree">{'notes/\n├── intro.md\n└── plan.md'}</code>
      </ChatPreBlock>
    )
    expect(container.querySelector('.chat-code-block')).toBeNull()
  })
})
