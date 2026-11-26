import { marked } from 'marked'
import { renderMermaidToElement } from '../../../core/mermaid'
import { renderPulseLoaderHtml } from '../../../components/PulseLoader'
import hljs from '../../../core/code/hljsCore'
import type { WorkspaceNote } from '../../../core/store/workspaceStore'
import 'highlight.js/styles/atom-one-dark.css'

export interface WikilinkHoverVaultStore {
  notes?: WorkspaceNote[]
  snippets?: WorkspaceNote[]
  saveNote?: (note: WorkspaceNote) => Promise<unknown> | unknown
  setSelectedNote?: (note: WorkspaceNote | null) => void
}

interface RectLike {
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number
}

type LinkAnchor = Element | RectLike | null | undefined

interface AssetReadResult {
  dataUrl?: string
  buffer?: BlobPart
  mimeType?: string
}

export function setupWikilinkHover(
  wrapper: HTMLElement,
  getVaultStore: () => WikilinkHoverVaultStore
): () => void {
  let hoverCard: HTMLDivElement | null = null
  let hoverTimeout: ReturnType<typeof setTimeout> | null = null
  let closeTimeout: ReturnType<typeof setTimeout> | null = null
  let currentTarget: string | null = null
  let activeHoverEl: Element | null = null

  const removeCard = (resetTarget = true): void => {
    if (hoverCard) {
      if (hoverCard.parentNode) {
        hoverCard.parentNode.removeChild(hoverCard)
      } else if (typeof hoverCard.remove === 'function') {
        hoverCard.remove()
      }
      hoverCard = null
    }
    activeHoverEl = null
    if (resetTarget) {
      currentTarget = null
    }
    if (closeTimeout) {
      clearTimeout(closeTimeout)
      closeTimeout = null
    }
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
      hoverTimeout = null
    }
  }

  const createCard = (
    linkEl: LinkAnchor,
    title: string,
    contentSnippet: string | null | undefined,
    _timestamp: unknown,
    noteId: string | null | undefined
  ): void => {
    removeCard(false)

    hoverCard = document.createElement('div')
    hoverCard.className = 'cm-wiki-hover horizontal'
    hoverCard.style.position = 'fixed'
    hoverCard.style.borderRadius = '5px'
    hoverCard.style.visibility = 'hidden'

    if (contentSnippet !== null && contentSnippet !== undefined) {
      const header = document.createElement('div')
      header.className = 'wiki-hover-header horizontal'
      header.style.display = 'flex'
      header.style.alignItems = 'center'
      header.style.justifyContent = 'space-between'
      header.style.padding = '8px 12px'
      header.style.flexShrink = '0'

      const headerTitle = document.createElement('div')
      headerTitle.textContent = title
      headerTitle.title = title
      headerTitle.style.fontSize = '12.5px'
      headerTitle.style.fontWeight = '600'
      headerTitle.style.lineHeight = '1.3'
      headerTitle.style.color = 'var(--text-main)'
      headerTitle.style.overflow = 'hidden'
      headerTitle.style.textOverflow = 'ellipsis'
      headerTitle.style.whiteSpace = 'nowrap'
      headerTitle.style.flex = '1'
      headerTitle.style.minWidth = '0'

      header.appendChild(headerTitle)

      if (noteId) {
        const expandIcon = document.createElement('div')
        expandIcon.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`
        expandIcon.style.display = 'flex'
        expandIcon.style.alignItems = 'center'
        expandIcon.style.justifyContent = 'center'
        expandIcon.style.cursor = 'pointer'
        expandIcon.style.color = 'var(--text-muted)'
        expandIcon.style.transition = 'all 0.14s ease'
        expandIcon.style.marginLeft = '8px'
        expandIcon.style.width = '22px'
        expandIcon.style.height = '22px'
        expandIcon.style.borderRadius = '5px'

        expandIcon.onmouseover = () => {
          expandIcon.style.color = 'var(--accent-color, var(--text-accent))'
          expandIcon.style.background = 'var(--bg-hover)'
        }
        expandIcon.onmouseout = () => {
          expandIcon.style.color = 'var(--text-muted)'
          expandIcon.style.background = 'transparent'
        }

        expandIcon.addEventListener('click', (evt: MouseEvent) => {
          evt.preventDefault()
          evt.stopPropagation()
          const { notes, setSelectedNote } = getVaultStore()
          const targetNote = notes?.find((s) => s.id === noteId)
          if (targetNote && setSelectedNote) {
            setSelectedNote(targetNote)
            removeCard()
          }
        })

        header.appendChild(expandIcon)
      }

      hoverCard.appendChild(header)

      const contentWrap = document.createElement('div')
      contentWrap.className = 'wiki-hover-content-wrap'
      contentWrap.style.padding = '4px 12px 12px 12px'

      const contentEl = document.createElement('div')
      contentEl.className = 'wiki-hover-content'

      let parsedSnippet = String(contentSnippet || '')
      const lines = parsedSnippet.split('\n')
      if (lines.length > 15) {
        parsedSnippet = lines.slice(0, 15).join('\n') + '\n\n...'
      }

      parsedSnippet = parsedSnippet.replace(
        /\[\[(.*?)\]\]/g,
        '<span class="cm-atomic-wiki-link">$1</span>'
      )
      contentEl.innerHTML = marked.parse(parsedSnippet) as string

      const allImages = contentEl.querySelectorAll('img')
      allImages.forEach((img) => {
        const url = img.getAttribute('src')
        img.style.maxWidth = '100%'
        img.style.borderRadius = '5px'
        img.style.marginTop = '8px'

        if (url && !url.startsWith('http') && !url.startsWith('data:')) {
          const cleanUrl = url.startsWith('/') ? url.slice(1) : url
          img.src = ''
          window.api
            ?.readAsset(cleanUrl)
            .then((res: AssetReadResult | null | undefined) => {
              if (res?.dataUrl) {
                img.src = res.dataUrl
              } else if (res?.buffer) {
                const blob = new Blob([res.buffer], { type: res.mimeType || 'image/png' })
                img.src = URL.createObjectURL(blob)
              }
            })
            .catch((err: unknown) => {
              console.error('[HoverCard] Failed to load image asset:', err)
              img.alt = '❌ Failed to load image'
            })
        }
      })

      contentWrap.appendChild(contentEl)
      hoverCard.appendChild(contentWrap)

      const mermaidBlocks = contentEl.querySelectorAll('code.language-mermaid')
      if (mermaidBlocks.length > 0) {
        mermaidBlocks.forEach((block, idx) => {
          const code = block.textContent || ''
          const id = `hover-mermaid-${Date.now()}-${idx}`
          const pre = block.parentElement

          const widgetWrap = document.createElement('div')
          widgetWrap.className = 'cm-mermaid-widget'
          widgetWrap.style.margin = '10px 0'
          widgetWrap.style.borderRadius = '5px'

          const scrollWrap = document.createElement('div')
          scrollWrap.className = 'mermaid-scroll-wrap'

          const contentDiv = document.createElement('div')
          contentDiv.className = 'mermaid-content'

          contentDiv.innerHTML = `<div class="mermaid-loading">${renderPulseLoaderHtml('Rendering Graph...', 'xs', true)}</div>`

          scrollWrap.appendChild(contentDiv)
          widgetWrap.appendChild(scrollWrap)
          pre?.replaceWith(widgetWrap)

          renderMermaidToElement(contentDiv, code, id)
        })
      }

      const allCodeBlocks = contentEl.querySelectorAll<HTMLElement>('pre > code')
      allCodeBlocks.forEach((codeEl) => {
        if (codeEl.classList.contains('language-mermaid')) return

        const pre = codeEl.parentElement as HTMLElement | null
        if (!pre || !pre.parentNode) return

        let lang = 'text'
        codeEl.classList.forEach((cls) => {
          if (cls.startsWith('language-')) {
            lang = cls.replace('language-', '')
          }
        })

        const codeWrapper = document.createElement('div')
        codeWrapper.className = 'hover-code-wrapper'
        codeWrapper.style.display = 'block'
        codeWrapper.style.marginTop = '12px'
        codeWrapper.style.marginBottom = '12px'
        codeWrapper.style.borderRadius = '5px'
        codeWrapper.style.overflow = 'hidden'
        codeWrapper.style.background = 'var(--bg-surface, var(--bg-editor))'
        codeWrapper.style.border = '1px solid var(--border-color, var(--border-dim))'

        const codeHeader = document.createElement('div')
        codeHeader.style.position = 'relative'
        codeHeader.style.height = '32px'
        codeHeader.style.background = 'rgba(0,0,0,0.2)'
        codeHeader.style.borderBottom = '1px solid var(--border-dim, rgba(255,255,255,0.05))'
        codeHeader.style.display = 'flex'
        codeHeader.style.alignItems = 'center'
        codeHeader.style.justifyContent = 'flex-end'
        codeHeader.style.padding = '0 12px'

        const langPill = document.createElement('span')
        langPill.textContent = lang.toUpperCase()
        langPill.style.fontSize = '10px'
        langPill.style.fontWeight = '600'
        langPill.style.color = 'var(--text-muted, rgba(255, 255, 255, 0.4))'
        langPill.style.background = 'rgba(255, 255, 255, 0.05)'
        langPill.style.padding = '4px 10px'
        langPill.style.borderRadius = '2px'
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

        langPill.onclick = (e: MouseEvent) => {
          e.stopPropagation()
          void navigator.clipboard.writeText(codeEl.textContent || '')

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
        codeHeader.appendChild(langPill)

        codeWrapper.appendChild(codeHeader)
        if (pre.parentNode) {
          pre.replaceWith(codeWrapper)
          codeWrapper.appendChild(pre)
        } else {
          codeWrapper.appendChild(pre)
        }

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

        if (lang !== 'text' && !hljs.getLanguage(lang)) {
          codeEl.classList.remove(`language-${lang}`)
          codeEl.classList.add('nohighlight')
        }

        try {
          hljs.highlightElement(codeEl)
        } catch (err) {
          console.warn('Failed to highlight code block in hover card', err)
        }

        pre.addEventListener('click', (e: MouseEvent) => {
          if (e.offsetY < 30 && e.offsetX > pre.offsetWidth - 60) {
            e.preventDefault()
            e.stopPropagation()
            void navigator.clipboard.writeText(codeEl.textContent || '')
            pre.classList.add('cb-copied')
            setTimeout(() => pre.classList.remove('cb-copied'), 2000)
          }
        })
      })

      if (noteId) {
        hoverCard.dataset.noteId = noteId
      }
    } else {
      hoverCard.className = 'cm-wiki-hover rename-modal-style not-found-modal'
      hoverCard.style.borderRadius = '5px'

      const contentBox = document.createElement('div')
      contentBox.className = 'not-found-rename-box'

      const titleEl = document.createElement('div')
      titleEl.className = 'not-found-rename-title'
      titleEl.textContent = title
      titleEl.title = title

      const subtitleEl = document.createElement('div')
      subtitleEl.className = 'not-found-rename-subtitle'
      subtitleEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M12 5v14M5 12h14"/></svg><span>Click to create note</span>`

      contentBox.appendChild(titleEl)
      contentBox.appendChild(subtitleEl)
      hoverCard.appendChild(contentBox)

      contentBox.addEventListener('click', async (evt: MouseEvent) => {
        evt.preventDefault()
        evt.stopPropagation()
        try {
          const { notes, saveNote, setSelectedNote } = getVaultStore()
          const targetLower = title.toLowerCase()
          let targetSnippet = notes?.find(
            (s) =>
              s.title &&
              (s.title.toLowerCase() === targetLower ||
                s.title.toLowerCase() === `${targetLower}.md`)
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
            if (saveNote) await saveNote(targetSnippet)
          }
          if (setSelectedNote) setSelectedNote(targetSnippet)
          removeCard()
        } catch (err) {
          console.error('Failed to create note from hover card:', err)
        }
      })
    }

    document.body.appendChild(hoverCard)

    const wrapperRect = wrapper.getBoundingClientRect()
    const contentEl = wrapper.querySelector('.cm-content') || wrapper
    const contentRect = contentEl.getBoundingClientRect()

    let linkRect: RectLike
    if (linkEl && 'getBoundingClientRect' in linkEl && typeof linkEl.getBoundingClientRect === 'function') {
      linkRect = linkEl.getBoundingClientRect()
    } else if (linkEl && 'left' in linkEl && typeof linkEl.left === 'number') {
      linkRect = linkEl
    } else {
      linkRect = {
        left: wrapperRect.left + 20,
        right: wrapperRect.left + 100,
        top: wrapperRect.top + 20,
        bottom: wrapperRect.top + 40,
        width: 80,
        height: 20
      }
    }

    const maxAllowedWidth = Math.max(220, Math.min(510, contentRect.width, wrapperRect.width - 24))
    hoverCard.style.maxWidth = `${maxAllowedWidth}px`
    if (contentRect.width < 510) {
      hoverCard.style.minWidth = 'auto'
      hoverCard.style.whiteSpace = 'normal'
    }

    const rect = hoverCard.getBoundingClientRect()

    let left = linkRect.left

    const maxRight = Math.min(window.innerWidth - 12, contentRect.right, wrapperRect.right - 12)
    if (left + rect.width > maxRight) {
      left = maxRight - rect.width
    }

    const minLeft = Math.max(12, contentRect.left, wrapperRect.left + 12)
    if (left < minLeft) {
      left = minLeft
    }

    let top = linkRect.bottom + 6

    const bottomLimit = Math.min(window.innerHeight - 12, wrapperRect.bottom - 12)
    const topLimit = Math.max(12, wrapperRect.top + 12)

    if (top + rect.height > bottomLimit) {
      top = linkRect.top - rect.height - 6
      if (top < topLimit) {
        top = topLimit
      }
    }

    hoverCard.addEventListener('mouseenter', () => {
      if (closeTimeout) {
        clearTimeout(closeTimeout)
        closeTimeout = null
      }
    })

    hoverCard.addEventListener('mouseleave', (e: MouseEvent) => {
      const related = e.relatedTarget
      if (
        related instanceof Element &&
        related.closest('.cm-atomic-wiki-link, .cm-atomic-wikilink-wrap') === activeHoverEl
      ) {
        return
      }
      if (!closeTimeout) {
        closeTimeout = setTimeout(() => {
          removeCard(true)
        }, 300)
      }
    })

    hoverCard.style.top = `${Math.round(top)}px`
    hoverCard.style.left = `${Math.round(left)}px`
    hoverCard.style.visibility = 'visible'
  }

  const triggerHoverForTarget = (linkEl: Element, target: string): void => {
    if (!target) return
    const vault = getVaultStore()
    const notes = vault?.notes || vault?.snippets || []
    const targetLower = target.toLowerCase()

    const note = notes?.find((s) => {
      if (!s.title) return false
      const titleLower = s.title.toLowerCase()
      const fullPathLower = s.folderId ? `${s.folderId}/${s.title}`.toLowerCase() : titleLower
      return (
        titleLower === targetLower ||
        titleLower === `${targetLower}.md` ||
        fullPathLower === targetLower ||
        fullPathLower === `${targetLower}.md`
      )
    })

    if (note) {
      const rawContent = note.code || ''
      createCard(linkEl, note.title || target, rawContent, note.updatedAt, note.id)
    } else {
      createCard(linkEl, target, null, null, null)
    }
  }

  const handleMouseOver = (e: MouseEvent): void => {
    const targetNode = e.target
    if (!(targetNode instanceof Element)) return
    const linkEl = targetNode.closest('.cm-atomic-wiki-link, .cm-atomic-wikilink-wrap, [data-wiki-link-target]')
    if (!linkEl || !wrapper.contains(linkEl)) return

    if (linkEl.classList.contains('cm-atomic-wiki-link-active') || linkEl.closest('.cm-atomic-wiki-link-active')) {
      return
    }

    const target =
      linkEl.getAttribute('data-wiki-link-target') ||
      linkEl.getAttribute('data-url') ||
      linkEl.textContent?.replace(/^\[\[|\]\]$/g, '').trim()
    if (!target) return

    activeHoverEl = linkEl

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
      triggerHoverForTarget(linkEl, target)
    }, 200)
  }

  const handleMouseOut = (e: MouseEvent): void => {
    const targetNode = e.target
    if (!(targetNode instanceof Element)) return
    const linkEl = targetNode.closest('.cm-atomic-wiki-link, .cm-atomic-wikilink-wrap, [data-wiki-link-target]')
    if (!linkEl) return

    const related = e.relatedTarget
    if (
      related instanceof Node &&
      (hoverCard?.contains(related) || (related instanceof Element && related.closest('.cm-wiki-hover')))
    ) {
      return
    }

    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
      hoverTimeout = null
    }

    if (hoverCard && !closeTimeout) {
      closeTimeout = setTimeout(() => {
        removeCard(true)
      }, 300)
    }
  }

  const handleDocumentPointerDown = (e: Event): void => {
    const targetNode = e.target
    if (hoverCard && targetNode instanceof Node && hoverCard.contains(targetNode)) {
      return
    }
    if (hoverCard || hoverTimeout || closeTimeout) {
      removeCard(true)
    }
  }

  const handleWindowBlur = (): void => {
    if (hoverCard || hoverTimeout || closeTimeout) {
      removeCard(true)
    }
  }

  const handleKeyDown = (e: KeyboardEvent): void => {
    if (!hoverCard) return

    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      if (hoverTimeout) clearTimeout(hoverTimeout)
      removeCard(false)
      return
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'PageDown' || e.key === 'PageUp') {
      const scrollWrap = hoverCard.querySelector('.wiki-hover-content-wrap') || hoverCard
      const scrollAmount = e.key === 'PageDown' || e.key === 'PageUp' ? 160 : 40

      if (scrollWrap) {
        if (e.key === 'ArrowDown' || e.key === 'PageDown') {
          scrollWrap.scrollTop += scrollAmount
        } else {
          scrollWrap.scrollTop -= scrollAmount
        }
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
      }
    }
  }

  const handleCloseHoverCard = (): void => {
    if (hoverCard) {
      if (hoverTimeout) clearTimeout(hoverTimeout)
      removeCard(false)
    }
  }

  wrapper.addEventListener('mouseover', handleMouseOver)
  wrapper.addEventListener('mouseout', handleMouseOut)
  document.addEventListener('pointerdown', handleDocumentPointerDown, true)
  document.addEventListener('mousedown', handleDocumentPointerDown, true)
  document.addEventListener('keydown', handleKeyDown, true)
  window.addEventListener('blur', handleWindowBlur)
  window.addEventListener('close-hover-card', handleCloseHoverCard)

  return () => {
    wrapper.removeEventListener('mouseover', handleMouseOver)
    wrapper.removeEventListener('mouseout', handleMouseOut)
    document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
    document.removeEventListener('mousedown', handleDocumentPointerDown, true)
    document.removeEventListener('keydown', handleKeyDown, true)
    window.removeEventListener('blur', handleWindowBlur)
    window.removeEventListener('close-hover-card', handleCloseHoverCard)
    removeCard()
    if (hoverTimeout) clearTimeout(hoverTimeout)
    if (closeTimeout) clearTimeout(closeTimeout)
  }
}

export default setupWikilinkHover
