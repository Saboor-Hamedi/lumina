import { hoverTooltip } from '@codemirror/view'

/**
 * Image Hover Preview Extension
 * Shows a popover with the image when hovering over markdown image links.
 * Syntax: ![alt](url)
 */
export const imageHoverPreview = hoverTooltip((view, pos, side) => {
  const { from, to, text } = view.state.doc.lineAt(pos)
  let val = null
  let start = -1
  let end = -1
  let imgUrl = null

  // Check if cursor is inside an image syntax ![]()
  // Relaxed regex to handle titles: ![alt](url "title")
  const imgRegex = /!\[(.*?)\]\((.*?)\)/g
  let match
  while ((match = imgRegex.exec(text))) {
    const matchStart = from + match.index
    const matchEnd = matchStart + match[0].length
    if (pos >= matchStart && pos <= matchEnd) {
      start = matchStart
      end = matchEnd
      // Extract URL (first part of second capture group, removing title if present)
      const rawUrl = match[2]
      imgUrl = rawUrl.split(/\s+/)[0]
      break
    }
  }

  if (!imgUrl) return null

  // Resolve Asset URL
  if (!imgUrl.startsWith('http') && !imgUrl.startsWith('data:') && !imgUrl.startsWith('asset:')) {
    // Local asset, use asset protocol
    imgUrl = 'asset://' + (imgUrl.startsWith('/') ? imgUrl.slice(1) : imgUrl)
  }

  return {
    pos: start,
    end,
    above: true,
    create(view) {
      const container = document.createElement('div')
      container.className = 'image-hover-preview'

      const img = document.createElement('img')
      img.src = imgUrl
      img.style.maxWidth = '300px'
      img.style.maxHeight = '300px'
      img.style.borderRadius = '8px'
      img.style.display = 'block'
      img.style.objectFit = 'contain'
      img.onerror = () => {
        img.src = ''
        img.alt = 'Image not found'
        container.textContent = '❌ Image not found'
        container.style.padding = '8px'
        container.style.color = 'var(--text-error)'
      }

      container.appendChild(img)
      return { dom: container }
    }
  }
}, { hoverTime: 50 })
