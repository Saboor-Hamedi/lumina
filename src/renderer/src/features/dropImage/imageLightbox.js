export function attachLightbox(imgElement) {
  imgElement.style.cursor = 'zoom-in'

  imgElement.addEventListener('dblclick', (e) => {
    e.preventDefault()
    e.stopPropagation()

    const overlay = document.createElement('div')
    overlay.className = 'image-lightbox-overlay'
    overlay.tabIndex = '0' // Make it focusable to catch key events directly

    const clone = document.createElement('img')
    clone.src = imgElement.src
    clone.className = 'image-lightbox-image'

    const closeBtn = document.createElement('div')
    closeBtn.className = 'image-lightbox-close'
    closeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`

    const close = () => {
      overlay.classList.remove('show')
      setTimeout(() => overlay.remove(), 250)
      window.removeEventListener('keydown', onKeyDown, true)
    }

    overlay.addEventListener('click', close)
    closeBtn.addEventListener('click', (ev) => {
      ev.stopPropagation()
      close()
    })

    // Use capture phase to ensure it intercepts Escape before anything else
    const onKeyDown = (k) => {
      if (k.key === 'Escape') {
        k.preventDefault()
        k.stopPropagation()
        close()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)

    const wrapper = document.createElement('div')
    wrapper.className = 'image-lightbox-wrapper'
    wrapper.appendChild(clone)
    wrapper.appendChild(closeBtn)

    overlay.appendChild(wrapper)
    document.body.appendChild(overlay)

    // Focus the overlay so it receives keyboard events reliably
    overlay.focus()

    // Trigger animation
    requestAnimationFrame(() => {
      overlay.classList.add('show')
    })
  })
}
