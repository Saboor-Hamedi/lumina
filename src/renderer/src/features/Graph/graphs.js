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

  // Removed ring/glow completely for a minimal look as requested
  // The rest of the graph will dim, which is enough to highlight the node

  // Dimming logic
  if (isSearchDimmed && !isHovered && !isActive) {
    ctx.globalAlpha = 0.05
  } else if (isNeighborDimmed) {
    ctx.globalAlpha = 0.15
  }

  ctx.beginPath()
  ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false)
  ctx.fillStyle = color
  ctx.fill()
  
  ctx.globalAlpha = 1.0

  // Draw text (Optimized: fillText is slow, so only render if required)
  if (showText && !isSearchDimmed) {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'var(--text-main, #d4d4d4)'

    // Dynamic text sizing based on zoom level (globalScale)
    // By dividing by globalScale, the text remains a consistent physical size on the screen
    // Keep size static on hover as requested
    const baseSize = 8
    const fontSize = baseSize / globalScale
    ctx.font = `${fontSize}px Inter, sans-serif`
    
    // Offset the text below the node
    const offset = 6 / globalScale
    ctx.fillText(label, node.x, node.y + r + offset)
  }
}
