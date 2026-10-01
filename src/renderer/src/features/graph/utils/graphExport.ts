/**
 * ============================================================================
 * Graph Export & Position Persistence Utilities (`graphExport.ts`)
 * ============================================================================
 * Enables:
 *  1. High-resolution PNG export (with crisp retina scaling & theme background)
 *  2. Scalable Vector Graphics (SVG) export with nodes, halos, links, & labels
 *  3. Position persistence: saves custom dragged node coordinates to localStorage
 * ============================================================================
 */

export interface SavedNodePosition {
  x: number
  y: number
}

const STORAGE_KEY = 'lumina_graph_node_positions'

/**
 * Loads persisted node positions from localStorage.
 */
export function loadNodePositions(): Record<string, SavedNodePosition> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch (err) {
    console.warn('[graphExport] Failed to parse saved node positions:', err)
    return {}
  }
}

/**
 * Saves node coordinates to localStorage with a debounce-friendly payload.
 */
export function saveNodePosition(nodeId: string, x: number, y: number): void {
  if (typeof localStorage === 'undefined' || !nodeId) return
  try {
    const current = loadNodePositions()
    current[nodeId] = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch (err) {
    console.warn('[graphExport] Failed to save node position:', err)
  }
}

/**
 * Saves multiple node coordinates at once.
 */
export function saveAllNodePositions(nodes: Array<{ id: string; x?: number; y?: number }>): void {
  if (typeof localStorage === 'undefined' || !nodes?.length) return
  try {
    const current = loadNodePositions()
    for (const n of nodes) {
      if (n.id && typeof n.x === 'number' && typeof n.y === 'number') {
        current[n.id] = { x: Math.round(n.x * 10) / 10, y: Math.round(n.y * 10) / 10 }
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch (err) {
    console.warn('[graphExport] Failed to save node positions:', err)
  }
}

/**
 * Clears all custom pinned positions to return to default force-directed physics.
 */
export function clearNodePositions(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (err) {
    console.warn('[graphExport] Failed to clear node positions:', err)
  }
}

/**
 * Exports the currently rendered graph canvas as a high-resolution PNG image.
 */
export async function exportGraphAsPNG(
  containerEl: HTMLElement | null,
  filename?: string
): Promise<boolean> {
  if (!containerEl) return false

  try {
    // Locate the canvas rendered by ForceGraph2D or ForceGraph3D
    const canvas = containerEl.querySelector('canvas')
    if (!canvas) {
      throw new Error('Canvas element not found in graph container')
    }

    // Determine current theme background
    let bgColor = '#0b0d12'
    if (typeof document !== 'undefined') {
      const computed = getComputedStyle(document.documentElement).getPropertyValue('--bg-editor').trim()
      if (computed) bgColor = computed
    }

    // Create an offscreen composite canvas to draw background + graph
    const width = canvas.width
    const height = canvas.height
    const offscreen = document.createElement('canvas')
    offscreen.width = width
    offscreen.height = height
    const ctx = offscreen.getContext('2d')
    if (!ctx) return false

    // Paint solid theme background
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, width, height)

    // Draw the graph canvas onto the background
    ctx.drawImage(canvas, 0, 0)

    // Trigger download
    const dataUrl = offscreen.toDataURL('image/png')
    const link = document.createElement('a')
    const dateStr = new Date().toISOString().slice(0, 10)
    link.download = filename || `lumina-graph-${dateStr}.png`
    link.href = dataUrl
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    return true
  } catch (err) {
    console.error('[graphExport] PNG export failed:', err)
    return false
  }
}

/**
 * Exports the 2D knowledge graph as a clean, scalable Vector SVG.
 */
export function exportGraphAsSVG(
  graphData: { nodes?: any[]; links?: any[] },
  width: number,
  height: number,
  themeColors?: { rgb: string; hex: string },
  filename?: string
): boolean {
  if (!graphData?.nodes?.length) return false

  try {
    const nodes = graphData.nodes
    const links = graphData.links || []

    // Calculate bounding box across all active node positions
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity

    for (const n of nodes) {
      const x = typeof n.x === 'number' ? n.x : 0
      const y = typeof n.y === 'number' ? n.y : 0
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }

    // Add margin around bounding box
    const padding = 80
    const boxX = minX === Infinity ? -width / 2 : minX - padding
    const boxY = minY === Infinity ? -height / 2 : minY - padding
    const boxWidth = maxX === -Infinity ? width : Math.max(width, maxX - minX + padding * 2)
    const boxHeight = maxY === -Infinity ? height : Math.max(height, maxY - minY + padding * 2)

    let bgColor = '#0b0d12'
    let textColor = '#f1f5f9'
    let textMuted = '#94a3b8'
    let accentHex = themeColors?.hex || '#6366f1'

    if (typeof document !== 'undefined') {
      const cs = getComputedStyle(document.documentElement)
      const bg = cs.getPropertyValue('--bg-editor').trim()
      const fg = cs.getPropertyValue('--text-main').trim()
      const muted = cs.getPropertyValue('--text-muted').trim()
      if (bg) bgColor = bg
      if (fg) textColor = fg
      if (muted) textMuted = muted
    }

    // Generate SVG string
    const svgParts: string[] = []
    svgParts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${boxX} ${boxY} ${boxWidth} ${boxHeight}" width="${boxWidth}" height="${boxHeight}">`
    )
    svgParts.push(
      `<defs>
        <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${accentHex}" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="${accentHex}" stop-opacity="0"/>
        </radialGradient>
      </defs>`
    )

    // Background rect
    svgParts.push(`<rect x="${boxX}" y="${boxY}" width="${boxWidth}" height="${boxHeight}" fill="${bgColor}" />`)

    // Links layer
    svgParts.push('<g class="links" stroke-linecap="round">')
    for (const link of links) {
      const src = typeof link.source === 'object' ? link.source : nodes.find((n: any) => n.id === link.source)
      const tgt = typeof link.target === 'object' ? link.target : nodes.find((n: any) => n.id === link.target)
      if (src && tgt && typeof src.x === 'number' && typeof tgt.x === 'number') {
        const isGhost = link.isGhost || src.group === 'ghost' || tgt.group === 'ghost'
        const opacity = isGhost ? 0.25 : 0.45
        const strokeColor = isGhost ? textMuted : accentHex
        svgParts.push(
          `<line x1="${src.x}" y1="${src.y}" x2="${tgt.x}" y2="${tgt.y}" stroke="${strokeColor}" stroke-opacity="${opacity}" stroke-width="1.2" ${isGhost ? 'stroke-dasharray="3 3"' : ''} />`
        )
      }
    }
    svgParts.push('</g>')

    // Nodes layer
    svgParts.push('<g class="nodes">')
    for (const node of nodes) {
      const x = typeof node.x === 'number' ? node.x : 0
      const y = typeof node.y === 'number' ? node.y : 0
      const baseR = node.val ? Math.min(18, Math.max(5, Math.sqrt(node.val) * 2.8)) : 5
      const fill = node.color || accentHex
      const name = (node.name || node.title || node.id || 'Untitled')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')

      // Halo
      svgParts.push(`<circle cx="${x}" cy="${y}" r="${baseR + 4}" fill="${fill}" fill-opacity="0.15" />`)
      // Core
      svgParts.push(`<circle cx="${x}" cy="${y}" r="${baseR}" fill="${fill}" stroke="${bgColor}" stroke-width="1.5" />`)
      // Label
      svgParts.push(
        `<text x="${x}" y="${y + baseR + 11}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-size="10.5" font-weight="500" fill="${textColor}" text-anchor="middle" opacity="0.9">${name}</text>`
      )
    }
    svgParts.push('</g>')

    svgParts.push('</svg>')

    const blob = new Blob([svgParts.join('\n')], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const dateStr = new Date().toISOString().slice(0, 10)
    link.download = filename || `lumina-graph-${dateStr}.svg`
    link.href = url
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    return true
  } catch (err) {
    console.error('[graphExport] SVG export failed:', err)
    return false
  }
}
