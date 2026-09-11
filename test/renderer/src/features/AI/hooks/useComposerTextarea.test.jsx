import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { useComposerTextarea } from '../../../../../../src/renderer/src/features/AI/hooks/useComposerTextarea'

function TestComponent({ input, isSidebar, isLoading }) {
  const textareaRef = useComposerTextarea({ input, isSidebar, isLoading })
  return <textarea ref={textareaRef} value={input} readOnly data-testid="composer-textarea" />
}

describe('useComposerTextarea hook', () => {
  it('sets initial height to 84px when isSidebar is true', () => {
    const { getByTestId } = render(
      <TestComponent input="" isSidebar={true} isLoading={false} />
    )
    const el = getByTestId('composer-textarea')
    expect(el.style.height).toBe('84px')
    expect(el.style.overflowY).toBe('hidden')
  })

  it('sets initial height to 52px when isSidebar is false', () => {
    const { getByTestId } = render(
      <TestComponent input="" isSidebar={false} isLoading={false} />
    )
    const el = getByTestId('composer-textarea')
    expect(el.style.height).toBe('52px')
    expect(el.style.overflowY).toBe('hidden')
  })

  it('does not shrink below min-height when single-line text is typed', () => {
    const { getByTestId, rerender } = render(
      <TestComponent input="" isSidebar={true} isLoading={false} />
    )
    const el = getByTestId('composer-textarea')
    Object.defineProperty(el, 'scrollHeight', { value: 37, configurable: true })

    rerender(<TestComponent input="Hello world" isSidebar={true} isLoading={false} />)
    expect(el.style.height).toBe('84px')
  })

  it('expands when scrollHeight exceeds min-height', () => {
    const { getByTestId, rerender } = render(
      <TestComponent input="" isSidebar={true} isLoading={false} />
    )
    const el = getByTestId('composer-textarea')
    Object.defineProperty(el, 'scrollHeight', { value: 140, configurable: true })

    rerender(<TestComponent input="Line 1\nLine 2\nLine 3\nLine 4\nLine 5" isSidebar={true} isLoading={false} />)
    expect(el.style.height).toBe('140px')
    expect(el.style.overflowY).toBe('hidden')
  })

  it('caps at max-height of 260px and enables auto overflow', () => {
    const { getByTestId, rerender } = render(
      <TestComponent input="" isSidebar={true} isLoading={false} />
    )
    const el = getByTestId('composer-textarea')
    Object.defineProperty(el, 'scrollHeight', { value: 400, configurable: true })

    rerender(<TestComponent input="Many lines of long text..." isSidebar={true} isLoading={false} />)
    expect(el.style.height).toBe('260px')
    expect(el.style.overflowY).toBe('auto')
  })
})
