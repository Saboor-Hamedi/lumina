import { hoverTooltip } from '@codemirror/view'
import { marked } from 'marked'

/**
 * WikiLink Hover Preview - Enhanced Robust Version
 * Renders full markdown and handles nested links/WikiLinks
 */
export const wikiHoverPreview = (getSnippets, onNavigate, onCreate) =>
  hoverTooltip((view, pos, side) => {
    const line = view.state.doc.lineAt(pos)
    const text = line.text
    const from = line.from

    const wikiRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
    let match
    while ((match = wikiRegex.exec(text)) !== null) {
      const start = from + match.index
      const end = start + match[0].length

      if (pos >= start && pos <= end) {
        const targetTitle = match[1]

        return {
          pos: start,
          end,
          above: false,
          create(view) {
            const snippets = typeof getSnippets === 'function' ? getSnippets() : []
            const snippet = snippets.find(
              (s) => s.title.toLowerCase() === targetTitle.toLowerCase()
            )

            const dom = document.createElement('div')
            dom.className = 'cm-wiki-hover'

            if (snippet) {
              // Header
              const header = document.createElement('div')
              header.className = 'wiki-hover-header'

              const title = document.createElement('div')
              title.className = 'wiki-hover-title'
              title.textContent = snippet.title

              const meta = document.createElement('div')
              meta.className = 'wiki-hover-meta'
              const len = (snippet.code || '').length
              meta.textContent = `${snippet.language || 'md'} · ${len} chars`

              header.appendChild(title)
              header.appendChild(meta)
              dom.appendChild(header)

              // Render Content
              const contentWrap = document.createElement('div')
              contentWrap.className = 'wiki-hover-content-wrap'

              const content = document.createElement('div')
              content.className = 'wiki-hover-content markdown-rendered-preview'

              // Process WikiLinks and @[links] inside the preview content
              let html = marked.parse(snippet.code || '')
              // Turn [[Link]] into clickable spans
              html = html.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, p1, p2) => {
                return `<span class="preview-wikilink" data-target="${p1}">${p2 || p1}</span>`
              })
              // Turn @[Path] into clickable spans
              html = html.replace(/@\[([^\]]+)\]/g, (match, p1) => {
                const target = p1.includes('/') ? p1.split('/').pop().replace(/\.md$/, '') : p1
                return `<span class="preview-wikilink" data-target="${target}">${p1}</span>`
              })

              content.innerHTML = html
              contentWrap.appendChild(content)
              dom.appendChild(contentWrap)

              // Interaction Handler
              dom.addEventListener('click', (e) => {
                const wikiLink = e.target.closest('.preview-wikilink')
                if (wikiLink) {
                  const target = wikiLink.getAttribute('data-target')
                  const targetSnippet = snippets.find(
                    (s) => s.title.toLowerCase() === target.toLowerCase()
                  )
                  if (targetSnippet && onNavigate) {
                    onNavigate(targetSnippet)
                  }
                  return
                }

                // If clicking footer or empty space, maybe navigate to the main snippet
                if (e.target.closest('.wiki-hover-footer') || e.target === dom) {
                  if (onNavigate) onNavigate(snippet)
                }
              })

              // Footer
              const footer = document.createElement('div')
              footer.className = 'wiki-hover-footer'
              footer.textContent = 'Click to open note'
              dom.appendChild(footer)
            } else {
              dom.classList.add('not-found')
              dom.style.padding = '12px'
              dom.innerHTML = `<div style="font-weight:700;margin-bottom:4px;">Note not found</div>
                                 <div style="font-size:11px;opacity:0.6;margin-bottom:8px;">"${targetTitle}" does not exist yet.</div>
                                 <button class="create-note-btn">Create Note</button>`

              const btn = dom.querySelector('.create-note-btn')
              if (btn) {
                btn.onclick = () => onCreate && onCreate(targetTitle)
              }
            }
            return { dom }
          }
        }
      }
    }
    return null
  })
