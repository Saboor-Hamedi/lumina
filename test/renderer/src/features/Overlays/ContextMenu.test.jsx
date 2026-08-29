import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ContextMenu from '../../../../../src/renderer/src/features/Overlays/ContextMenu'

describe('ContextMenu', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseOptions = [
    { id: 'open', label: 'Open', onClick: vi.fn() },
    { id: 'div', type: 'divider' },
    { id: 'del', label: 'Delete', danger: true, onClick: vi.fn() }
  ]

  it('renders menu options as portal into body', () => {
    render(<ContextMenu x={100} y={100} options={baseOptions} onClose={onClose} />)
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
    expect(document.body.querySelector('.context-menu')).toBeInTheDocument()
  })

  it('closes on Escape key', () => {
    render(<ContextMenu x={100} y={100} options={baseOptions} onClose={onClose} />)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(onClose).toHaveBeenCalled()
  })

  it('closes on global mousedown', () => {
    render(<ContextMenu x={100} y={100} options={baseOptions} onClose={onClose} />)
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders shortcuts and active check', () => {
    const options = [
      { id: 'o', label: 'Open', shortcut: 'Ctrl+O', onClick: vi.fn() },
      { id: 'a', label: 'Active', isActive: () => true, onClick: vi.fn() }
    ]
    render(<ContextMenu x={10} y={10} options={options} onClose={onClose} />)
    expect(screen.getByText('Ctrl+O')).toBeInTheDocument()
  })

  it('calls option onClick and closes', () => {
    const onClick = vi.fn()
    const options = [{ id: 'o', label: 'Open', onClick }]
    render(<ContextMenu x={10} y={10} options={options} onClose={onClose} />)
    fireEvent.click(screen.getByText('Open'))
    expect(onClick).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('renders submenu children on hover', () => {
    const options = [
      {
        id: 'parent',
        label: 'Background',
        children: [{ id: 'blue', label: 'Blue', onClick: vi.fn() }]
      }
    ]
    render(<ContextMenu x={10} y={10} options={options} onClose={onClose} />)
    fireEvent.mouseEnter(screen.getByText('Background'))
    expect(screen.getByText('Blue')).toBeInTheDocument()
  })

  it('does not close when clicking inside the menu', () => {
    render(<ContextMenu x={10} y={10} options={baseOptions} onClose={onClose} />)
    fireEvent.mouseDown(screen.getByText('Open'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
