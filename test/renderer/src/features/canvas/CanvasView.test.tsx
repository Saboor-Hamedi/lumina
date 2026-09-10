import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { CanvasView } from '../../../../../src/renderer/src/features/canvas/CanvasView'
import { CanvasTabPane } from '../../../../../src/renderer/src/features/canvas/CanvasTabPane'
import { CanvasData } from '../../../../../src/renderer/src/features/canvas/types'

describe('CanvasView (TypeScript)', () => {
  const initialData: CanvasData = {
    nodes: [
      {
        id: 'node-1',
        type: 'note',
        title: 'Project Architecture',
        text: 'Overview of core system modules',
        x: 100,
        y: 150,
        width: 250,
        height: 180,
        color: 'default'
      }
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 }
  }

  it('renders initial node card with title and text', () => {
    render(<CanvasView initialData={initialData} />)
    expect(screen.getByText('Project Architecture')).toBeInTheDocument()
    expect(screen.getByText('Overview of core system modules')).toBeInTheDocument()
  })

  it('renders canvas toolbar with sticky, tool modes, and zoom tools', () => {
    render(<CanvasView initialData={initialData} />)
    expect(screen.getByLabelText('Select Tool (V)')).toBeInTheDocument()
    expect(screen.getByLabelText('Hand / Pan Tool (H or hold Space)')).toBeInTheDocument()
    expect(screen.getByLabelText('Add Sticky Note')).toBeInTheDocument()
    expect(screen.getByLabelText('Zoom In (Ctrl + Scroll)')).toBeInTheDocument()
    expect(screen.getByLabelText('Zoom Out')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('adds a new sticky note when Add Sticky Note is clicked', () => {
    render(<CanvasView initialData={initialData} />)
    const addStickyBtn = screen.getByLabelText('Add Sticky Note')
    fireEvent.click(addStickyBtn)

    expect(screen.getByText('Quick Idea')).toBeInTheDocument()
  })

  it('allows double clicking to edit node text inline', () => {
    render(<CanvasView initialData={initialData} />)
    const textEl = screen.getByText('Overview of core system modules')
    fireEvent.doubleClick(textEl)

    const textarea = screen.getByDisplayValue('Overview of core system modules')
    expect(textarea).toBeInTheDocument()

    fireEvent.change(textarea, { target: { value: 'Updated system architecture' } })
    fireEvent.blur(textarea)

    expect(screen.getByText('Updated system architecture')).toBeInTheDocument()
  })

  it('cycles card colors when color button is clicked', () => {
    const { container } = render(<CanvasView initialData={initialData} />)
    const colorBtn = screen.getByLabelText('Change Color')
    fireEvent.click(colorBtn)

    const card = container.querySelector('.lumina-canvas-node')
    expect(card?.classList.contains('color-yellow')).toBe(true)
  })

  it('handles HTML5 dropped note snippets from FileExplorer', () => {
    const { container } = render(<CanvasView initialData={initialData} />)
    const canvasContainer = container.querySelector('.lumina-canvas-container')!

    const snippet = {
      id: 'snippet-dropped-html5',
      title: 'Dropped HTML5 Note',
      content: 'Testing direct dataTransfer',
      fileName: 'test.md'
    }

    fireEvent.drop(canvasContainer, {
      clientX: 200,
      clientY: 200,
      dataTransfer: {
        getData: (key: string) => {
          if (key === 'application/lumina-snippet') return JSON.stringify(snippet)
          return ''
        },
        files: []
      }
    })

    expect(screen.getByText('Dropped HTML5 Note')).toBeInTheDocument()
    expect(screen.getByText('Testing direct dataTransfer')).toBeInTheDocument()
  })

  it('preserves PDF file types when dropped onto canvas', () => {
    const { container } = render(<CanvasView initialData={initialData} />)
    const canvasContainer = container.querySelector('.lumina-canvas-container')!

    const pdfSnippet = {
      id: 'snippet-pdf-1',
      title: 'Whitepaper.pdf',
      fileName: 'Whitepaper.pdf',
      type: 'pdf'
    }

    fireEvent.drop(canvasContainer, {
      clientX: 200,
      clientY: 200,
      dataTransfer: {
        getData: (key: string) => {
          if (key === 'application/lumina-snippet') return JSON.stringify(pdfSnippet)
          return ''
        },
        files: []
      }
    })

    expect(screen.getByText('Whitepaper.pdf')).toBeInTheDocument()
    expect(screen.getByText('PDF')).toBeInTheDocument()
    expect(screen.getByText('Open PDF Tab')).toBeInTheDocument()
  })

  it('handles dropped image snippets and renders an image node', () => {
    const { container } = render(<CanvasView initialData={initialData} />)
    const canvasContainer = container.querySelector('.lumina-canvas-container')!

    const imgSnippet = {
      id: 'snippet-img-1',
      title: 'Architecture Diagram',
      fileName: 'diagram.png',
      type: 'image'
    }

    fireEvent.drop(canvasContainer, {
      clientX: 300,
      clientY: 200,
      dataTransfer: {
        getData: (key: string) => {
          if (key === 'application/lumina-snippet') return JSON.stringify(imgSnippet)
          return ''
        },
        files: []
      }
    })

    expect(screen.getByText('Architecture Diagram')).toBeInTheDocument()
    const imgEl = container.querySelector('.lumina-canvas-node-image-wrap img')
    expect(imgEl).toBeInTheDocument()
    expect(imgEl?.getAttribute('src')).toContain('asset://local/diagram.png')
  })

  it('allows linking two nodes by clicking on connection ports', () => {
    const twoNodesData: CanvasData = {
      nodes: [
        {
          id: 'n1',
          type: 'text',
          title: 'Start Node',
          text: 'From here',
          x: 100,
          y: 100,
          width: 200,
          height: 120
        },
        {
          id: 'n2',
          type: 'text',
          title: 'End Node',
          text: 'To here',
          x: 400,
          y: 100,
          width: 200,
          height: 120
        }
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    }

    const { container } = render(<CanvasView initialData={twoNodesData} />)

    // Find the right port of the first node
    const n1 = screen.getByText('Start Node').closest('.lumina-canvas-node')!
    const rightPort = n1.querySelector('.port-right')!
    fireEvent.mouseDown(rightPort)

    // Click the left port of the second node
    const n2 = screen.getByText('End Node').closest('.lumina-canvas-node')!
    const leftPort = n2.querySelector('.port-left')!
    fireEvent.click(leftPort)

    // Verify an edge connector SVG line now exists
    const edge = container.querySelector('.lumina-canvas-edge-line')
    expect(edge).toBeInTheDocument()
  })

  it('switches between Select and Hand/Pan tool modes', () => {
    render(<CanvasView initialData={initialData} />)
    const handBtn = screen.getByLabelText('Hand / Pan Tool (H or hold Space)')
    fireEvent.click(handBtn)
    expect(handBtn.classList.contains('active')).toBe(true)

    const selectBtn = screen.getByLabelText('Select Tool (V)')
    fireEvent.click(selectBtn)
    expect(selectBtn.classList.contains('active')).toBe(true)
    expect(handBtn.classList.contains('active')).toBe(false)
  })
})

describe('CanvasTabPane (TypeScript)', () => {
  it('renders canvas from snippet.code and auto-saves on mutation', async () => {
    const onSaveMock = vi.fn().mockResolvedValue({})
    const snippet = {
      id: 'snippet-canvas-1',
      title: 'Brainstorming',
      fileName: 'Brainstorming.canvas',
      type: 'canvas',
      code: JSON.stringify({
        nodes: [
          {
            id: 'n1',
            type: 'text',
            title: 'Concept 1',
            text: 'Exploring ideas',
            x: 50,
            y: 50,
            width: 200,
            height: 120
          }
        ],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
      })
    }

    render(<CanvasTabPane snippet={snippet} onSave={onSaveMock} isSelected={true} />)
    expect(screen.getByText('Concept 1')).toBeInTheDocument()

    // Add sticky
    const addStickyBtn = screen.getByLabelText('Add Sticky Note')
    fireEvent.click(addStickyBtn)

    await waitFor(() => {
      expect(onSaveMock).toHaveBeenCalled()
    })
  })
})
