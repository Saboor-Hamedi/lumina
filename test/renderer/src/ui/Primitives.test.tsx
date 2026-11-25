import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React, { useRef, useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Plus } from 'lucide-react'

vi.mock('../../../../src/renderer/src/components/update/UpdateButton', () => ({
  UpdateButton: () => <div data-testid="mock-update-details" />,
  default: () => <div data-testid="mock-update-details" />
}))
vi.mock('../../../../src/renderer/src/features/theme/AccentColor', () => ({
  default: () => null
}))
vi.mock('../../../../src/renderer/src/features/calender', () => ({
  CalendarToggle: () => <div data-testid="mock-calendar-toggle" />
}))

import { Button, IconButton, Field, SearchInput, Dialog, Popover, Menu } from '../../../../src/renderer/src/ui'
import TitleBar from '../../../../src/renderer/src/features/Layout/TitleBar'

describe('UI Primitives & TitleBar Chrome', () => {
  const originalApi = (window as any).api

  beforeEach(() => {
    vi.clearAllMocks()
    document.documentElement.classList.remove('is-window-resizing')
    document.documentElement.removeAttribute('data-window-maximized')
  })

  afterEach(() => {
    ;(window as any).api = originalApi
  })

  it('renders Button and IconButton variants, loading, click, and disabled states', () => {
    const onClick = vi.fn()
    const onIconClick = vi.fn()
    render(
      <div>
        <Button variant="primary" onClick={onClick}>
          Save Note
        </Button>
        <Button variant="danger" loading>
          Deleting
        </Button>
        <IconButton aria-label="Add item" active onClick={onIconClick}>
          <Plus size={12} />
        </IconButton>
      </div>
    )

    const primaryBtn = screen.getByRole('button', { name: 'Save Note' })
    expect(primaryBtn).toHaveClass('btn', 'lumina-btn', 'btn-primary', 'variant-primary')
    fireEvent.click(primaryBtn)
    expect(onClick).toHaveBeenCalledTimes(1)

    const loadingBtn = screen.getByRole('button', { name: 'Deleting' })
    expect(loadingBtn).toBeDisabled()
    expect(loadingBtn).toHaveClass('btn-danger', 'variant-danger')

    const iconBtn = screen.getByRole('button', { name: 'Add item' })
    expect(iconBtn).toHaveClass('lumina-icon-btn', 'is-active')
    fireEvent.click(iconBtn)
    expect(onIconClick).toHaveBeenCalledTimes(1)
  })

  it('supports Field and SearchInput change, clear button, and ref forwarding', () => {
    function SearchHarness() {
      const [q, setQ] = useState('')
      const inputRef = useRef<HTMLInputElement | null>(null)
      return (
        <div>
          <Field label="Title" placeholder="Enter title" error="Required" />
          <SearchInput
            ref={inputRef}
            value={q}
            onChange={setQ}
            placeholder="Search workspace..."
          />
          <button type="button" onClick={() => inputRef.current?.focus()}>
            Focus search
          </button>
        </div>
      )
    }

    render(<SearchHarness />)
    expect(screen.getByText('Required')).toBeInTheDocument()

    const searchEl = screen.getByPlaceholderText('Search workspace...')
    fireEvent.change(searchEl, { target: { value: 'architecture' } })
    expect(searchEl).toHaveValue('architecture')

    const clearBtn = screen.getByLabelText('Clear search')
    fireEvent.click(clearBtn)
    expect(searchEl).toHaveValue('')

    fireEvent.click(screen.getByRole('button', { name: 'Focus search' }))
    expect(document.activeElement).toBe(searchEl)
  })

  it('renders Dialog in portal and handles overlay click and Escape stopPropagation', () => {
    const onClose = vi.fn()
    const windowBubbleSpy = vi.fn()
    window.addEventListener('keydown', windowBubbleSpy)

    const { container } = render(
      <Dialog isOpen={true} onClose={onClose} ariaLabel="Sample dialog">
        <p>Dialog Body</p>
      </Dialog>
    )

    expect(container.firstChild).toBeNull()
    expect(screen.getByText('Dialog Body')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(windowBubbleSpy).not.toHaveBeenCalled()

    const overlay = screen.getByRole('dialog')
    fireEvent.click(overlay)
    expect(onClose).toHaveBeenCalledTimes(2)

    window.removeEventListener('keydown', windowBubbleSpy)
  })

  it('renders Popover and Menu, closes on item click and Escape', () => {
    const onClose = vi.fn()
    const onAction = vi.fn()

    render(
      <Popover isOpen={true} onClose={onClose} position={{ top: 20, left: 20 }} role="menu">
        <Menu
          onClose={onClose}
          items={[
            { label: 'Rename', shortcut: 'F2', onClick: onAction },
            { type: 'divider' },
            { label: 'Delete', danger: true, disabled: true }
          ]}
        />
      </Popover>
    )

    fireEvent.click(screen.getByRole('menuitem', { name: /Rename/i }))
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('renders TitleBar without Lumina app-logo icon and freezes resize transitions on maximize', () => {
    const toggleMaximize = vi.fn()
    ;(window as any).api = {
      minimize: vi.fn(),
      toggleMaximize,
      closeWindow: vi.fn(),
      isMaximized: vi.fn().mockResolvedValue(false),
      onMaximizedChange: vi.fn(() => () => {})
    }

    const { container } = render(<TitleBar />)
    expect(container.querySelector('.app-logo')).toBeNull()
    expect(screen.getByText('Ask anything or Search...')).toBeInTheDocument()

    const maxBtn = screen.getByRole('button', { name: 'Maximize' })
    fireEvent.click(maxBtn)

    expect(toggleMaximize).toHaveBeenCalledTimes(1)
    expect(document.documentElement.classList.contains('is-window-resizing')).toBe(true)
  })
})
