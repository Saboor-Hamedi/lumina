import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import DocSidebar from '../../../../../src/renderer/src/features/Docs/DocSidebar'
import Documentation from '../../../../../src/renderer/src/features/Docs/Documentation'

describe('Documentation Component Suite', () => {
  const mockDocs = {
    'introduction.md': '# Introduction to Lumina\n\nWelcome to Lumina note taking.',
    'references/01-basic-syntax.md': '# 1. Basic Syntax\n\nLearn markdown easily.',
    'references/02-code-and-syntax.md': '# 2. Code & Syntax Highlighting\n\nCode blocks.',
    'features/01-architecture.md': '# Architecture\n\nSystem design.'
  }

  describe('DocSidebar.jsx', () => {
    it('renders categorized doc groups and formatted doc titles', () => {
      const setSelectedDoc = vi.fn()
      render(<DocSidebar docs={mockDocs} selectedDoc="introduction.md" setSelectedDoc={setSelectedDoc} />)

      expect(screen.getByText('Introduction to Lumina')).toBeInTheDocument()
      expect(screen.getByText('1. Basic Syntax')).toBeInTheDocument()
      expect(screen.getByText('2. Code & Syntax Highlighting')).toBeInTheDocument()
      expect(screen.getByText('Architecture')).toBeInTheDocument()
    })

    it('renders Learning Markdown folder name with flexShrink 0', () => {
      const setSelectedDoc = vi.fn()
      render(<DocSidebar docs={mockDocs} selectedDoc="introduction.md" setSelectedDoc={setSelectedDoc} />)

      const learningFolder = screen.getByText('Learning Markdown')
      expect(learningFolder).toBeInTheDocument()
      expect(learningFolder.style.whiteSpace).toBe('nowrap')
      expect(learningFolder.style.flexShrink).toBe('0')
    })

    it('toggles folder collapse on click', () => {
      const setSelectedDoc = vi.fn()
      render(<DocSidebar docs={mockDocs} selectedDoc="introduction.md" setSelectedDoc={setSelectedDoc} />)

      const folderToggle = screen.getByLabelText('Toggle Learning Markdown')
      expect(screen.getByText('1. Basic Syntax')).toBeInTheDocument()

      // Click to collapse
      fireEvent.click(folderToggle)
      expect(screen.queryByText('1. Basic Syntax')).toBeNull()

      // Click to expand again
      fireEvent.click(folderToggle)
      expect(screen.getByText('1. Basic Syntax')).toBeInTheDocument()
    })

    it('filters documents based on search query', () => {
      const setSelectedDoc = vi.fn()
      render(<DocSidebar docs={mockDocs} selectedDoc="introduction.md" setSelectedDoc={setSelectedDoc} />)

      const searchInput = screen.getByPlaceholderText('Search documentation...')
      fireEvent.change(searchInput, { target: { value: 'Syntax' } })

      expect(screen.getByText('1. Basic Syntax')).toBeInTheDocument()
      expect(screen.queryByText('Introduction to Lumina')).toBeNull()
    })

    it('calls setSelectedDoc when a document item is clicked', () => {
      const setSelectedDoc = vi.fn()
      render(<DocSidebar docs={mockDocs} selectedDoc="introduction.md" setSelectedDoc={setSelectedDoc} />)

      const syntaxDoc = screen.getByText('1. Basic Syntax')
      fireEvent.click(syntaxDoc)

      expect(setSelectedDoc).toHaveBeenCalledWith('references/01-basic-syntax.md')
    })

    it('renders with closed class when isOpen is false', () => {
      const { container } = render(
        <DocSidebar docs={mockDocs} selectedDoc="introduction.md" setSelectedDoc={vi.fn()} isOpen={false} />
      )
      expect(container.querySelector('.docs-sidebar.closed')).toBeInTheDocument()
    })
  })

  describe('Documentation.jsx Modal', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('returns null when isOpen is false', () => {
      const { container } = render(<Documentation isOpen={false} onClose={vi.fn()} />)
      expect(container.firstChild).toBeNull()
    })

    it('renders modal header, title, and badges when open', () => {
      render(<Documentation isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByText('Documentation')).toBeInTheDocument()

      const activeBadge = document.querySelector('.docs-header-active-doc')
      expect(activeBadge).toBeInTheDocument()

      const statBadge = document.querySelector('.docs-header-stat')
      expect(statBadge).toBeInTheDocument()
      expect(statBadge.textContent).toContain('read')
    })

    it('toggles sidebar on toggle button click', () => {
      render(<Documentation isOpen={true} onClose={vi.fn()} />)
      const toggleBtn = screen.getByLabelText('Hide Sidebar')
      fireEvent.click(toggleBtn)

      const sidebar = document.querySelector('.docs-sidebar')
      expect(sidebar.className).toContain('closed')
      expect(screen.getByLabelText('Show Sidebar')).toBeInTheDocument()
    })

    it('toggles maximize window on window button click', () => {
      render(<Documentation isOpen={true} onClose={vi.fn()} />)
      const maxBtn = screen.getByLabelText('Maximize Window')
      fireEvent.click(maxBtn)

      const container = document.querySelector('.docs-modal-container')
      expect(container.className).toContain('maximized')
      expect(screen.getByLabelText('Restore Window')).toBeInTheDocument()
    })

    it('calls onClose when close button or overlay is clicked', () => {
      const onClose = vi.fn()
      render(<Documentation isOpen={true} onClose={onClose} />)

      const closeBtn = screen.getByLabelText('Close Documentation (Esc)')
      fireEvent.click(closeBtn)
      expect(onClose).toHaveBeenCalled()
    })
  })
})
