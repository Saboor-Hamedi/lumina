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

      // Guarantee override of Mermaid's theme by applying inline !important styles directly to elements
      const shapes = clonedSvg.querySelectorAll('.node rect, .node circle, .node ellipse, .node polygon, .node path, .mindmap-node rect, .mindmap-node circle, .mindmap-node ellipse, .mindmap-node polygon, .mindmap-node path, .cluster rect')
      shapes.forEach(shape => {
        shape.style.setProperty('fill', 'transparent', 'important')
        shape.style.setProperty('stroke', '#000000', 'important')
        shape.style.setProperty('stroke-width', '1px', 'important')
      })

      const texts = clonedSvg.querySelectorAll('.node .label text, .mindmap-node text, .label text, .edgeLabel text, .cluster-label text, text, tspan, p, span, div')
      texts.forEach(text => {
        text.style.setProperty('color', '#000000', 'important')
        text.style.setProperty('fill', '#000000', 'important')
        text.style.setProperty('stroke', 'none', 'important')
      })

      const edges = clonedSvg.querySelectorAll('.edgePath path, .mindmap-edges path, path.link, path.edge, .flowchart-link')
      edges.forEach(edge => {
        edge.style.setProperty('stroke', '#000000', 'important')
        edge.style.setProperty('stroke-width', '1px', 'important')
        edge.style.setProperty('fill', 'none', 'important')
      })

      const markers = clonedSvg.querySelectorAll('marker path, marker polygon, marker circle')
      markers.forEach(marker => {
        marker.style.setProperty('fill', '#000000', 'important')
        marker.style.setProperty('stroke', '#000000', 'important')
      })

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
          const canvas = document.createElement('canvas')
          canvas.width = parseFloat(width)
          canvas.height = parseFloat(height)
          const ctx = canvas.getContext('2d')
          
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
