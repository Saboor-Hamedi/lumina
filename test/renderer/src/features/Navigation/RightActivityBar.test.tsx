import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import RightActivityBar from '../../../../../src/renderer/src/features/Navigation/RightActivityBar'

describe('RightActivityBar', () => {
  it('renders Details, Outline, and Backlinks buttons', () => {
    render(
      <RightActivityBar
        isRightSidebarOpen={false}
        activeTab="details"
        onSelectTab={vi.fn()}
      />
    )

    expect(screen.getByTestId('right-activity-bar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Note Details' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Note Outline' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Backlinks' })).toBeInTheDocument()
  })

  it('marks active tab only when right sidebar is open', () => {
    const { rerender } = render(
      <RightActivityBar
        isRightSidebarOpen={false}
        activeTab="outline"
        onSelectTab={vi.fn()}
      />
    )

    const outlineBtn = screen.getByRole('button', { name: 'Note Outline' })
    expect(outlineBtn).not.toHaveClass('active')
    expect(outlineBtn).toHaveAttribute('aria-pressed', 'false')

    rerender(
      <RightActivityBar
        isRightSidebarOpen={true}
        activeTab="outline"
        onSelectTab={vi.fn()}
      />
    )

    expect(outlineBtn).toHaveClass('active')
    expect(outlineBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onSelectTab with clicked tab id', () => {
    const onSelectTab = vi.fn()
    render(
      <RightActivityBar
        isRightSidebarOpen={true}
        activeTab="details"
        onSelectTab={onSelectTab}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Note Outline' }))
    expect(onSelectTab).toHaveBeenCalledWith('outline')

    fireEvent.click(screen.getByRole('button', { name: 'Backlinks' }))
    expect(onSelectTab).toHaveBeenCalledWith('backlinks')
  })

  it('applies zen-hidden class when isZenHidden is true', () => {
    render(
      <RightActivityBar
        isRightSidebarOpen={false}
        activeTab="details"
        onSelectTab={vi.fn()}
        isZenHidden={true}
      />
    )

    expect(screen.getByTestId('right-activity-bar')).toHaveClass('zen-hidden')
  })
})
