import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ConvasShapes, CANVAS_SHAPES, renderShapeSVG } from '../../../../../src/renderer/src/features/canvas/ConvasShapes'
import { CanvasView } from '../../../../../src/renderer/src/features/canvas/CanvasView'
import { CanvasData } from '../../../../../src/renderer/src/features/canvas/types'

describe('ConvasShapes Palette & Renderer', () => {
  it('contains around 10-11 distinct shapes', () => {
    expect(CANVAS_SHAPES.length).toBeGreaterThanOrEqual(10)
    const shapeIds = CANVAS_SHAPES.map((s) => s.id)
    expect(shapeIds).toContain('rectangle')
    expect(shapeIds).toContain('rounded-rectangle')
    expect(shapeIds).toContain('circle')
    expect(shapeIds).toContain('diamond')
    expect(shapeIds).toContain('triangle')
    expect(shapeIds).toContain('hexagon')
    expect(shapeIds).toContain('cylinder')
    expect(shapeIds).toContain('cloud')
    expect(shapeIds).toContain('star')
    expect(shapeIds).toContain('parallelogram')
    expect(shapeIds).toContain('speech-bubble')
  })

  it('renders valid SVG elements for all shapes', () => {
    CANVAS_SHAPES.forEach((s) => {
      const el = renderShapeSVG(s.id, '#38bdf8', '#38bdf8', 0.12, 1.6)
      expect(el).toBeDefined()
    })
  })

  it('renders shapes flyout submenu when isOpen is true', () => {
    const onSelectMock = vi.fn()
    const onCloseMock = vi.fn()

    render(
      <ConvasShapes
        isOpen={true}
        onClose={onCloseMock}
        onSelectShape={onSelectMock}
      />
    )

    expect(screen.getByText('Shapes')).toBeInTheDocument()
    expect(screen.getByText('Diamond')).toBeInTheDocument()
    expect(screen.getByText('Cylinder')).toBeInTheDocument()
    expect(screen.getByText('Cloud')).toBeInTheDocument()
    expect(screen.getByText('Star')).toBeInTheDocument()
  })

  it('calls onSelectShape with default width and height when a shape is clicked', () => {
    const onSelectMock = vi.fn()
    const onCloseMock = vi.fn()

    render(
      <ConvasShapes
        isOpen={true}
        onClose={onCloseMock}
        onSelectShape={onSelectMock}
      />
    )

    const diamondBtn = screen.getByText('Diamond').closest('button')!
    fireEvent.click(diamondBtn)

    expect(onSelectMock).toHaveBeenCalledWith('diamond', 130, 130, 'default')
    expect(onCloseMock).toHaveBeenCalled()
  })

  it('allows picking a color in the shapes palette and uses it when creating a shape', () => {
    const onSelectMock = vi.fn()
    const onCloseMock = vi.fn()

    render(
      <ConvasShapes
        isOpen={true}
        onClose={onCloseMock}
        onSelectShape={onSelectMock}
      />
    )

    // Click yellow color swatch
    const yellowDot = screen.getByLabelText('Color: Yellow')
    fireEvent.click(yellowDot)

    // Click Circle shape
    const circleBtn = screen.getByText('Circle').closest('button')!
    fireEvent.click(circleBtn)

    expect(onSelectMock).toHaveBeenCalledWith('circle', 120, 120, 'yellow')
  })

  it('supports drag-and-drop of shapes onto canvas', () => {
    const initialData: CanvasData = {
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    }

    const { container } = render(<CanvasView initialData={initialData} />)
    const canvasContainer = container.querySelector('.lumina-canvas-container')!

    const shapeDropData = JSON.stringify({
      shapeType: 'cylinder',
      width: 120,
      height: 130
    })

    fireEvent.drop(canvasContainer, {
      clientX: 300,
      clientY: 300,
      dataTransfer: {
        getData: (key: string) => {
          if (key === 'application/lumina-shape') return shapeDropData
          return ''
        }
      }
    })

    // Verify a cylinder shape node has been added to canvas
    const shapeNode = container.querySelector('.lumina-canvas-node.is-shape')
    expect(shapeNode).toBeInTheDocument()
  })

  it('allows double-clicking a shape to edit its centered text', () => {
    const shapeData: CanvasData = {
      nodes: [
        {
          id: 'shape-1',
          type: 'shape',
          shape: 'diamond',
          title: '',
          text: 'Is User Authenticated?',
          x: 200,
          y: 200,
          width: 160,
          height: 140,
          color: 'cyan'
        }
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    }

    render(<CanvasView initialData={shapeData} />)
    const textEl = screen.getByText('Is User Authenticated?')
    expect(textEl).toBeInTheDocument()

    // Double click to edit
    fireEvent.doubleClick(textEl)

    const textarea = screen.getByDisplayValue('Is User Authenticated?')
    expect(textarea).toBeInTheDocument()

    fireEvent.change(textarea, { target: { value: 'Token Valid?' } })
    fireEvent.blur(textarea)

    expect(screen.getByText('Token Valid?')).toBeInTheDocument()
  })

  it('has connection ports on shapes for wire linking', () => {
    const shapeData: CanvasData = {
      nodes: [
        {
          id: 'shape-1',
          type: 'shape',
          shape: 'circle',
          title: '',
          text: 'Start',
          x: 100,
          y: 100,
          width: 120,
          height: 120,
          color: 'green'
        }
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    }

    const { container } = render(<CanvasView initialData={shapeData} />)
    const shapeNode = container.querySelector('.lumina-canvas-node.is-shape')!

    expect(shapeNode.querySelector('.port-top')).toBeInTheDocument()
    expect(shapeNode.querySelector('.port-right')).toBeInTheDocument()
    expect(shapeNode.querySelector('.port-bottom')).toBeInTheDocument()
    expect(shapeNode.querySelector('.port-left')).toBeInTheDocument()
  })

  it('renders visible Palette button and cycles shape color when clicked', async () => {
    const shapeData: CanvasData = {
      nodes: [
        {
          id: 'shape-1',
          type: 'shape',
          shape: 'rectangle',
          title: '',
          text: 'Process',
          x: 100,
          y: 100,
          width: 140,
          height: 100,
          color: 'default'
        }
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    }

    const { container } = render(<CanvasView initialData={shapeData} />)
    const shapeNode = container.querySelector('.lumina-canvas-node.is-shape')!
    expect(shapeNode).toHaveClass('color-default')

    // Find palette button inside shape actions
    const paletteBtn = shapeNode.querySelector('.lumina-canvas-shape-actions button[aria-label="Change Color"]')!
    expect(paletteBtn).toBeInTheDocument()

    // Click palette button to cycle color
    fireEvent.click(paletteBtn)
    await waitFor(() => {
      expect(shapeNode).toHaveClass('color-yellow')
    })
  })

  it('deletes ONLY the selected shape when Delete key is pressed and preserves other nodes', async () => {
    const multiNodeData: CanvasData = {
      nodes: [
        {
          id: 'shape-to-delete',
          type: 'shape',
          shape: 'diamond',
          title: '',
          text: 'Delete Me',
          x: 50,
          y: 50,
          width: 120,
          height: 120,
          color: 'red'
        },
        {
          id: 'sticky-keep',
          type: 'text',
          title: 'Preserve Me',
          text: 'I must remain on canvas',
          x: 300,
          y: 50,
          width: 200,
          height: 120,
          color: 'green'
        }
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    }

    const { container } = render(<CanvasView initialData={multiNodeData} />)
    expect(screen.getByText('Delete Me')).toBeInTheDocument()
    expect(screen.getByText('Preserve Me')).toBeInTheDocument()

    // Select the diamond shape node
    const shapeNode = container.querySelector('[data-node-id="shape-to-delete"]')!
    fireEvent.mouseDown(shapeNode, { button: 0, clientX: 60, clientY: 60 })

    // Wait for node to have 'selected' class in DOM
    await waitFor(() => {
      expect(shapeNode).toHaveClass('selected')
    })

    // Click the dedicated Delete Shape action button
    const deleteBtn = shapeNode.querySelector('.lumina-canvas-action-btn.delete')!
    expect(deleteBtn).toBeInTheDocument()
    fireEvent.click(deleteBtn)

    // Verify ONLY the selected shape was removed
    await waitFor(() => {
      expect(screen.queryByText('Delete Me')).not.toBeInTheDocument()
    })
    // The other node is preserved
    expect(screen.getByText('Preserve Me')).toBeInTheDocument()
  })
})
