import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import DocSidebar from '../../../../../src/renderer/src/features/Docs/DocSidebar'

describe('DocSidebar.jsx', () => {
  const mockDocs = {
    'introduction.md': '# Introduction to Lumina',
    'references/01-basic-syntax.md': '# 1. Basic Syntax',
    'references/02-code-and-syntax.md': '# 2. Code & Syntax Highlighting',
    'features/01-architecture.md': '# Architecture'
  }

  it('renders categorized doc groups and formatted doc titles', () => {
    const setSelectedDoc = vi.fn()
    render(<DocSidebar docs={mockDocs} selectedDoc="introduction.md" setSelectedDoc={setSelectedDoc} />)

    expect(screen.getByText('Introduction to Lumina')).toBeDefined()
    expect(screen.getByText('1. Basic Syntax')).toBeDefined()
    expect(screen.getByText('2. Code & Syntax Highlighting')).toBeDefined()
    expect(screen.getByText('Architecture')).toBeDefined()
  })

  it('filters documents based on search query', () => {
    const setSelectedDoc = vi.fn()
    render(<DocSidebar docs={mockDocs} selectedDoc="introduction.md" setSelectedDoc={setSelectedDoc} />)

    const searchInput = screen.getByPlaceholderText('Search documentation...')
    fireEvent.change(searchInput, { target: { value: 'Syntax' } })

    expect(screen.getByText('1. Basic Syntax')).toBeDefined()
    expect(screen.queryByText('Introduction to Lumina')).toBeNull()
  })

  it('calls setSelectedDoc when a document item is clicked', () => {
    const setSelectedDoc = vi.fn()
    render(<DocSidebar docs={mockDocs} selectedDoc="introduction.md" setSelectedDoc={setSelectedDoc} />)

    const syntaxDoc = screen.getByText('1. Basic Syntax')
    fireEvent.click(syntaxDoc)

    expect(setSelectedDoc).toHaveBeenCalledWith('references/01-basic-syntax.md')
  })
})
