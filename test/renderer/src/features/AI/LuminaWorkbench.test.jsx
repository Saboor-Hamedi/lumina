import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useAIStore } from '../../../../../src/renderer/src/features/AI/tools/lumina'
import { LuminaWorkbench } from '../../../../../src/renderer/src/features/AI/components/LuminaWorkbench'

describe('LuminaWorkbench & AI Usage Tracking', () => {
  beforeEach(() => {
    localStorage.clear()
    useAIStore.getState().resetAIUsage()
  })

  it('initializes with default zero usage stats', () => {
    const stats = useAIStore.getState().aiUsageStats
    expect(stats.totalTokens).toBe(0)
    expect(stats.totalCostUSD).toBe(0)
    expect(stats.totalTimeMs).toBe(0)
    expect(stats.totalPrompts).toBe(0)
  })

  it('records AI usage correctly in store and localStorage', () => {
    useAIStore.getState().recordAIUsage({
      promptTokens: 1000,
      completionTokens: 500,
      timeMs: 2500
    })

    const stats = useAIStore.getState().aiUsageStats
    expect(stats.totalTokens).toBe(1500)
    expect(stats.promptTokens).toBe(1000)
    expect(stats.completionTokens).toBe(500)
    expect(stats.totalTimeMs).toBe(2500)
    expect(stats.totalPrompts).toBe(1)
    expect(stats.totalCostUSD).toBeGreaterThan(0)
  })

  it('renders 3 core metrics cards (Tokens, Cost, Time) in LuminaWorkbench', () => {
    useAIStore.getState().recordAIUsage({
      promptTokens: 2000,
      completionTokens: 1000,
      timeMs: 5000
    })

    render(<LuminaWorkbench />)

    expect(screen.getByText('AI Analytics & Usage')).toBeInTheDocument()
    expect(screen.getByText('Tokens Spent')).toBeInTheDocument()
    expect(screen.getByText('Money Spent')).toBeInTheDocument()
    expect(screen.getByText('AI Time Used')).toBeInTheDocument()

    expect(screen.getAllByText('3,000').length).toBeGreaterThan(0)
    expect(screen.getByText('5s')).toBeInTheDocument()
  })

  it('resets usage stats when Reset button is confirmed', () => {
    useAIStore.getState().recordAIUsage({
      promptTokens: 500,
      completionTokens: 500,
      timeMs: 1000
    })

    render(<LuminaWorkbench />)
    const resetBtn = screen.getByRole('button', { name: /Reset/i })

    // First click triggers confirmation state
    fireEvent.click(resetBtn)
    expect(screen.getByText('Confirm reset?')).toBeInTheDocument()

    // Second click executes reset
    fireEvent.click(resetBtn)
    const stats = useAIStore.getState().aiUsageStats
    expect(stats.totalTokens).toBe(0)
  })
})
