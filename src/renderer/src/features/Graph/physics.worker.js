import { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide, forceX, forceY } from 'd3-force'

let simulation
let nodes = []
let links = []
let positionsBuffer
let isBufferLocked = false

self.onmessage = (e) => {
  const { type, payload } = e.data

  if (type === 'INIT') {
    nodes = payload.nodes.map((n) => ({ ...n }))
    links = payload.links.map((l) => ({
      source: typeof l.source === 'object' ? l.source.id : l.source,
      target: typeof l.target === 'object' ? l.target.id : l.target
    }))

    if (simulation) simulation.stop()

    // Pure Physics based precisely on guide.md
    simulation = forceSimulation(nodes)
      .force('charge', forceManyBody()
          .strength(-800 * (payload.settings?.repelForce || 1))
          .distanceMax(1000)
      )
      .force(
        'link',
        forceLink(links)
          .id((d) => d.id)
          .distance((link) => 30 + ((link.weight || 1) * 2))
          .strength(0.1 * (payload.settings?.linkForce || 1))
      )
      .force('collide', forceCollide().radius(15).iterations(1))
      .force('x', forceX(0).strength(0.05))
      .force('y', forceY(0).strength(0.05))
      .alphaDecay(0.05)
      
    // Allocate ONCE when the worker starts
    positionsBuffer = new Float32Array(nodes.length * 2)
    isBufferLocked = false

    simulation.on('tick', () => {
      // High performance transfer using Ping-Pong Float32Array
      if (isBufferLocked) return // Skip tick if main thread hasn't returned buffer
      
      isBufferLocked = true
      
      for (let i = 0; i < nodes.length; i++) {
        positionsBuffer[i * 2] = nodes[i].x || 0
        positionsBuffer[i * 2 + 1] = nodes[i].y || 0
      }

      self.postMessage({ type: 'TICK', positions: positionsBuffer }, [positionsBuffer.buffer])
    })
  } else if (type === 'UPDATE_SETTINGS') {
    if (!simulation) return
    simulation.force('charge').strength(-800 * (payload.settings?.repelForce || 1))
    simulation.force('link').strength(0.1 * (payload.settings?.linkForce || 1))
    simulation.alpha(1).restart()
  } else if (type === 'RELEASE_BUFFER') {
    // Main thread has finished reading and returned ownership of the exact same memory!
    if (payload && payload.buffer) {
      positionsBuffer = new Float32Array(payload.buffer)
      isBufferLocked = false
    }
  } else if (type === 'DRAG_START') {
    if (simulation) simulation.alphaTarget(0.3).restart()
  } else if (type === 'DRAG') {
    const node = nodes.find((n) => n.id === payload.id)
    if (node) {
      node.fx = payload.x
      node.fy = payload.y
      node.x = payload.x
      node.y = payload.y
    }
  } else if (type === 'DRAG_END') {
    const node = nodes.find((n) => n.id === payload.id)
    if (node) {
      node.fx = null
      node.fy = null
      simulation.alphaTarget(0)
    }
  } else if (type === 'REHEAT') {
    if (simulation) simulation.alpha(1).restart()
  }
}
