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

  // Lightweight Node Highlight (Stroke instead of heavy fill)
  if (isActive || isHovered || isSearchMatch) {
    ctx.beginPath()
    ctx.arc(node.x, node.y, r + 2, 0, 2 * Math.PI, false)
    ctx.strokeStyle = isSearchMatch
      ? 'rgba(255, 255, 255, 0.8)'
      : isActive
        ? 'rgba(255, 170, 0, 0.8)'
        : 'rgba(64, 186, 250, 0.8)'
    ctx.lineWidth = 1 / globalScale // Keep stroke 1px regardless of zoom
    ctx.stroke()
  }

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
    const baseSize = isActive || isHovered ? 14 : 10
    const fontSize = baseSize / globalScale
    ctx.font = `${fontSize}px Inter, sans-serif`
    
    // Offset the text below the node
    const offset = (isActive || isHovered ? 12 : 8) / globalScale
    ctx.fillText(label, node.x, node.y + r + offset)
  }
}
