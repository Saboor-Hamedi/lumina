import { forceSimulation, forceRadial, forceManyBody, forceCollide, forceX, forceY, forceLink } from 'd3-force'

let simulation
let nodes = []
let links = []
let isSpinning = false

self.onmessage = (e) => {
  const { type, payload } = e.data

  if (type === 'INIT') {
    nodes = payload.nodes.map(n => ({ ...n }))
    links = payload.links.map(l => ({ 
      source: typeof l.source === 'object' ? l.source.id : l.source, 
      target: typeof l.target === 'object' ? l.target.id : l.target 
    }))

    if (simulation) simulation.stop()

    simulation = forceSimulation(nodes)
      // Extremely gentle pull to center so it doesn't crush the graph into a honeycomb
      .force('custom_x', forceX(0).strength(payload.settings.centerForce * 0.02))
      .force('custom_y', forceY(0).strength(payload.settings.centerForce * 0.02))
      // Drastically lower the center gravity
      .force('custom_x', forceX(0).strength(payload.settings.centerForce * 0.005))
      .force('custom_y', forceY(0).strength(payload.settings.centerForce * 0.005))
      // Strong repel to create space and branches
      .force('custom_charge', forceManyBody().strength(-2000 * payload.settings.repelForce).distanceMax(4000))
      // Prevent overlapping
      .force('custom_collide', forceCollide()
        .radius(d => {
          const baseR = d.val ? Math.max(2, Math.sqrt(d.val) * 2.5) : 2
          return baseR * payload.settings.sizeMult + 10
        })
        .strength(0.8)
        .iterations(1)
      )
      // Increase link distance so the honeycomb packing spreads out into branches
      .force('link', forceLink(links).id(d => d.id).distance(250).strength(payload.settings.linkForce * 2))
      .alphaDecay(isSpinning ? 0.005 : 0.02)
      .velocityDecay(0.3)
      .on('tick', () => {
        if (isSpinning) {
          // Extremely gentle swirl so it doesn't overpower the branches
          for (let i = 0, n = nodes.length; i < n; ++i) {
            const node = nodes[i]
            const dx = node.x || 0
            const dy = node.y || 0
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist > 0) {
              node.vx += (-dy / dist) * 0.2 * simulation.alpha()
              node.vy += (dx / dist) * 0.2 * simulation.alpha()
            }
          }
        }
        
        const positions = new Float32Array(nodes.length * 2)
        for (let i = 0; i < nodes.length; i++) {
          positions[i * 2] = nodes[i].x
          positions[i * 2 + 1] = nodes[i].y
        }
        
        self.postMessage({ type: 'TICK', positions }, [positions.buffer])
      })
  } else if (type === 'UPDATE_SETTINGS') {
    if (!simulation) return
    isSpinning = payload.settings.isSpinning
    simulation
      .force('custom_x').strength(payload.settings.centerForce * 0.005)
    simulation
      .force('custom_y').strength(payload.settings.centerForce * 0.005)
    
    simulation.force('custom_charge').strength(-2000 * payload.settings.repelForce)
    simulation.force('link').strength(payload.settings.linkForce * 2)
    simulation.force('custom_collide').radius(d => {
      const baseR = d.val ? Math.max(2, Math.sqrt(d.val) * 2.5) : 2
      return baseR * payload.settings.sizeMult + 10
    })
    
    simulation.alphaDecay(isSpinning ? 0.005 : 0.02)
    simulation.alpha(1).restart()
  } else if (type === 'DRAG') {
    const node = nodes.find(n => n.id === payload.id)
    if (node) {
      node.fx = payload.x
      node.fy = payload.y
      node.x = payload.x
      node.y = payload.y
      simulation.alphaTarget(0.3).restart()
    }
  } else if (type === 'DRAG_END') {
    const node = nodes.find(n => n.id === payload.id)
    if (node) {
      node.fx = null
      node.fy = null
      simulation.alphaTarget(0)
    }
  } else if (type === 'REHEAT') {
    if (simulation) simulation.alpha(1).restart()
  }
}
