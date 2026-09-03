export async function copyMermaidAsImage(svgElement) {
  if (!svgElement) {
    throw new Error('SVG element not provided')
  }

  return new Promise((resolve, reject) => {
    try {
      const viewBox = svgElement.viewBox?.baseVal
      const rect = svgElement.getBoundingClientRect()
      const width = viewBox && viewBox.width > 0 ? viewBox.width : rect.width || 800
      const height = viewBox && viewBox.height > 0 ? viewBox.height : rect.height || 600

      const clonedSvg = svgElement.cloneNode(true)
      clonedSvg.setAttribute('width', String(width))
      clonedSvg.setAttribute('height', String(height))

      const svgId = svgElement.id || svgElement.getAttribute('id')
      if (svgId) {
        const headStyle =
          document.getElementById(svgId) ||
          document.getElementById(`style-${svgId}`) ||
          document.querySelector(`style[id*="${svgId}"]`)
        if (headStyle && !clonedSvg.querySelector(`style[id*="${svgId}"]`)) {
          clonedSvg.prepend(headStyle.cloneNode(true))
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
          ctx.scale(scale, scale)

          ctx.fillStyle = '#18181b'
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
