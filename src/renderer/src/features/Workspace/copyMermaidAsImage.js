export async function copyMermaidAsImage(svgElement) {
  if (!svgElement) {
    throw new Error('SVG element not provided')
  }

  return new Promise((resolve, reject) => {
    try {
      const serializer = new XMLSerializer()
      let svgString = serializer.serializeToString(svgElement)

      const rect = svgElement.getBoundingClientRect()
      const width = svgElement.getAttribute('width') || rect.width || 800
      const height = svgElement.getAttribute('height') || rect.height || 600

      if (!svgString.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
        svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"')
      }

      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
      const DOMURL = window.URL || window.webkitURL || window
      const url = DOMURL.createObjectURL(svgBlob)

      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = parseFloat(width)
          canvas.height = parseFloat(height)
          const ctx = canvas.getContext('2d')
          
          // Recreate the editor's visual background
          const computed = getComputedStyle(document.documentElement)
          const bgPrimary = computed.getPropertyValue('--bg-primary').trim() || '#121212'
          
          ctx.fillStyle = bgPrimary
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          
          // Apply the .mermaid-widget-body overlay
          ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
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
