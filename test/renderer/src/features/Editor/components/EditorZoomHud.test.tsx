import { describe, it, expect } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { EditorZoomHud } from '../../../../../../src/renderer/src/features/Editor/components/EditorZoomHud'

describe('EditorZoomHud.tsx', () => {
  it('renders nothing when zoomBadge is null', () => {
    const { container } = render(<EditorZoomHud zoomBadge={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when zoomBadge is empty string', () => {
    const { container } = render(<EditorZoomHud zoomBadge="" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders badge with text and accessibility attributes when zoomBadge is provided', () => {
    render(<EditorZoomHud zoomBadge="125%" />)
    const hud = screen.getByRole('status')
    expect(hud).toBeDefined()
    expect(hud.textContent).toContain('125%')
    expect(hud.className).toContain('editor-zoom-hud')
    expect(hud.getAttribute('aria-live')).toBe('polite')
  })
})
