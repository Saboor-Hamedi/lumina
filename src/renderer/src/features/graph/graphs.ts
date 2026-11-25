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

interface CanvasThemePalette {
  themeKey: string
  isLight: boolean
  textMain: string
  textAccent: string
  linkDefault: string
  shadowColor: string
}

let cachedCanvasTheme: CanvasThemePalette | null = null

function parseHexLuminance(color: string): number | null {
  const hex = color.trim().replace(/^#/, '')
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16)
    const g = parseInt(hex[1] + hex[1], 16)
    const b = parseInt(hex[2] + hex[2], 16)
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255
  }
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255
  }
  return null
}

/**
 * Resolves live computed theme colors for HTML5 Canvas 2D (which cannot parse CSS `var()`).
 * Cached per `data-theme` attribute so frame rendering stays O(1).
 */
export function getCanvasThemePalette(): CanvasThemePalette {
  if (typeof document === 'undefined') {
    return {
      themeKey: 'dark',
      isLight: false,
      textMain: '#e2e8f0',
      textAccent: '#40bafa',
      linkDefault: 'rgba(180,180,180,0.22)',
      shadowColor: 'rgba(0,0,0,0.8)'
    }
  }
  const root = document.documentElement
  const themeKey = root.getAttribute('data-theme') || 'dark'
  if (cachedCanvasTheme && cachedCanvasTheme.themeKey === themeKey) {
    return cachedCanvasTheme
  }

  const styles = getComputedStyle(root)
  const bgApp = styles.getPropertyValue('--bg-panel').trim() || styles.getPropertyValue('--bg-app').trim() || '#111111'
  const textMain = styles.getPropertyValue('--text-main').trim() || '#e2e8f0'
  const textAccent = styles.getPropertyValue('--text-accent').trim() || '#40bafa'

  const lum = parseHexLuminance(bgApp)
  const isLight =
    lum !== null
      ? lum > 0.55
      : themeKey === 'light' || themeKey === 'parchment' || themeKey === 'porcelain' || themeKey === 'rosePineDawn'

  cachedCanvasTheme = {
    themeKey,
    isLight,
    textMain,
    textAccent,
    linkDefault: isLight ? 'rgba(60, 50, 40, 0.28)' : 'rgba(180, 180, 180, 0.22)',
    shadowColor: isLight ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.8)'
  }
  return cachedCanvasTheme
}

export const getNodeColor = (
  node: GraphNode,
  selectedSnippetId?: string,
  defaultNodeColor = '#40bafa'
): string => {
  if (selectedSnippetId && node.snippetId === selectedSnippetId) {
    const palette = getCanvasThemePalette()
    return palette.isLight ? palette.textAccent : '#ffffff'
  }
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

  // Track node render time only when performance profiler is active
  const trackPerf = (window as any)._luminaNodesRenderTime !== undefined
  const start = trackPerf ? performance.now() : 0

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
    const palette = getCanvasThemePalette()
    // Font size relative to the canvas coordinate system, so it scales naturally with zoom
    const fontSize = 4
    ctx.font = `${isActive ? '600 ' : ''}${fontSize}px Inter, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    // Subtle theme-aware halo for readability on both light and dark themes
    ctx.shadowColor = palette.shadowColor
    ctx.shadowBlur = 2 / globalScale

    // Fade in text gracefully as user zooms in
    const textAlpha = isHovered || isActive ? 1 : Math.min(1, (globalScale - 1.2) / 0.8)
    ctx.globalAlpha = textAlpha

    ctx.fillStyle = isActive
      ? palette.isLight
        ? palette.textMain
        : '#ffffff'
      : palette.textMain
    ctx.fillText(label, nx, ny + r + 2)

    ctx.shadowBlur = 0
    ctx.globalAlpha = 1.0
  }

  if (trackPerf) {
    ;(window as any)._luminaNodesRenderTime += performance.now() - start
  }
}
