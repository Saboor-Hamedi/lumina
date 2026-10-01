import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  Simulation
} from 'd3-force'

let simulation: Simulation<any, any> | undefined
let nodes: any[] = []
let links: any[] = []
let positionsBuffer: Float32Array
let isBufferLocked = false

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data

  if (type === 'INIT') {
    nodes = payload.nodes.map((n: any) => ({ ...n }))
    links = payload.links.map((l: any) => ({
      source: typeof l.source === 'object' ? l.source.id : l.source,
      target: typeof l.target === 'object' ? l.target.id : l.target
    }))

    if (simulation) simulation.stop()

    const nodeCount = nodes.length
    const baseCharge = nodeCount <= 8 ? -250 : -800
    const centerStrength = nodeCount <= 8 ? 0.15 : (payload.settings?.centerForce ?? 0.05)

    simulation = forceSimulation(nodes)
      .force(
        'charge',
        forceManyBody()
          .strength(baseCharge * (payload.settings?.repelForce || 1))
          .distanceMax(1000)
      )
      .force(
        'link',
        forceLink(links)
          .id((d: any) => d.id)
          .distance((link: any) => (nodeCount <= 8 ? 60 : 30) + ((link.weight || 1) * 2))
          .strength(0.1 * (payload.settings?.linkForce || 1))
      )
      .force('collide', forceCollide().radius(15).iterations(1))
      .force('center', forceCenter(0, 0))
      .force('x', forceX(0).strength(centerStrength))
      .force('y', forceY(0).strength(centerStrength))
      .alphaDecay(0.05)

    positionsBuffer = new Float32Array(nodes.length * 2)
    isBufferLocked = false

    simulation.on('tick', () => {
      if (isBufferLocked) return
      isBufferLocked = true

      for (let i = 0; i < nodes.length; i++) {
        positionsBuffer[i * 2] = nodes[i].x || 0
        positionsBuffer[i * 2 + 1] = nodes[i].y || 0
      }

      self.postMessage({ type: 'TICK', positions: positionsBuffer }, [positionsBuffer.buffer])
    })
  } else if (type === 'UPDATE_SETTINGS') {
    if (!simulation) return
    const nodeCount = nodes.length
    const baseCharge = nodeCount <= 8 ? -250 : -800
    const centerStrength = nodeCount <= 8 ? 0.15 : (payload.settings?.centerForce ?? 0.05)
    ;(simulation.force('charge') as any)?.strength(baseCharge * (payload.settings?.repelForce || 1))
    ;(simulation.force('link') as any)?.strength(0.1 * (payload.settings?.linkForce || 1))
    ;(simulation.force('x') as any)?.strength(centerStrength)
    ;(simulation.force('y') as any)?.strength(centerStrength)
    simulation.alpha(1).restart()
  } else if (type === 'RELEASE_BUFFER') {
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
      if (payload.isCentral) {
        node.fx = null
        node.fy = null
        if (simulation) {
          simulation.alphaTarget(0)
          simulation.alpha(0.6).restart()
        }
      } else {
        node.fx = payload.x !== undefined ? payload.x : node.x
        node.fy = payload.y !== undefined ? payload.y : node.y
        if (simulation) {
          simulation.alphaTarget(0)
          simulation.alpha(0.2).restart()
        }
      }
    }
  } else if (type === 'RESET_POSITIONS') {
    nodes.forEach((n) => {
      n.fx = null
      n.fy = null
    })
    if (simulation) simulation.alpha(1).restart()
  } else if (type === 'REHEAT') {
    if (simulation) simulation.alpha(1).restart()
  }
}
