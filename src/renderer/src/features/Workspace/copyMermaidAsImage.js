export async function getMermaidPngBlob(svgElement) {
  if (!svgElement) {
    throw new Error('SVG element not provided')
  }

  return new Promise((resolve, reject) => {
    try {
      const rect = svgElement.getBoundingClientRect()
      const parsedWidth = parseFloat(svgElement.getAttribute('width') || rect.width || 800) || 800
      const parsedHeight = parseFloat(svgElement.getAttribute('height') || rect.height || 600) || 600

      const clonedSvg = svgElement.cloneNode(true)
      clonedSvg.setAttribute('width', parsedWidth + 'px')
      clonedSvg.setAttribute('height', parsedHeight + 'px')

      const serializer = new XMLSerializer()
      let svgString = serializer.serializeToString(clonedSvg)

      // Fix invalid HTML entities that Mermaid might produce
      svgString = svgString.replace(/&nbsp;/g, '&#160;')
      
      // Fix unclosed <br> tags which Mermaid occasionally outputs and break XML parsing
      svgString = svgString.replace(/<br>/g, '<br/>')

      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
      const DOMURL = window.URL || window.webkitURL || window
      const url = DOMURL.createObjectURL(svgBlob)

      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(10, parsedWidth)
          canvas.height = Math.max(10, parsedHeight)
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

          canvas.toBlob((blob) => {
            if (!blob) {
              return reject(new Error('Canvas to Blob failed'))
            }
            resolve(blob)
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
