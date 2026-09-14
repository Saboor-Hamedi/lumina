/**
 * mermaidAsImage.ts
 *
 * Renders an offscreen SVG Mermaid diagram to a raster PNG and copies it to the system clipboard,
 * adhering faithfully to the current active theme background (light, dark, rose-pine, etc.)
 * rather than forcing a dark background.
 */

export async function copyMermaidAsImage(svgElement: SVGSVGElement | HTMLElement | null): Promise<void> {
  if (!svgElement) {
    throw new Error('SVG element not provided')
  }

  return new Promise((resolve, reject) => {
    try {
      const svg = svgElement as SVGSVGElement
      const viewBox = svg.viewBox?.baseVal
      const rect = svg.getBoundingClientRect()
      const width = viewBox && viewBox.width > 0 ? viewBox.width : rect.width || 800
      const height = viewBox && viewBox.height > 0 ? viewBox.height : rect.height || 600

      const clonedSvg = svg.cloneNode(true) as SVGSVGElement
      clonedSvg.setAttribute('width', String(width))
      clonedSvg.setAttribute('height', String(height))

      // Gather styling from document head if not already embedded
      const svgId = svg.id || svg.getAttribute('id')
      if (svgId) {
        const headStyle =
          document.getElementById(svgId) ||
          document.getElementById(`style-${svgId}`) ||
          document.querySelector(`style[id*="${svgId}"]`)
        if (headStyle && !clonedSvg.querySelector('style')) {
          clonedSvg.prepend(headStyle.cloneNode(true))
        }
      }

      // If svg inside contains duplicate style elements, keep only the first
      const styles = clonedSvg.querySelectorAll('style')
      if (styles.length > 1) {
        for (let i = 1; i < styles.length; i++) {
          styles[i].remove()
        }
      }

      const serializer = new XMLSerializer()
      let svgString = serializer.serializeToString(clonedSvg)

      if (!svgString.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
        svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"')
      }

      svgString = svgString.replace(/&nbsp;/g, '&#160;')
      svgString = svgString.replace(/<br>/g, '<br/>')

      const base64Data = btoa(unescape(encodeURIComponent(svgString)))
      const dataUrl = `data:image/svg+xml;base64,${base64Data}`

      const img = new Image()

      img.onload = () => {
        try {
          const scale = 2
          const canvas = document.createElement('canvas')
          canvas.width = Math.round(width * scale)
          canvas.height = Math.round(height * scale)
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            return reject(new Error('Failed to create canvas 2D context'))
          }
          ctx.scale(scale, scale)

          // Accurately resolve current theme background colors
          const computed = getComputedStyle(document.documentElement)
          const bgColor =
            computed.getPropertyValue('--bg-panel').trim() ||
            computed.getPropertyValue('--bg-card').trim() ||
            computed.getPropertyValue('--bg-app').trim() ||
            '#18181b'

          ctx.fillStyle = bgColor
          ctx.fillRect(0, 0, width, height)

          ctx.drawImage(img, 0, 0, width, height)

          canvas.toBlob(async (blob) => {
            if (!blob) {
              return reject(new Error('Canvas export failed'))
            }
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
      }

      img.onerror = () => {
        reject(new Error('Failed to rasterize diagram into image'))
      }

      img.src = dataUrl
    } catch (err) {
      reject(err)
    }
  })
}

export default copyMermaidAsImage
