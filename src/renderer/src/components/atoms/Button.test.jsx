import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock CSS import before importing Button
vi.mock('./Button.css', () => ({}))
vi.mock('../../assets/button-style.css', () => ({}))

import { Button } from './Button'

describe('Button Component', () => {
  it('renders with children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('applies base variant by default', () => {
    const { container } = render(<Button>Test</Button>)
    const button = container.querySelector('button')
    expect(button).toHaveClass('btn')
    expect(button).not.toHaveClass('btn-primary')
  })

  it('applies primary variant when specified', () => {
    const { container } = render(<Button variant="primary">Test</Button>)
    const button = container.querySelector('button')
    expect(button).toHaveClass('btn', 'btn-primary')
  })

  it('applies custom className', () => {
    const { container } = render(<Button className="custom-class">Test</Button>)
    const button = container.querySelector('button')
    expect(button).toHaveClass('btn', 'custom-class')
  })

  it('handles click events', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()
    render(<Button onClick={handleClick}>Click me</Button>)
    
    await user.click(screen.getByText('Click me'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('passes through other props', () => {
    render(<Button data-testid="test-button" disabled>Test</Button>)
    const button = screen.getByTestId('test-button')
    expect(button).toBeDisabled()
  })
})
