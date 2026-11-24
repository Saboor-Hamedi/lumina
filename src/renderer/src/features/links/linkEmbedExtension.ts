/**
 * CodeMirror 6 Link & YouTube Embed Card Extension (`linkEmbedExtension.ts`)
 *
 * When a line contains a standalone external URL (`https://...` or `[Label](https://...)`)
 * and the caret is NOT on that line:
 * - YouTube URLs render as a compact cinema preview card (thumbnail + play badge + title).
 *   Clicking opens the borderless 16:9 YouTube iframe modal.
 * - Regular website URLs render as a sleek bookmark card (title, description, domain, favicon, OG thumbnail).
 *   Clicking opens the link in the default browser.
 *
 * Moving the cursor onto the line (or clicking the Edit icon) reveals the raw Markdown URL immediately.
 */

import { RangeSetBuilder, StateField, type EditorState, type Extension } from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'
import { isInsideCodeFence } from '../../core/editor/useList'
import {
  extractDomain,
  extractYouTubeId,
  getYouTubeThumbnailUrl,
  parseStandaloneLinkLine
} from './urlParser'
import { fetchLinkMetadata, getCachedLinkMetadata } from './linkMetadata'
import { handleExternalLinkClick, openYouTubeModal } from './youtubeModal'
import './linkEmbed.css'

class LinkCardWidget extends WidgetType {
  readonly url: string
  readonly label?: string
  readonly youtubeId: string | null
  readonly lineFrom: number

  constructor(url: string, label: string | undefined, youtubeId: string | null, lineFrom: number) {
    super()
    this.url = url
    this.label = label
    this.youtubeId = youtubeId
    this.lineFrom = lineFrom
  }

  eq(other: LinkCardWidget): boolean {
    return (
      other.url === this.url &&
      other.label === this.label &&
      other.youtubeId === this.youtubeId
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const card = document.createElement('div')
    card.className = this.youtubeId ? 'lumina-link-card is-youtube' : 'lumina-link-card is-website'
    card.setAttribute('contenteditable', 'false')
    card.setAttribute('role', 'button')
    card.setAttribute('tabindex', '0')

    const domain = extractDomain(this.url)
    const cached = getCachedLinkMetadata(this.url)

    // Left / Media Thumbnail (always shown for YouTube; shown for websites when OG image exists)
    let thumbWrap: HTMLElement | null = null
    if (this.youtubeId) {
      thumbWrap = document.createElement('div')
      thumbWrap.className = 'lumina-link-card-thumb is-yt-thumb'

      const img = document.createElement('img')
      img.src = getYouTubeThumbnailUrl(this.youtubeId)
      img.alt = this.label || 'YouTube thumbnail'
      img.loading = 'lazy'
      thumbWrap.appendChild(img)

      const playBadge = document.createElement('span')
      playBadge.className = 'lumina-yt-play-badge'
      playBadge.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>`
      thumbWrap.appendChild(playBadge)
      card.appendChild(thumbWrap)
    }

    // Main Text Body
    const body = document.createElement('div')
    body.className = 'lumina-link-card-body'

    const titleEl = document.createElement('div')
    titleEl.className = 'lumina-link-card-title'
    titleEl.textContent = this.label || cached?.title || (this.youtubeId ? 'YouTube Video' : domain)
    body.appendChild(titleEl)

    const descEl = document.createElement('div')
    descEl.className = 'lumina-link-card-desc'
    if (cached?.description) {
      descEl.textContent = cached.description
    } else if (this.youtubeId) {
      descEl.textContent = 'Click to watch in borderless player'
    } else {
      descEl.textContent = this.url
    }
    body.appendChild(descEl)

    const metaRow = document.createElement('div')
    metaRow.className = 'lumina-link-card-meta'

    if (cached?.favicon && !this.youtubeId) {
      const fav = document.createElement('img')
      fav.className = 'lumina-link-card-favicon'
      fav.src = cached.favicon
      fav.alt = ''
      fav.onerror = () => fav.remove()
      metaRow.appendChild(fav)
    }

    const domainEl = document.createElement('span')
    domainEl.textContent = this.youtubeId ? 'youtube.com' : (cached?.site_name || domain)
    metaRow.appendChild(domainEl)
    body.appendChild(metaRow)
    card.appendChild(body)

    // Website OG thumbnail on the right (when available)
    const ogThumbWrap = document.createElement('div')
    ogThumbWrap.className = 'lumina-link-card-og-thumb'
    if (!this.youtubeId && cached?.image) {
      const ogImg = document.createElement('img')
      ogImg.src = cached.image
      ogImg.alt = ''
      ogImg.loading = 'lazy'
      ogImg.onerror = () => ogThumbWrap.remove()
      ogThumbWrap.appendChild(ogImg)
      card.appendChild(ogThumbWrap)
    }

    // Subtle hover edit button so user can jump straight to raw URL editing
    const editBtn = document.createElement('button')
    editBtn.type = 'button'
    editBtn.className = 'lumina-link-card-edit'
    editBtn.title = 'Edit URL'
    editBtn.setAttribute('aria-label', 'Edit URL')
    editBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`
    editBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const pos = view.posAtDOM(card)
      const targetPos = typeof pos === 'number' ? pos : this.lineFrom
      view.dispatch({
        selection: { anchor: Math.min(targetPos, view.state.doc.length) },
        scrollIntoView: true
      })
      view.focus()
    })
    card.appendChild(editBtn)

    const activate = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
      if (this.youtubeId) {
        openYouTubeModal(this.url, titleEl.textContent || undefined)
      } else {
        handleExternalLinkClick(this.url, titleEl.textContent || undefined)
      }
    }

