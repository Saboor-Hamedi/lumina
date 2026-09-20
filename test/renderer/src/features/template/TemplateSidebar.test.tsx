import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import RawTemplateSidebar from '../../../../../src/renderer/src/features/template/TemplateSidebar'
const TemplateSidebar = RawTemplateSidebar as React.ComponentType<any>

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
    code: '# 📅 Daily Log\n\n- [ ] Morning review\n- [ ] Deep work\n- [x] Gym'
  },
  {
    id: 't-meeting',
    title: 'Meeting Notes',
    code: '# 👥 Meeting Notes\n\n**Attendees:** Alice, Bob\n- Discussion point 1\n- Discussion point 2'
  },
  {
    id: 't-project',
    title: 'Project Tracker',
    code: '# 🚀 Project Tracker\n\n| Task | Owner | Status |\n|---|---|---|\n| Design | Saboor | Done |'
  },
  {
    id: 't-general',
    title: 'General Idea',
    code: '# 💡 Idea\n\nSome unstructured thoughts and notes.'
  }
]

describe('TemplateSidebar.jsx', () => {
  const defaultProps = {
    templates: mockTemplates,
    selectedId: 'blank',
    onSelect: vi.fn(),
    onApply: vi.fn(),
    searchQuery: '',
    setSearchQuery: vi.fn(),
    isOpen: true
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders search input and template count', () => {
    render(<TemplateSidebar {...defaultProps} />)
    expect(screen.getByPlaceholderText('Search templates...')).toBeInTheDocument()
    expect(screen.getByText('5 Templates')).toBeInTheDocument()
  })

  it('renders Theme-style cards with titles and preview boxes', () => {
    render(<TemplateSidebar {...defaultProps} />)
    expect(screen.getByText('Blank Note')).toBeInTheDocument()
    expect(screen.getByText('Daily Log')).toBeInTheDocument()
    expect(screen.getByText('Meeting Notes')).toBeInTheDocument()
    expect(screen.getByText('Project Tracker')).toBeInTheDocument()
    expect(screen.getByText('General Idea')).toBeInTheDocument()

    const cards = document.querySelectorAll('.template-modal-card')
    expect(cards.length).toBe(5)

    const previews = document.querySelectorAll('.template-modal-preview')
    expect(previews.length).toBe(5)
  })

  it('shows check badge on selected template and pill badge on unselected', () => {
    render(<TemplateSidebar {...defaultProps} selectedId="blank" />)

    const cards = document.querySelectorAll('.template-modal-card')
    // Blank is selected (index 0)
    expect(cards[0].className).toContain('active')
    expect(cards[0].querySelector('.template-check-badge')).toBeInTheDocument()

    // Other templates have .template-badge
    expect(cards[1].querySelector('.template-badge')).toBeInTheDocument()
    expect(cards[1].querySelector('.template-badge')?.textContent).toBe('TEMPLATE')
  })

  it('renders the blank note empty document preview wireframe', () => {
    render(<TemplateSidebar {...defaultProps} />)
    expect(screen.getByText('Empty Note')).toBeInTheDocument()
    expect(document.querySelector('.template-mini-plus-circle')).toBeInTheDocument()
  })

  it('renders checklist wireframe for daily log templates', () => {
    render(<TemplateSidebar {...defaultProps} />)
    const dailyCard = screen.getByText('Daily Log').closest('.template-modal-card')
    expect(dailyCard?.querySelectorAll('.template-mini-todo-item').length).toBeGreaterThan(0)
    expect(dailyCard?.querySelector('.template-mini-checkbox.checked')).toBeInTheDocument()
  })

  it('renders meeting bullets wireframe for meeting templates', () => {
    render(<TemplateSidebar {...defaultProps} />)
    const meetingCard = screen.getByText('Meeting Notes').closest('.template-modal-card')
    expect(meetingCard?.querySelectorAll('.template-mini-bullet-item').length).toBeGreaterThan(0)
    expect(meetingCard?.querySelector('.template-mini-avatars')).toBeInTheDocument()
  })

  it('renders table wireframe for templates with markdown tables', () => {
    render(<TemplateSidebar {...defaultProps} />)
    const projectCard = screen.getByText('Project Tracker').closest('.template-modal-card')
    expect(projectCard?.querySelector('.template-mini-table')).toBeInTheDocument()
  })

  it('calls onSelect when a template card is clicked', () => {
    const onSelect = vi.fn()
    render(<TemplateSidebar {...defaultProps} onSelect={onSelect} />)

    fireEvent.click(screen.getByText('Meeting Notes'))
    expect(onSelect).toHaveBeenCalledWith('t-meeting')
  })

  it('calls onApply when a template card is double-clicked', () => {
    const onApply = vi.fn()
    render(<TemplateSidebar {...defaultProps} onApply={onApply} />)

    const card = screen.getByText('Daily Log').closest('.template-modal-card')
    if (card) fireEvent.doubleClick(card)
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ id: 't-daily' }))
  })

  it('calls setSearchQuery on search input change', () => {
    const setSearchQuery = vi.fn()
    render(<TemplateSidebar {...defaultProps} setSearchQuery={setSearchQuery} />)

    const input = screen.getByPlaceholderText('Search templates...')
    fireEvent.change(input, { target: { value: 'meeting' } })
    expect(setSearchQuery).toHaveBeenCalledWith('meeting')
  })

  it('renders clear button and clears search when clicked', () => {
    const setSearchQuery = vi.fn()
    render(<TemplateSidebar {...defaultProps} searchQuery="test" setSearchQuery={setSearchQuery} />)

    const clearBtn = screen.getByLabelText('Clear search')
    fireEvent.click(clearBtn)
    expect(setSearchQuery).toHaveBeenCalledWith('')
  })

  it('displays empty message when templates list is empty', () => {
    render(<TemplateSidebar {...defaultProps} templates={[]} />)
    expect(screen.getByText('No matching templates found.')).toBeInTheDocument()
  })

  it('applies closed class when isOpen is false', () => {
    const { container } = render(<TemplateSidebar {...defaultProps} isOpen={false} />)
    expect(container.querySelector('.template-sidebar.closed')).toBeInTheDocument()
  })
})
