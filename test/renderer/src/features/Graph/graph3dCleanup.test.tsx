import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  dispose: vi.fn(),
  forceContextLoss: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  exposeForceContextLoss: { value: true }
}))

vi.mock('react-force-graph-3d', async () => {
  const React = await import('react')
  return {
    default: React.forwardRef((_props: any, ref: any) => {
      const forces: Record<string, any> = {}
      const chainable = { strength: () => chainable, distance: () => chainable, iterations: () => chainable }
      React.useImperativeHandle(ref, () => ({
        d3Force: (name: string, force?: any) => {
          if (force !== undefined) {
            forces[name] = force
            return undefined
          }
          return forces[name] ?? chainable
        },
        d3ReheatSimulation: vi.fn(),
        cameraPosition: vi.fn(),
        centerAt: vi.fn(),
        zoom: vi.fn(),
        renderer: () => ({
          dispose: mocks.dispose,
          forceContextLoss: mocks.exposeForceContextLoss.value ? mocks.forceContextLoss : undefined,
          domElement: {
            addEventListener: mocks.addEventListener,
            removeEventListener: mocks.removeEventListener
          }
        })
      }))
      return React.createElement('div', { 'data-testid': 'fg3d-mock' })
    })
  }
})

vi.mock('d3-force', () => ({
  forceX: () => ({ strength: vi.fn() }),
  forceY: () => ({ strength: vi.fn() })
}))

vi.mock('d3-force-3d', () => ({
  forceCollide: () => ({ strength: () => ({ radius: () => ({ iterations: vi.fn() }) }) })
}))

import Graph3D from '@renderer/features/graph/3d/Graph3D'
import { useSettingsStore } from '@renderer/core/store/SettingStore'

describe('Graph3D WebGL resource cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.exposeForceContextLoss.value = true
    useSettingsStore.setState({
      settings: { graphNodeSize: 1.5, graphCenterForce: 0.05, graphRepelForce: 0.3, graphLinkForce: 0.05 }
    } as any)
  })

  it('keeps the live WebGL context untouched while the graph is mounted', () => {
    render(<Graph3D graphData={{ nodes: [], links: [] }} />)
    expect(mocks.dispose).not.toHaveBeenCalled()
    expect(mocks.forceContextLoss).not.toHaveBeenCalled()
  })

  it('disposes the renderer and force-releases the GPU context when the graph effect is torn down', () => {
    const { rerender } = render(<Graph3D graphData={{ nodes: [], links: [] }} />)

    rerender(<Graph3D graphData={{ nodes: [], links: [] }} />)

    expect(mocks.dispose).toHaveBeenCalledTimes(1)
    expect(mocks.forceContextLoss).toHaveBeenCalledTimes(1)
  })

  it('detaches the trackpad wheel listener when the graph tab is closed', () => {
    const { unmount } = render(<Graph3D graphData={{ nodes: [], links: [] }} />)
    expect(mocks.addEventListener).toHaveBeenCalledWith('wheel', expect.any(Function), {
      capture: true,
      passive: false
    })

    unmount()

    expect(mocks.removeEventListener).toHaveBeenCalledWith('wheel', expect.any(Function), {
      capture: true
    })
  })

  it('still disposes safely when forceContextLoss is unavailable', () => {
    mocks.exposeForceContextLoss.value = false
    const { rerender } = render(<Graph3D graphData={{ nodes: [], links: [] }} />)

    rerender(<Graph3D graphData={{ nodes: [], links: [] }} />)

    expect(mocks.dispose).toHaveBeenCalledTimes(1)
    expect(mocks.forceContextLoss).not.toHaveBeenCalled()
  })
})
