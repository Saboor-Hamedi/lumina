import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock d3-force simulation
const simulationFns = {
  stop: vi.fn(),
  on: vi.fn(),
  force: vi.fn(),
  alpha: vi.fn(),
  alphaTarget: vi.fn(),
  restart: vi.fn(),
  alphaDecay: vi.fn()
}

const chainableForce = (fnMap = {}) => {
  const obj = {}
  for (const [key, fn] of Object.entries(fnMap)) {
    obj[key] = vi.fn(() => obj)
  }
  obj._fnMap = fnMap
  return obj
}

const forceFunctions = {
  strength: vi.fn(),
  distanceMax: vi.fn(),
  distance: vi.fn(),
  id: vi.fn(),
  radius: vi.fn(),
  iterations: vi.fn()
}

vi.mock('d3-force', () => ({
  forceSimulation: vi.fn(() => {
    simulationFns.force.mockReturnValue(simulationFns)
    simulationFns.alphaDecay.mockReturnValue(simulationFns)
    simulationFns.alpha.mockReturnValue(simulationFns)
    simulationFns.alphaTarget.mockReturnValue(simulationFns)
    simulationFns.restart.mockReturnValue(simulationFns)
    simulationFns.stop.mockReturnValue(simulationFns)
    simulationFns.on.mockImplementation((evt, cb) => {
      if (evt === 'tick') simulationFns._tick = cb
      return simulationFns
    })
    return simulationFns
  }),
  forceManyBody: vi.fn(() =>
    chainableForce({ strength: forceFunctions.strength, distanceMax: forceFunctions.distanceMax })
  ),
  forceLink: vi.fn(() =>
    chainableForce({
      id: forceFunctions.id,
      distance: forceFunctions.distance,
      strength: forceFunctions.strength
    })
  ),
  forceCollide: vi.fn(() =>
    chainableForce({ radius: forceFunctions.radius, iterations: forceFunctions.iterations })
  ),
  forceCenter: vi.fn(),
  forceX: vi.fn(() => chainableForce({ strength: forceFunctions.strength })),
  forceY: vi.fn(() => chainableForce({ strength: forceFunctions.strength }))
}))

// Set up a fake worker-like self
const postMessage = vi.fn()
const selfMock = {
  postMessage
}
globalThis.self = selfMock

let workerModule

async function loadWorker() {
  const mod = await import(
    '../../../../../src/renderer/src/features/Graph/physics.worker'
  )
  return mod
}

describe('physics.worker', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    simulationFns.force.mockReturnValue(simulationFns)
    // Re-import to get fresh module-level state (simulation/nodes/positionsBuffer).
    // The worker assigns self.onmessage (self === globalThis.self === selfMock)
    workerModule = await loadWorker()
  })

  const sendMessage = (type, payload) => {
    selfMock.onmessage({ data: { type, payload } })
  }

  it('registers an onmessage handler', () => {
    expect(typeof selfMock.onmessage).toBe('function')
  })

  it('INIT creates a simulation and stops the previous one', () => {
    const nodes = [
      { id: 'a', x: 1, y: 2 },
      { id: 'b', x: 3, y: 4 }
    ]
    const links = [
      { source: { id: 'a' }, target: 'b' },
      { source: 'a', target: { id: 'b' } }
    ]

    // First INIT: no previous simulation, stop() not called yet
    sendMessage('INIT', { nodes, links, settings: { repelForce: 1.5, linkForce: 0.8 } })

    expect(simulationFns.force).toHaveBeenCalledWith('charge', expect.any(Object))
    expect(simulationFns.force).toHaveBeenCalledWith('link', expect.any(Object))
    expect(simulationFns.force).toHaveBeenCalledWith('collide', expect.any(Object))
    expect(simulationFns.on).toHaveBeenCalledWith('tick', expect.any(Function))

    // Second INIT: stops the previous simulation
    sendMessage('INIT', { nodes, links, settings: {} })
    expect(simulationFns.stop).toHaveBeenCalled()
  })

  it('tick handler posts positions buffer and locks it', () => {
    const nodes = [
      { id: 'a', x: 1, y: 2 },
      { id: 'b', x: 3, y: 4 }
    ]
    sendMessage('INIT', { nodes, links: [], settings: {} })

    expect(simulationFns._tick).toBeTypeOf('function')

    simulationFns._tick()
    expect(postMessage).toHaveBeenCalledWith(
      { type: 'TICK', positions: expect.any(Float32Array) },
      [expect.any(ArrayBuffer)]
    )
  })

  it('UPDATE_SETTINGS updates forces and restarts', () => {
    sendMessage('INIT', { nodes: [], links: [], settings: {} })
    postMessage.mockClear()

    // simulation.force('charge') must return a chainable object with .strength()
    const chargeForce = chainableForce({ strength: forceFunctions.strength })
    simulationFns.force.mockReturnValue(chargeForce)
    simulationFns.alpha.mockReturnValue(simulationFns)
    simulationFns.restart.mockReturnValue(simulationFns)

    sendMessage('UPDATE_SETTINGS', { settings: { repelForce: 2, linkForce: 0.5 } })

    expect(simulationFns.alpha).toHaveBeenCalledWith(1)
    expect(simulationFns.restart).toHaveBeenCalled()
  })

  it('DRAG sets node fx/fy and x/y', () => {
    const nodes = [{ id: 'a', x: 0, y: 0 }]
    sendMessage('INIT', { nodes, links: [], settings: {} })

    sendMessage('DRAG', { id: 'a', x: 10, y: 20 })

    // Access internal node via simulate a tick to check mutation
    // We can instead verify by forcing a tick and reading positions buffer
    simulationFns._tick()
    const lastCall = postMessage.mock.calls[postMessage.mock.calls.length - 1]
    const positions = lastCall[0].positions
    expect(positions[0]).toBe(10)
    expect(positions[1]).toBe(20)
  })

  it('DRAG_END clears fx/fy and resets alphaTarget', () => {
    sendMessage('INIT', { nodes: [{ id: 'a' }], links: [], settings: {} })

    sendMessage('DRAG_START', {})
    expect(simulationFns.alphaTarget).toHaveBeenCalledWith(0.3)
    expect(simulationFns.restart).toHaveBeenCalled()

    postMessage.mockClear()
    sendMessage('DRAG_END', { id: 'a' })
    expect(simulationFns.alphaTarget).toHaveBeenCalledWith(0)
  })

  it('REHEAT restarts the simulation', () => {
    sendMessage('INIT', { nodes: [], links: [], settings: {} })
    postMessage.mockClear()

    sendMessage('REHEAT', {})
    expect(simulationFns.alpha).toHaveBeenCalledWith(1)
    expect(simulationFns.restart).toHaveBeenCalled()
  })

  it('RELEASE_BUFFER replaces the buffer and unlocks it', () => {
    const nodes = [
      { id: 'a', x: 1, y: 2 },
      { id: 'b', x: 3, y: 4 }
    ]
    sendMessage('INIT', { nodes, links: [], settings: {} })
    postMessage.mockClear()

    // After RELEASE_BUFFER the worker unwraps the returned memory; a subsequent
    // tick writes node positions into it and posts again.
    const buffer = new Float32Array([5, 6, 7, 8])
    sendMessage('RELEASE_BUFFER', { buffer: buffer.buffer })

    simulationFns._tick()
    const lastCall = postMessage.mock.calls[postMessage.mock.calls.length - 1]
    // Tick overwrites buffer contents from current node positions
    expect(lastCall[0].positions[0]).toBe(1)
    expect(lastCall[0].positions[1]).toBe(2)
  })
})
