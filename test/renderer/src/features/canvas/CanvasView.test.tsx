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

  it('renders canvas toolbar with sticky and zoom tools', () => {
    render(<CanvasView initialData={initialData} />)
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

  it('handles dropped note snippets from FileExplorer', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => {}
    })

    render(<CanvasView initialData={initialData} />)

    act(() => {
      window.dispatchEvent(
        new window.CustomEvent('lumina:canvas-drop-item', {
          detail: {
            snippets: [
              {
                id: 'snippet-dropped-1',
                title: 'Dropped Meeting Note',
                content: 'Discussed Q3 milestones',
                fileName: 'meeting.md'
              }
            ],
            clientX: 200,
            clientY: 250
          }
        })
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Dropped Meeting Note')).toBeInTheDocument()
      expect(screen.getByText('Discussed Q3 milestones')).toBeInTheDocument()
    })
  })

  it('handles dropped image snippets and renders an image node', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => {}
    })

    const { container } = render(<CanvasView initialData={initialData} />)

    act(() => {
      window.dispatchEvent(
        new window.CustomEvent('lumina:canvas-drop-item', {
          detail: {
            snippets: [
              {
                id: 'snippet-img-1',
                title: 'Diagram',
                fileName: 'diagram.png',
                type: 'image'
              }
            ],
            clientX: 300,
            clientY: 200
          }
        })
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Diagram')).toBeInTheDocument()
    })
    const imgEl = container.querySelector('.lumina-canvas-node-image-wrap img')
    expect(imgEl).toBeInTheDocument()
    expect(imgEl?.getAttribute('src')).toContain('asset://local/diagram.png')
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
    expect(screen.getByText('Exploring ideas')).toBeInTheDocument()

    // Add a sticky note
    const addBtn = screen.getByLabelText('Add Sticky Note')
    fireEvent.click(addBtn)

    await waitFor(() => {
      expect(onSaveMock).toHaveBeenCalled()
    }, { timeout: 1500 })

    const savedSnippet = onSaveMock.mock.calls[0][0]
    expect(savedSnippet.id).toBe('snippet-canvas-1')
    const parsedCode = JSON.parse(savedSnippet.code)
    expect(parsedCode.nodes.length).toBe(2)
  })
})
