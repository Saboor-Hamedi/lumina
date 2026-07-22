import { marked } from 'marked'
import { renderMermaidToElement } from './mermaidWidgetExtension'
import hljs from 'highlight.js'
import 'highlight.js/styles/atom-one-dark.css'

export function setupWikilinkHover(wrapper, getVaultStore) {
  let hoverCard = null
  let hoverTimeout = null
  let closeTimeout = null
  let currentTarget = null

  const removeCard = (resetTarget = true) => {
    if (hoverCard) {
      hoverCard.remove()
      hoverCard = null
    }
    if (resetTarget) {
      currentTarget = null
    }
    if (closeTimeout) {
      clearTimeout(closeTimeout)
      closeTimeout = null
    }
  }

  const createCard = (x, y, title, contentSnippet, timestamp, noteId) => {
    removeCard(false) // Do NOT reset currentTarget when refreshing the card

    hoverCard = document.createElement('div')
    hoverCard.className = 'cm-wiki-hover horizontal'
    hoverCard.style.position = 'absolute'
    hoverCard.style.visibility = 'hidden' // Prevent any 0,0 flash/shake on creation

    if (contentSnippet !== null && contentSnippet !== undefined) {
      // Subtle Header with title and expand icon
      const header = document.createElement('div')
      header.className = 'wiki-hover-header horizontal'
      header.style.display = 'flex'
      header.style.alignItems = 'center'
      header.style.justifyContent = 'space-between'
      header.style.gap = '8px'
      header.style.padding = '10px 14px'
      header.style.flexShrink = '0'

      const headerTitle = document.createElement('div')
      headerTitle.className = 'wiki-hover-header-title'
      headerTitle.textContent = title
      headerTitle.style.fontSize = '13px'
      headerTitle.style.fontWeight = '600'
      headerTitle.style.color = 'var(--text-main)'
      headerTitle.style.overflow = 'hidden'
      headerTitle.style.textOverflow = 'ellipsis'
      headerTitle.style.whiteSpace = 'nowrap'
      headerTitle.style.flex = '1'

      header.appendChild(headerTitle)

      // Add Expand Icon in the top header
      if (noteId) {
        const expandIcon = document.createElement('div')
        expandIcon.className = 'wiki-hover-expand-icon'
        expandIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`
        expandIcon.style.display = 'flex'
        expandIcon.style.alignItems = 'center'
        expandIcon.style.justifyContent = 'center'
        expandIcon.style.cursor = 'pointer'
        expandIcon.style.color = 'var(--text-faint)'
        expandIcon.style.transition = 'color 0.2s'
        expandIcon.style.flexShrink = '0'

        expandIcon.onmouseover = () => (expandIcon.style.color = 'var(--text-accent)')
        expandIcon.onmouseout = () => (expandIcon.style.color = 'var(--text-faint)')

        expandIcon.addEventListener('click', (evt) => {
          evt.preventDefault()
          evt.stopPropagation()
          const { snippets, setSelectedSnippet } = getVaultStore()
          const targetNote = snippets.find((s) => s.id === noteId)
          if (targetNote && setSelectedSnippet) {
            setSelectedSnippet(targetNote)
            removeCard()
          }
        })

        header.appendChild(expandIcon)
      }

      hoverCard.appendChild(header)

      // Content Wrap
      const contentWrap = document.createElement('div')
      contentWrap.className = 'wiki-hover-content-wrap'

      const contentEl = document.createElement('div')
      contentEl.className = 'wiki-hover-content'

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
          wrapper.style.margin = '10px 0'
          
          const scrollWrap = document.createElement('div')
          scrollWrap.className = 'mermaid-scroll-wrap'
          
          const contentDiv = document.createElement('div')
          contentDiv.className = 'mermaid-content'
          
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

        const wrapper = document.createElement('div')
        wrapper.className = 'hover-code-wrapper'
        wrapper.style.display = 'block'
        wrapper.style.marginTop = '12px'
        wrapper.style.marginBottom = '12px'
        wrapper.style.borderRadius = '8px'
        wrapper.style.overflow = 'hidden'
        wrapper.style.background = 'var(--bg-editor, #1e1e1e)'
        wrapper.style.border = '1px solid var(--border-dim, rgba(255,255,255,0.05))'

        const header = document.createElement('div')
        header.style.position = 'relative'
        header.style.height = '32px'
        header.style.background = 'rgba(0,0,0,0.2)'
        header.style.borderBottom = '1px solid var(--border-dim, rgba(255,255,255,0.05))'
        header.style.display = 'flex'
        header.style.alignItems = 'center'
        header.style.justifyContent = 'flex-end'
        header.style.padding = '0 12px'
        
        const langPill = document.createElement('span')
        langPill.textContent = lang.toUpperCase()
        langPill.style.fontSize = '10px'
        langPill.style.fontWeight = '600'
        langPill.style.color = 'var(--text-muted, rgba(255, 255, 255, 0.4))'
        langPill.style.background = 'rgba(255, 255, 255, 0.05)'
        langPill.style.padding = '4px 10px'
        langPill.style.borderRadius = '4px'
        langPill.style.letterSpacing = '0.5px'
        langPill.style.cursor = 'pointer'
        langPill.style.transition = 'all 0.2s ease'
        langPill.style.border = '1px solid transparent'
        langPill.style.userSelect = 'none'

        langPill.onmouseover = () => {
          langPill.style.color = 'var(--text-main, rgba(255, 255, 255, 0.9))'
          langPill.style.background = 'rgba(255, 255, 255, 0.1)'
          langPill.style.borderColor = 'rgba(255, 255, 255, 0.1)'
        }
        langPill.onmouseout = () => {
          langPill.style.color = 'var(--text-muted, rgba(255, 255, 255, 0.4))'
          langPill.style.background = 'rgba(255, 255, 255, 0.05)'
          langPill.style.borderColor = 'transparent'
        }
        
        langPill.onclick = (e) => {
          e.stopPropagation()
          navigator.clipboard.writeText(codeEl.textContent)
          
          langPill.textContent = 'COPIED!'
          langPill.style.color = '#10b981'
          langPill.style.borderColor = 'rgba(16, 185, 129, 0.2)'
          langPill.style.background = 'rgba(16, 185, 129, 0.1)'
          
          setTimeout(() => {
            langPill.textContent = lang.toUpperCase()
            langPill.style.color = 'var(--text-muted, rgba(255, 255, 255, 0.4))'
            langPill.style.background = 'rgba(255, 255, 255, 0.05)'
            langPill.style.borderColor = 'transparent'
          }, 2000)
        }
        header.appendChild(langPill)

        pre.replaceWith(wrapper)
        wrapper.appendChild(header)
        wrapper.appendChild(pre)

        pre.className = ''
        pre.style.whiteSpace = 'pre-wrap'
        pre.style.wordBreak = 'break-word'
        pre.style.cursor = 'default'
        pre.style.margin = '0'
        pre.style.padding = '0'
        
        codeEl.style.display = 'block'
        codeEl.style.padding = '12px'
        codeEl.style.background = 'transparent'
        codeEl.style.color = 'var(--text-main, #d4d4d4)'
        codeEl.style.fontFamily = 'var(--font-mono, monospace)'
        codeEl.style.fontSize = '13px'
        codeEl.style.lineHeight = '1.5'

        try {
          hljs.highlightElement(codeEl)
        } catch (err) {
          console.warn('Failed to highlight code block in hover card', err)
        }

        pre.addEventListener('click', (e) => {
          if (e.offsetY < 30 && e.offsetX > pre.offsetWidth - 60) {
            e.preventDefault()
            e.stopPropagation()
            navigator.clipboard.writeText(codeEl.textContent)
            pre.classList.add('cb-copied')
            setTimeout(() => pre.classList.remove('cb-copied'), 2000)
          }
        })
      })

      hoverCard.dataset.noteId = noteId
    } else {
      hoverCard.className = 'cm-wiki-hover rename-modal-style not-found-modal'

      const contentBox = document.createElement('div')
      contentBox.className = 'not-found-rename-box'

      const titleEl = document.createElement('div')
      titleEl.className = 'not-found-rename-title'
      titleEl.textContent = title

      const subtitleEl = document.createElement('div')
      subtitleEl.className = 'not-found-rename-subtitle'
      subtitleEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M12 5v14M5 12h14"/></svg><span>Click to create note</span>`

      contentBox.appendChild(titleEl)
      contentBox.appendChild(subtitleEl)
      hoverCard.appendChild(contentBox)

      contentBox.addEventListener('click', async (evt) => {
        evt.preventDefault()
        evt.stopPropagation()
        try {
          const { snippets, saveSnippet, setSelectedSnippet } = getVaultStore()
          const targetLower = title.toLowerCase()
          let targetSnippet = snippets?.find(
            (s) =>
              s.title &&
              (s.title.toLowerCase() === targetLower || s.title.toLowerCase() === `${targetLower}.md`)
          )
          if (!targetSnippet) {
            targetSnippet = {
              id: crypto.randomUUID(),
              title: title,
              code: `# ${title}\n\n`,
              language: 'markdown',
              tags: '',
              timestamp: Date.now()
            }
            if (saveSnippet) await saveSnippet(targetSnippet)
          }
          if (setSelectedSnippet) setSelectedSnippet(targetSnippet)
          removeCard()
        } catch (err) {
          console.error('Failed to create note from hover card:', err)
        }
      })
    }

    document.body.appendChild(hoverCard)

    const wrapperRect = wrapper.getBoundingClientRect()

    if (wrapperRect.width < 540) {
      hoverCard.style.maxWidth = `${Math.max(200, wrapperRect.width - 40)}px`
      hoverCard.style.minWidth = 'auto'
      hoverCard.style.whiteSpace = 'normal'
    }

    const rect = hoverCard.getBoundingClientRect()

    let top = y + 20
    let left = x - (rect.width / 2)

    if (left + rect.width > wrapperRect.right - 20) {
      left = wrapperRect.right - rect.width - 20
    }
    if (left < wrapperRect.left + 20) {
      left = wrapperRect.left + 20
    }

    if (top + rect.height > wrapperRect.bottom - 20) {
      top = y - rect.height - 20
      
      if (top < wrapperRect.top + 20) {
        top = wrapperRect.top + 20
      }
    }

    hoverCard.style.top = `${Math.round(top)}px`
    hoverCard.style.left = `${Math.round(left)}px`
    hoverCard.style.visibility = 'visible' // Show smoothly at exact integer coordinates
  }

  const handleMouseOver = (e) => {
    const linkEl = e.target.closest('.cm-atomic-wiki-link, .cm-atomic-wikilink-wrap')
    if (!linkEl) return

    const target = linkEl.getAttribute('data-wiki-link-target') || linkEl.getAttribute('data-url')
    if (!target) return

    if (closeTimeout) {
      clearTimeout(closeTimeout)
      closeTimeout = null
    }

    if (currentTarget === target && (hoverCard || hoverTimeout)) return
    currentTarget = target

    if (hoverTimeout) clearTimeout(hoverTimeout)
    hoverTimeout = setTimeout(() => {
      hoverTimeout = null
      if (currentTarget !== target) return

      const { snippets } = getVaultStore()
      const targetLower = target.toLowerCase()

      let note = snippets.find(
        (s) =>
          s.title &&
          (s.title.toLowerCase() === targetLower || s.title.toLowerCase() === `${targetLower}.md`)
      )

      if (note) {
        const rawContent = note.code || ''
        createCard(e.clientX, e.clientY, note.title, rawContent, note.updatedAt, note.id)
      } else {
        createCard(e.clientX, e.clientY, target, null, null, null)
      }
    }, 350)
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

  const handleDocumentMouseMove = (e) => {
    const isOverLink = e.target.closest('.cm-atomic-wiki-link, .cm-atomic-wikilink-wrap')
    const isOverCard = hoverCard && hoverCard.contains(e.target)

    if (isOverLink) {
      if (closeTimeout) {
        clearTimeout(closeTimeout)
        closeTimeout = null
      }
      const target = isOverLink.getAttribute('data-wiki-link-target') || isOverLink.getAttribute('data-url')
      if (target && currentTarget !== target && !hoverCard && !hoverTimeout) {
        handleMouseOver(e)
      }
    } else if (isOverCard) {
      if (closeTimeout) {
        clearTimeout(closeTimeout)
        closeTimeout = null
      }
      if (hoverTimeout) {
        clearTimeout(hoverTimeout)
        hoverTimeout = null
      }
    } else {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout)
        hoverTimeout = null
      }

      if (hoverCard && !closeTimeout) {
        closeTimeout = setTimeout(() => {
          removeCard(true)
        }, 350)
      } else if (!hoverCard && !hoverTimeout && !closeTimeout) {
        currentTarget = null
      }
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && hoverCard) {
      e.preventDefault()
      e.stopPropagation()
      clearTimeout(hoverTimeout)
      removeCard(false) // Keep currentTarget so it doesn't instantly reopen if mouse is still on it
    }
  }

  wrapper.addEventListener('mouseover', handleMouseOver)
  document.addEventListener('mousedown', handleDocumentClick)
  document.addEventListener('mousemove', handleDocumentMouseMove)
  window.addEventListener('keydown', handleKeyDown, true)

  return () => {
    wrapper.removeEventListener('mouseover', handleMouseOver)
    document.removeEventListener('mousedown', handleDocumentClick)
    document.removeEventListener('mousemove', handleDocumentMouseMove)
    window.removeEventListener('keydown', handleKeyDown, true)
    removeCard()
    clearTimeout(hoverTimeout)
    clearTimeout(closeTimeout)
  }
}
