/**
 * Renders a code snippet as a beautiful image card and copies it to the clipboard as PNG.
 * Inspired by tools like Carbon and Ray.so.
 */
export async function copyCodeAsImage(code, lang = 'CODE') {
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

      const cardWidth = Math.max(480, Math.min(1200, Math.round(maxLineLength * charWidth + padding * 2 + 40)))
      const cardHeight = Math.round(headerHeight + lines.length * lineHeight + padding * 1.5)

      const outerPadding = 32
      const totalWidth = cardWidth + outerPadding * 2
      const totalHeight = cardHeight + outerPadding * 2

      const scale = 2 // Retina scale for crisp rendering
      const canvas = document.createElement('canvas')
      canvas.width = totalWidth * scale
      canvas.height = totalHeight * scale
      const ctx = canvas.getContext('2d')
      ctx.scale(scale, scale)

      // Outer background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, totalWidth, totalHeight)
      bgGrad.addColorStop(0, '#0f172a')
      bgGrad.addColorStop(1, '#020617')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, totalWidth, totalHeight)

      // Card container geometry
      const cardX = outerPadding
      const cardY = outerPadding
      const cardRadius = 10

      // Card Drop Shadow
      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
      ctx.shadowBlur = 24
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 12

      ctx.beginPath()
      ctx.roundRect(cardX, cardY, cardWidth, cardHeight, cardRadius)
      ctx.fillStyle = '#18181b'
      ctx.fill()
      ctx.restore()

      // Card Border
      ctx.beginPath()
      ctx.roundRect(cardX, cardY, cardWidth, cardHeight, cardRadius)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
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
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'
      ctx.textAlign = 'right'
      ctx.fillText((lang || 'CODE').toUpperCase(), cardX + cardWidth - 20, dotY + 4)

      // Header divider line
      ctx.beginPath()
      ctx.moveTo(cardX, cardY + headerHeight)
      ctx.lineTo(cardX + cardWidth, cardY + headerHeight)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
      ctx.stroke()

      // Code text lines
      ctx.textAlign = 'left'
      ctx.font = '13px "JetBrains Mono", "Fira Code", Consolas, monospace'
      let currentY = cardY + headerHeight + 20

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Basic syntax heuristics for keywords/comments
        if (line.trim().startsWith('//') || line.trim().startsWith('#')) {
          ctx.fillStyle = '#6a9955'
        } else if (
          line.trim().startsWith('import ') ||
          line.trim().startsWith('export ') ||
          line.trim().startsWith('const ') ||
          line.trim().startsWith('function ') ||
          line.trim().startsWith('def ') ||
          line.trim().startsWith('return ')
        ) {
          ctx.fillStyle = '#c586c0'
        } else {
          ctx.fillStyle = '#e2e8f0'
        }
        ctx.fillText(line, cardX + 20, currentY)
        currentY += lineHeight
      }

      // Convert canvas to PNG blob and write to clipboard
      canvas.toBlob(async (blob) => {
        if (!blob) return reject(new Error('Canvas export to PNG failed'))
        try {
          const item = new ClipboardItem({ 'image/png': blob })
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
