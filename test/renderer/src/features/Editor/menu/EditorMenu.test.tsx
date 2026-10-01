import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import EditorMenu from '../../../../../../src/renderer/src/features/Editor/menu/EditorMenu'

describe('EditorMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseProps = {
    snippet: { id: 'test-1', code: '# Hello world' },
    onPreview: vi.fn(),
    onOpenExportDialog: vi.fn()
  }

  it('renders trigger button', () => {
    render(<EditorMenu {...baseProps} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('opens native dropdown menu on click', () => {
    render(<EditorMenu {...baseProps} />)
    const button = screen.getByRole('button')
    fireEvent.click(button)

    expect(screen.getByText('Preview Note')).toBeInTheDocument()
    expect(screen.getByText('Copy as Plain Text')).toBeInTheDocument()
    expect(screen.getByText('Export with Preview…')).toBeInTheDocument()
  })

  it('triggers onPreview when clicking Preview Note', () => {
    render(<EditorMenu {...baseProps} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('Preview Note'))

    expect(baseProps.onPreview).toHaveBeenCalledTimes(1)
  })

  it('triggers onOpenExportDialog when clicking Export with Preview', () => {
    render(<EditorMenu {...baseProps} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('Export with Preview…'))

    expect(baseProps.onOpenExportDialog).toHaveBeenCalledTimes(1)
  })

  it('copies code to clipboard on clicking Copy as Plain Text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: {
        writeText
      }
    })

    render(<EditorMenu {...baseProps} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('Copy as Plain Text'))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('# Hello world')
    })
  })
})
