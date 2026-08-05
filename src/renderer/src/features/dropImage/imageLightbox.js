export function attachLightbox(imgElement) {
  imgElement.style.cursor = 'zoom-in'
  
  imgElement.addEventListener('dblclick', (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    const overlay = document.createElement('div')
    overlay.className = 'image-lightbox-overlay'
    
    const clone = document.createElement('img')
    clone.src = imgElement.src
    clone.className = 'image-lightbox-image'
    
    const close = () => {
      overlay.classList.remove('show')
      setTimeout(() => overlay.remove(), 250)
      window.removeEventListener('keydown', onKeyDown)
    }

    overlay.addEventListener('click', close)
    
    const onKeyDown = (k) => {
      if (k.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKeyDown)
    
    overlay.appendChild(clone)
    document.body.appendChild(overlay)
    
    // Trigger animation
    requestAnimationFrame(() => {
      overlay.classList.add('show')
    })
  })
}
