import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../../../../../src/renderer/src/features/commandpalette', () => ({
  PreviewCommandPalette: ({ content }: { content?: string }) => (
    <div data-testid="mock-preview">{content}</div>
  )
}))

import Template from '../../../../../src/renderer/src/features/template/Template'

const mockTemplates = [
  {
    id: 'blank',
    title: 'Blank Note',
    code: '',
    description: 'Start with a completely empty note.'
  },
  {
    id: 't-daily',
    title: 'Daily Log',
    code: '# Daily Log\n\n- [ ] Morning review'
  },
  {
    id: 't-meeting',
    title: 'Meeting Notes',
    code: '# Meeting Notes\n\n- Discussion point'
  }
]

describe('Template.tsx (Embedded Sidebar)', () => {
  const onSelectTemplate = vi.fn()
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders template list, count badge, and search input', () => {
    render(
      <Template
        isEmbedded={true}
        isOpen={true}
        templates={mockTemplates}
        onSelectTemplate={onSelectTemplate}
        onClose={onClose}
      />
    )
    expect(screen.getByPlaceholderText('Search templates...')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Daily Log')).toBeInTheDocument()
    expect(screen.getAllByText('Meeting Notes').length).toBeGreaterThan(0)
  })

  it('updates preview on selection and applies without closing embedded sidebar', () => {
    render(
      <Template
        isEmbedded={true}
        isOpen={true}
        templates={mockTemplates}
        onSelectTemplate={onSelectTemplate}
        onClose={onClose}
      />
    )

    fireEvent.click(screen.getByText('Daily Log'))
    expect(screen.getByTestId('mock-preview')).toHaveTextContent('Morning review')

    fireEvent.click(screen.getByRole('button', { name: /apply/i }))
    expect(onSelectTemplate).toHaveBeenCalledTimes(1)
    expect(onSelectTemplate).toHaveBeenCalledWith(expect.objectContaining({ id: 't-daily' }))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('filters templates via search input', () => {
    render(
      <Template
        isEmbedded={true}
        isOpen={true}
        templates={mockTemplates}
        onSelectTemplate={onSelectTemplate}
        onClose={onClose}
      />
    )

    fireEvent.change(screen.getByPlaceholderText('Search templates...'), {
      target: { value: 'Meeting' }
    })
    expect(screen.getAllByText('Meeting Notes').length).toBeGreaterThan(0)
    expect(screen.queryByText('Daily Log')).not.toBeInTheDocument()
  })
})
