/**
 * =========================================================================================
 * Code Exporter (`copyCodeAsImage.ts`)
 * =========================================================================================
 *
 * Purpose:
 * Renders a code snippet as a beautiful image card and copies it directly to the
 * system clipboard as a PNG.
 *
 * Theme Support:
 * Dynamically resolves background colors, text colors, borders, and accents from the
 * active Lumina theme (`--bg-card`, `--bg-app`, `--border-dim`, `--text-main`, etc.),
 * rendering gorgeous exports in both Light themes (e.g. Rosé Pine Dawn) and Dark themes.
 * =========================================================================================
 */

export async function copyCodeAsImage(code: string, lang = 'CODE'): Promise<void> {
  if (!code && code !== '') {
    throw new Error('No code provided to export')
  }

  return new Promise((resolve, reject) => {
    try {
      const lines = code.split('\n')
      const fontSize = 14
      const lineHeight = 22
      const padding = 28
      const headerHeight = 38
      const charWidth = 8.5 // approximate monospace character width at 14px

      // Calculate canvas dimensions
      let maxLineLength = (lang || 'CODE').length + 10
      for (const line of lines) {
        if (line.length > maxLineLength) maxLineLength = line.length
      }

      const cardWidth = Math.max(
        480,
        Math.min(1200, Math.round(maxLineLength * charWidth + padding * 2 + 40))
      )
      const cardHeight = Math.round(headerHeight + lines.length * lineHeight + padding * 1.5)

      const outerPadding = 32
      const totalWidth = cardWidth + outerPadding * 2
      const totalHeight = cardHeight + outerPadding * 2

      const scale = 2 // Retina scale for crisp rendering
      const canvas = document.createElement('canvas')
      canvas.width = totalWidth * scale
      canvas.height = totalHeight * scale
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        return reject(new Error('Failed to create canvas context'))
      }
      ctx.scale(scale, scale)

      // Resolve colors dynamically from active CSS theme variables
      const computed = getComputedStyle(document.documentElement)
      const bgApp =
        computed.getPropertyValue('--bg-app').trim() ||
        computed.getPropertyValue('--bg-editor').trim() ||
        '#0f172a'
      const bgCard =
        computed.getPropertyValue('--bg-card').trim() ||
        computed.getPropertyValue('--bg-panel').trim() ||
        '#18181b'
      const borderDim =
        computed.getPropertyValue('--border-dim').trim() ||
        computed.getPropertyValue('--border-subtle').trim() ||
        'rgba(255, 255, 255, 0.1)'
      const textMain = computed.getPropertyValue('--text-main').trim() || '#e2e8f0'
      const textMuted = computed.getPropertyValue('--text-muted').trim() || '#94a3b8'
      const textAccent = computed.getPropertyValue('--text-accent').trim() || '#38bdf8'

      // Check if light theme
      const isLightTheme = document.documentElement.getAttribute('data-theme') === 'light'

      // Outer background: subtle gradient based on active app background
      const bgGrad = ctx.createLinearGradient(0, 0, totalWidth, totalHeight)
      if (isLightTheme) {
        bgGrad.addColorStop(0, bgApp)
        bgGrad.addColorStop(1, computed.getPropertyValue('--bg-sidebar').trim() || '#f1f5f9')
      } else {
        bgGrad.addColorStop(0, bgApp)
        bgGrad.addColorStop(1, '#020617')
      }
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, totalWidth, totalHeight)

      // Card container geometry
      const cardX = outerPadding
      const cardY = outerPadding
      const cardRadius = 10

      // Card Drop Shadow
      ctx.save()
      ctx.shadowColor = isLightTheme ? 'rgba(0, 0, 0, 0.08)' : 'rgba(0, 0, 0, 0.45)'
      ctx.shadowBlur = isLightTheme ? 16 : 24
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = isLightTheme ? 6 : 12

      ctx.beginPath()
      ctx.roundRect(cardX, cardY, cardWidth, cardHeight, cardRadius)
      ctx.fillStyle = bgCard
      ctx.fill()
      ctx.restore()

      // Card Border
      ctx.beginPath()
      ctx.roundRect(cardX, cardY, cardWidth, cardHeight, cardRadius)
      ctx.strokeStyle = borderDim
      ctx.lineWidth = 1
      ctx.stroke()

      // Header Bar Window Buttons (macOS style dots)
      const dotY = cardY + 18
      const dotRadius = 5.5

      // Close (Red)
      ctx.beginPath()
      ctx.arc(cardX + 20, dotY, dotRadius, 0, Math.PI * 2)
      ctx.fillStyle = '#ff5f56'
      ctx.fill()

      // Minimize (Yellow)
      ctx.beginPath()
      ctx.arc(cardX + 38, dotY, dotRadius, 0, Math.PI * 2)
      ctx.fillStyle = '#ffbd2e'
      ctx.fill()

      // Maximize (Green)
      ctx.beginPath()
      ctx.arc(cardX + 56, dotY, dotRadius, 0, Math.PI * 2)
      ctx.fillStyle = '#27c93f'
      ctx.fill()

      // Language label on header
      ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.fillStyle = textMuted
      ctx.textAlign = 'right'
      ctx.fillText((lang || 'CODE').toUpperCase(), cardX + cardWidth - 20, dotY + 4)

      // Header divider line
      ctx.beginPath()
      ctx.moveTo(cardX, cardY + headerHeight)
      ctx.lineTo(cardX + cardWidth, cardY + headerHeight)
      ctx.strokeStyle = borderDim
      ctx.stroke()

      // Code text lines
      ctx.textAlign = 'left'
      ctx.font = '13px "JetBrains Mono", "Fira Code", Consolas, monospace'
      let currentY = cardY + headerHeight + 20

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const trimmed = line.trim()

        // Theme-aware syntax heuristics
        if (trimmed.startsWith('//') || trimmed.startsWith('#')) {
          ctx.fillStyle = isLightTheme ? '#008000' : '#6a9955'
        } else if (
          trimmed.startsWith('import ') ||
          trimmed.startsWith('export ') ||
          trimmed.startsWith('const ') ||
          trimmed.startsWith('let ') ||
          trimmed.startsWith('var ') ||
          trimmed.startsWith('function ') ||
          trimmed.startsWith('def ') ||
          trimmed.startsWith('return ') ||
          trimmed.startsWith('class ') ||
          trimmed.startsWith('interface ') ||
          trimmed.startsWith('type ')
        ) {
          ctx.fillStyle = isLightTheme ? '#0000ff' : '#c586c0'
        } else if (
          trimmed.startsWith('if ') ||
          trimmed.startsWith('else ') ||
          trimmed.startsWith('for ') ||
          trimmed.startsWith('while ') ||
          trimmed.startsWith('switch ') ||
          trimmed.startsWith('case ')
        ) {
          ctx.fillStyle = textAccent
        } else {
          ctx.fillStyle = textMain
        }

        ctx.fillText(line, cardX + 20, currentY)
        currentY += lineHeight
      }

      // Convert canvas to PNG blob and write to clipboard
      canvas.toBlob(async (blob) => {
        if (!blob) return reject(new Error('Canvas export to PNG failed'))
        try {
          const item =
            typeof ClipboardItem !== 'undefined'
              ? new ClipboardItem({ 'image/png': blob })
              : (blob as any)
          await navigator.clipboard.write([item])
          resolve()
        } catch (err) {
          reject(err)
        }
      }, 'image/png')
    } catch (err) {
      reject(err)
    }
  })
}

export default copyCodeAsImage
