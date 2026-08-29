import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TemplateModal from '../../../../../../src/renderer/src/features/Navigation/components/TemplateModal'

const sampleTemplates = [
  {
    id: 't1',
    title: 'Learning Notes.md',
    code: '# 🎓 Learning Notes\n\n## 📖 Key Concepts\n- one\n- two'
  },
  { id: 't2', title: 'Research Notes.md', code: '# 🔬 Research Notes\n\n## ❓ Question\n- ' },
  { id: 't3', title: 'Book Notes.md', code: '# 📚 Book Notes' }
]

describe('TemplateModal', () => {
  const defaultProps = () => ({
    isOpen: true,
    onClose: vi.fn(),
    templates: sampleTemplates,
    onSelectTemplate: vi.fn()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a Blank Note option before the templates', () => {
    render(<TemplateModal {...defaultProps()} />)
    expect(screen.getByText('Blank Note')).toBeInTheDocument()
    expect(screen.getByText('Learning Notes')).toBeInTheDocument()
    expect(screen.getByText('Research Notes')).toBeInTheDocument()
    expect(screen.getByText('Book Notes')).toBeInTheDocument()
  })

  it('shows the template count in the stats line', () => {
    render(<TemplateModal {...defaultProps()} />)
    // 1 blank + 3 templates
    expect(screen.getByText('Showing 4 templates')).toBeInTheDocument()
  })

  it('filters templates by search query', () => {
    render(<TemplateModal {...defaultProps()} />)
    const input = screen.getByPlaceholderText('Search templates (Use arrow keys)...')
    fireEvent.change(input, { target: { value: 'book' } })
    expect(screen.getByText('Book Notes')).toBeInTheDocument()
    expect(screen.queryByText('Learning Notes')).not.toBeInTheDocument()
    expect(screen.queryByText('Research Notes')).not.toBeInTheDocument()
  })

  it('shows a no-templates message when nothing matches', () => {
    render(<TemplateModal {...defaultProps()} />)
    const input = screen.getByPlaceholderText('Search templates (Use arrow keys)...')
    fireEvent.change(input, { target: { value: 'zzz-no-match' } })
    expect(screen.getByText('No templates found.')).toBeInTheDocument()
  })

  it('selects a template on click and closes', () => {
    const props = defaultProps()
    render(<TemplateModal {...props} />)
    fireEvent.click(screen.getByText('Book Notes'))
    expect(props.onSelectTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't3', title: 'Book Notes.md' })
    )
    expect(props.onClose).toHaveBeenCalled()
  })

  it('selects the blank note option on click', () => {
    const props = defaultProps()
    render(<TemplateModal {...props} />)
    fireEvent.click(screen.getByText('Blank Note'))
    expect(props.onSelectTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'blank', title: 'Blank Note', code: '' })
    )
    expect(props.onClose).toHaveBeenCalled()
  })

  it('selects a template with Enter on the focused row', () => {
    const props = defaultProps()
    render(<TemplateModal {...props} />)
    const input = screen.getByPlaceholderText('Search templates (Use arrow keys)...')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    // Focus starts at index 0 (Blank), ArrowDown moves to index 1 (Learning Notes)
    expect(props.onSelectTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't1', title: 'Learning Notes.md' })
    )
    expect(props.onClose).toHaveBeenCalled()
  })

  it('navigates options with arrow keys', () => {
    const props = defaultProps()
    render(<TemplateModal {...props} />)
    const input = screen.getByPlaceholderText('Search templates (Use arrow keys)...')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const cards = document.body.querySelectorAll('.template-modal-card')
    expect(cards[1].className).toContain('focused')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(cards[2].className).toContain('focused')
  })

  it('clamps focus at the first option when arrow up at the top', () => {
    const props = defaultProps()
    render(<TemplateModal {...props} />)
    const input = screen.getByPlaceholderText('Search templates (Use arrow keys)...')

    fireEvent.keyDown(input, { key: 'ArrowUp' })
    const cards = document.body.querySelectorAll('.template-modal-card')
    expect(cards[0].className).toContain('focused')
  })

  it('closes on Escape', () => {
    const props = defaultProps()
    render(<TemplateModal {...props} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalled()
  })

  it('closes when clicking the overlay background', () => {
    const props = defaultProps()
    render(<TemplateModal {...props} />)
    const overlay = document.querySelector('.template-modal-overlay')
    fireEvent.click(overlay)
    expect(props.onClose).toHaveBeenCalled()
  })

  it('does not close when clicking inside the container', () => {
    const props = defaultProps()
    render(<TemplateModal {...props} />)
    const container = document.querySelector('.template-modal-container')
    fireEvent.click(container)
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it('renders a wireframe preview from template code', () => {
    render(<TemplateModal {...defaultProps()} />)
    const card = screen.getByText('Learning Notes').closest('.template-modal-card')
    // code has an h1, an h2, and a bullet → all render as preview elements
    expect(
      card.querySelectorAll(
        '.template-preview-h1, .template-preview-h2, .template-preview-list-item'
      ).length
    ).toBeGreaterThan(0)
    expect(document.body.querySelector('.template-modal-grid')).toBeInTheDocument()
  })
})
