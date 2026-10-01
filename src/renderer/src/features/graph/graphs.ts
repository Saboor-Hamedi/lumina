export interface GraphNode {
  id: string
  name?: string
  title?: string
  snippetId?: string
  group?: 'ghost' | 'tag' | 'mention' | string
  primaryTag?: string
  linkCount?: number
  val?: number
  ageFactor?: number
  x?: number
  y?: number
  z?: number
  vx?: number
  vy?: number
  vz?: number
  fx?: number | null
  fy?: number | null
  fz?: number | null
  color?: string
  [key: string]: any
}

export const stringToColor = (str: string): string => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const h = Math.abs(hash) % 360
  return `hsl(${h}, 70%, 55%)`
}

export const getNodeColor = (
  node: GraphNode,
  selectedSnippetId?: string,
  defaultNodeColor = '#40bafa'
): string => {
  if (selectedSnippetId && node.snippetId === selectedSnippetId) return '#ffffff'
  if (node.group === 'ghost') return 'rgba(150,150,150,0.3)'
  if (node.group === 'tag') return '#14b8a6' // Teal for Tags
  if (node.group === 'mention') return '#ff79c6' // Pink/Accent for Mentions

  // Dynamic color by category/tag
  if (node.primaryTag) return stringToColor(node.primaryTag)

  return defaultNodeColor
}

export const drawNode = (
  ctx: CanvasRenderingContext2D,
  node: GraphNode,
  r: number,
  color: string,
  isActive: boolean,
  isHovered: boolean,
  isSearchMatch: boolean,
  isSearchDimmed: boolean,
  isNeighborDimmed: boolean,
  showText: boolean,
  globalScale = 1
): void => {
  const label = (node.id || '').replace(/[*"']/g, '')

  // Dimming logic
  if (isSearchDimmed && !isHovered && !isActive) {
    ctx.globalAlpha = 0.05
  } else if (isNeighborDimmed) {
    ctx.globalAlpha = 0.15
  }

  // Track exact node render time
  const start = performance.now()

  const nx = typeof node.x === 'number' ? node.x : 0
  const ny = typeof node.y === 'number' ? node.y : 0

  ctx.beginPath()
  ctx.arc(nx, ny, r, 0, 2 * Math.PI, false)
  ctx.fillStyle = color
  ctx.fill()

  ctx.globalAlpha = 1.0

  const isDragging = Boolean((window as any)._luminaIsDragging)

  // Draw text only when needed (fillText is expensive — skip during drag and when zoomed out)
  if (!isDragging && showText && (isHovered || isActive || isSearchMatch || globalScale > 1.5)) {
    // Font size relative to the canvas coordinate system, so it scales naturally with zoom
    const fontSize = 4
    ctx.font = `${fontSize}px Inter, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    // Subtle text shadow for readability on any background
    ctx.shadowColor = 'rgba(0,0,0,0.8)'
    ctx.shadowBlur = 2 / globalScale // Scale the blur down when zoomed in

    // Fade in text gracefully as user zooms in
    const textAlpha = isHovered || isActive ? 1 : Math.min(1, (globalScale - 1.2) / 0.8)
    ctx.globalAlpha = textAlpha

    ctx.fillStyle = isActive ? '#ffffff' : 'var(--text-main, #d4d4d4)'
    ctx.fillText(label, nx, ny + r + 2)

    ctx.shadowBlur = 0
    ctx.globalAlpha = 1.0
  }

  if ((window as any)._luminaNodesRenderTime !== undefined) {
    ;(window as any)._luminaNodesRenderTime += performance.now() - start
  }
}
