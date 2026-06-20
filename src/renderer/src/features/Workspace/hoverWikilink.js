import { marked } from 'marked'
import { renderMermaidToElement } from './mermaidWidgetExtension'
import hljs from 'highlight.js'
import 'highlight.js/styles/atom-one-dark.css'

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

      // Render mermaid blocks inside the hover card
      const mermaidBlocks = contentEl.querySelectorAll('code.language-mermaid')
      if (mermaidBlocks.length > 0) {
        mermaidBlocks.forEach((block, idx) => {
          const code = block.textContent
          const id = `hover-mermaid-${Date.now()}-${idx}`
          const pre = block.parentElement
          
          const wrapper = document.createElement('div')
          wrapper.className = 'cm-mermaid-widget'
          wrapper.style.pointerEvents = 'none' // keep it non-interactive in hover
          wrapper.style.margin = '10px 0'
          
          const scrollWrap = document.createElement('div')
          scrollWrap.className = 'mermaid-scroll-wrap'
          
          const contentDiv = document.createElement('div')
          contentDiv.className = 'mermaid-content'
          
          // Same loading skeleton
          contentDiv.innerHTML = `
            <div class="mermaid-loading">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="2" x2="12" y2="6"></line>
                <line x1="12" y1="18" x2="12" y2="22"></line>
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                <line x1="2" y1="12" x2="6" y2="12"></line>
                <line x1="18" y1="12" x2="22" y2="12"></line>
                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
              </svg>
              Rendering Graph...
            </div>
          `
          
          scrollWrap.appendChild(contentDiv)
          wrapper.appendChild(scrollWrap)
          
          pre.replaceWith(wrapper)
          
          renderMermaidToElement(contentDiv, code, id)
        })
      }

      // Render non-mermaid code blocks
      const allCodeBlocks = contentEl.querySelectorAll('pre > code')
      allCodeBlocks.forEach((codeEl) => {
        if (codeEl.classList.contains('language-mermaid')) return

        const pre = codeEl.parentElement
        
        let lang = 'text'
        codeEl.classList.forEach((cls) => {
          if (cls.startsWith('language-')) {
            lang = cls.replace('language-', '')
          }
        })

        // Apply editor styles
        pre.className = 'cm-line cm-atomic-fenced-code cb-code-header'
        pre.setAttribute('data-cb-lang', lang)
        
        // Layout tweaks for the block
        pre.style.display = 'block'
        pre.style.whiteSpace = 'pre-wrap'
        pre.style.wordBreak = 'break-word'
        pre.style.borderRadius = '8px'
        pre.style.overflow = 'hidden'
        pre.style.marginTop = '12px'
        pre.style.marginBottom = '12px'
        pre.style.cursor = 'default'
        
        // Inner padding for the code (since cb-code-header removes left/right padding on the pre)
        codeEl.style.display = 'block'
        codeEl.style.padding = '0 1em 1em 1em'
        codeEl.style.background = 'transparent'
        codeEl.style.color = 'inherit'
        codeEl.style.fontFamily = 'inherit'

        // Apply syntax highlighting
        try {
          hljs.highlightElement(codeEl)
        } catch (err) {
          console.warn('Failed to highlight code block in hover card', err)
        }

        // Implement the copy button click
        pre.addEventListener('click', (e) => {
          // The CSS copy button is absolutely positioned in the top right.
          // Rough hit area check: top 30px, right 60px
          if (e.offsetY < 30 && e.offsetX > pre.offsetWidth - 60) {
            e.preventDefault()
            e.stopPropagation()
            navigator.clipboard.writeText(codeEl.textContent)
            pre.classList.add('cb-copied')
            setTimeout(() => pre.classList.remove('cb-copied'), 2000)
          }
        })
      })

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
