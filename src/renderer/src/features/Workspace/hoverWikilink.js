import { marked } from 'marked'

export function setupWikilinkHover(wrapper, getVaultStore) {
  let hoverCard = null
  let hoverTimeout = null
  let currentTarget = null

  const removeCard = () => {
    if (hoverCard) {
      hoverCard.remove()
      hoverCard = null
    }
    currentTarget = null
  }

  const createCard = (x, y, title, contentSnippet, timestamp, noteId) => {
    removeCard()

    hoverCard = document.createElement('div')
    hoverCard.className = 'cm-wiki-hover'
    hoverCard.style.position = 'absolute'
    hoverCard.style.zIndex = '999999'

    // Content Wrap (the whole card is now one seamless box)
    const contentWrap = document.createElement('div')
    contentWrap.className = 'wiki-hover-content-wrap'

    // Obsidian-style large title
    const titleEl = document.createElement('h1')
    titleEl.className = 'wiki-hover-title-h1'
    titleEl.textContent = title
    contentWrap.appendChild(titleEl)

    // Content
    if (contentSnippet) {
      const contentEl = document.createElement('div')
      contentEl.className = 'wiki-hover-content'

      // Inject pseudo-wikilink spans for styling before parsing markdown
      let parsedSnippet = contentSnippet.replace(
        /\[\[(.*?)\]\]/g,
        '<span class="cm-atomic-wiki-link">$1</span>'
      )
      contentEl.innerHTML = marked.parse(parsedSnippet)

      contentWrap.appendChild(contentEl)
      hoverCard.appendChild(contentWrap)

      // Add Expand Icon (only if note is found)
      const expandIcon = document.createElement('div')
      expandIcon.className = 'wiki-hover-expand-icon'
      expandIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`
      expandIcon.style.position = 'absolute'
      expandIcon.style.top = '12px'
      expandIcon.style.right = '12px'
      expandIcon.style.cursor = 'pointer'
      expandIcon.style.color = 'var(--text-faint)'
      expandIcon.style.transition = 'color 0.2s'

      expandIcon.onmouseover = () => (expandIcon.style.color = 'var(--text-main)')
      expandIcon.onmouseout = () => (expandIcon.style.color = 'var(--text-faint)')

      // Store note ID or object on the card for the click handler
      hoverCard.dataset.noteId = noteId

      expandIcon.addEventListener('click', (evt) => {
        evt.preventDefault()
        evt.stopPropagation()
        if (noteId) {
          const { snippets, setSelectedSnippet } = getVaultStore()
          const targetNote = snippets.find((s) => s.id === noteId)
          if (targetNote && setSelectedSnippet) {
            setSelectedSnippet(targetNote)
            removeCard()
          }
        }
      })

      hoverCard.appendChild(expandIcon)
    } else {
      const notFoundWrap = document.createElement('div')
      notFoundWrap.className = 'cm-wiki-hover not-found'

      const icon = document.createElement('div')
      icon.className = 'wiki-hover-not-found-icon'
      icon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`

      const text = document.createElement('div')
      text.className = 'wiki-hover-not-found-text'
      text.textContent = 'Note not found'

      const hint = document.createElement('div')
      hint.className = 'wiki-hover-not-found-hint'
      hint.textContent = 'Click to create it'

      notFoundWrap.appendChild(icon)
      notFoundWrap.appendChild(text)
      notFoundWrap.appendChild(hint)
      hoverCard.appendChild(notFoundWrap)
    }

    document.body.appendChild(hoverCard)

    // Position it
    const rect = hoverCard.getBoundingClientRect()
    let top = y + 20
    let left = x

    // Prevent overflow
    if (left + rect.width > window.innerWidth) {
      left = window.innerWidth - rect.width - 20
    }
    if (top + rect.height > window.innerHeight) {
      top = y - rect.height - 20
    }

    hoverCard.style.top = `${top}px`
    hoverCard.style.left = `${left}px`
  }

  const handleMouseOver = (e) => {
    const linkEl = e.target.closest('.cm-atomic-wiki-link, .cm-atomic-wikilink-wrap')
    if (!linkEl) return

    const target = linkEl.getAttribute('data-wiki-link-target') || linkEl.getAttribute('data-url')
    if (!target) return

    if (currentTarget === target) return
    currentTarget = target

    clearTimeout(hoverTimeout)
    hoverTimeout = setTimeout(() => {
      const { snippets } = getVaultStore()
      const targetLower = target.toLowerCase()

      let note = snippets.find(
        (s) =>
          s.title &&
          (s.title.toLowerCase() === targetLower || s.title.toLowerCase() === `${targetLower}.md`)
      )

      if (note) {
        // Render full text
        const rawContent = note.code || ''
        createCard(e.clientX, e.clientY, note.title, rawContent, note.updatedAt, note.id)
      } else {
        createCard(e.clientX, e.clientY, target, null, null, null)
      }
    }, 300) // 300ms delay for smooth experience
  }

  const handleDocumentClick = (e) => {
    if (hoverCard && !hoverCard.contains(e.target)) {
      if (
        !e.target.closest('.cm-atomic-wiki-link') &&
        !e.target.closest('.cm-atomic-wikilink-wrap')
      ) {
        removeCard()
      }
    }
  }

  wrapper.addEventListener('mouseover', handleMouseOver)
  document.addEventListener('mousedown', handleDocumentClick)

  return () => {
    wrapper.removeEventListener('mouseover', handleMouseOver)
    document.removeEventListener('mousedown', handleDocumentClick)
    removeCard()
    clearTimeout(hoverTimeout)
  }
}
