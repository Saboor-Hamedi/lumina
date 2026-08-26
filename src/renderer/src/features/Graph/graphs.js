import { usePerformanceStore } from './usePerformanceStore'

export const stringToColor = (str) => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const h = Math.abs(hash) % 360
  return `hsl(${h}, 70%, 55%)`
}

export const getNodeColor = (node, selectedSnippetId, defaultNodeColor = '#40bafa') => {
  if (selectedSnippetId && node.snippetId === selectedSnippetId) return '#ffffff'
  if (node.group === 'ghost') return 'rgba(150,150,150,0.3)'
  if (node.group === 'tag') return '#14b8a6' // Teal for Tags
  if (node.group === 'mention') return '#ff79c6' // Pink/Accent for Mentions

  // Dynamic color by category/tag
  if (node.primaryTag) return stringToColor(node.primaryTag)

  return defaultNodeColor
}

export const drawNode = (
  ctx,
  node,
  r,
  color,
  isActive,
  isHovered,
  isSearchMatch,
  isSearchDimmed,
  isNeighborDimmed,
  showText,
  globalScale = 1
) => {
  const label = (node.id || '').replace(/[*"']/g, '')

  // Dimming logic
  if (isSearchDimmed && !isHovered && !isActive) {
    ctx.globalAlpha = 0.05
  } else if (isNeighborDimmed) {
    ctx.globalAlpha = 0.15
  }

  // Track exact node render time
  const start = performance.now()

  ctx.beginPath()
  ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false)
  ctx.fillStyle = color
  ctx.fill()

  ctx.globalAlpha = 1.0

  const isDragging = window._luminaIsDragging

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
    ctx.fillText(label, node.x, node.y + r + 2)

    ctx.shadowBlur = 0
    ctx.globalAlpha = 1.0
  }

  if (window._luminaNodesRenderTime !== undefined) {
    window._luminaNodesRenderTime += (performance.now() - start)
  }
}
