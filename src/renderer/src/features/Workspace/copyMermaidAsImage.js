export async function copyMermaidAsImage(svgElement) {
  if (!svgElement) {
    throw new Error('SVG element not provided')
  }

  return new Promise((resolve, reject) => {
    try {
      const rect = svgElement.getBoundingClientRect()
      const width = svgElement.getAttribute('width') || rect.width || 800
      const height = svgElement.getAttribute('height') || rect.height || 600

      const clonedSvg = svgElement.cloneNode(true)

      const serializer = new XMLSerializer()
      let svgString = serializer.serializeToString(clonedSvg)

      if (!svgString.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
        svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"')
      }

      // Fix invalid entities and unclosed tags that Mermaid outputs
      svgString = svgString.replace(/&nbsp;/g, '&#160;')
      svgString = svgString.replace(/<br>/g, '<br/>')

      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
      const DOMURL = window.URL || window.webkitURL || window
      const url = DOMURL.createObjectURL(svgBlob)

      const img = new Image()
      img.onload = () => {
        try {
          const scale = 2 // Retina scale for crisper images
          const canvas = document.createElement('canvas')
          canvas.width = parseFloat(width) * scale
          canvas.height = parseFloat(height) * scale
          const ctx = canvas.getContext('2d')
          ctx.scale(scale, scale)

          // Use the computed background color of the widget to match the UI
          const widgetBody = svgElement.closest('.mermaid-widget-body')
          const bgColor = widgetBody
            ? window.getComputedStyle(widgetBody).backgroundColor
            : 'rgba(0,0,0,0)'

          ctx.fillStyle = bgColor
          ctx.fillRect(0, 0, parseFloat(width), parseFloat(height))

          ctx.drawImage(img, 0, 0, parseFloat(width), parseFloat(height))
          DOMURL.revokeObjectURL(url)

          canvas.toBlob(async (blob) => {
            if (!blob) {
              return reject(new Error('Canvas to Blob failed'))
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
        DOMURL.revokeObjectURL(url)
        reject(new Error('Failed to load SVG into Image'))
      }

      img.src = url
    } catch (err) {
      reject(err)
    }
  })
}