    card.addEventListener('click', activate)
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') activate(e)
    })

    // Lazily enrich title / description / OG image via Rust metadata fetcher
    if (!cached) {
      void fetchLinkMetadata(this.url).then((meta) => {
        if (!card.isConnected) return
        if (!this.label && meta.title) {
          titleEl.textContent = meta.title
        }
        if (meta.description && !this.youtubeId) {
          descEl.textContent = meta.description
        }
        if (meta.site_name && !this.youtubeId) {
          domainEl.textContent = meta.site_name
        }
        if (meta.image && !this.youtubeId && !ogThumbWrap.parentElement) {
          const ogImg = document.createElement('img')
          ogImg.src = meta.image
          ogImg.alt = ''
          ogImg.loading = 'lazy'
          ogImg.onerror = () => ogThumbWrap.remove()
          ogThumbWrap.appendChild(ogImg)
          card.insertBefore(ogThumbWrap, editBtn)
        }
      })
    }

    return card
  }

  ignoreEvent(): boolean {
    return true
  }
}

function buildLinkEmbedDecorations(state: EditorState) {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = state.doc
  const sel = state.selection.main
  const activeStartLine = doc.lineAt(sel.from).number
  const activeEndLine = doc.lineAt(sel.to).number

  for (let l = 1; l <= doc.lines; l++) {
    // Reveal raw markdown when cursor or selection touches this line
    if (l >= activeStartLine && l <= activeEndLine) continue

    const line = doc.line(l)
    if (!line.text.includes('http://') && !line.text.includes('https://')) continue
    if (isInsideCodeFence(state, line.from)) continue

    const parsed = parseStandaloneLinkLine(line.text)
    if (!parsed) continue

    const ytId = extractYouTubeId(parsed.url)
    builder.add(
      line.from,
      line.to,
      Decoration.replace({
        widget: new LinkCardWidget(parsed.url, parsed.label, ytId, line.from)
      })
    )
  }

  return builder.finish()
}

export const linkEmbedExtension: Extension = StateField.define({
  create(state) {
    return buildLinkEmbedDecorations(state)
  },
  update(decos, tr) {
    if (tr.docChanged || tr.selection) {
      return buildLinkEmbedDecorations(tr.state)
    }
    return decos.map(tr.changes)
  },
  provide: (f) => EditorView.decorations.from(f)
})

export default linkEmbedExtension
