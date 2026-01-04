import { hoverTooltip } from '@codemirror/view'
import { marked } from 'marked'

/**
 * WikiLink Hover Preview - Enhanced Version
 * Shows full snippet content in a scrollable, well-formatted tooltip
 * Last updated: 2026-01-04
 */
export const wikiHoverPreview = (getSnippets, onCreate) =>
  hoverTooltip(
    (view, pos, side) => {
      // 1. Get line
      const line = view.state.doc.lineAt(pos)
      const text = line.text
      const from = line.from

      // 2. Regex scan for link under cursor
      const wikiRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
      let match
      while ((match = wikiRegex.exec(text)) !== null) {
        const start = from + match.index
        const end = start + match[0].length

        // Check overlap
        if (pos >= start && pos <= end) {
          const targetTitle = match[1]
          const isReadOnly = view.state.readOnly // Capture before create function

          return {
            pos: start + 2, // Anchor to the text, not the brackets (fixes hidden bracket issues)
            end: end - 2,
            above: true,
            create(editorView) {
              try {
                const snippets = typeof getSnippets === 'function' ? getSnippets() : []
                const snippet = snippets.find(
                  (s) => s.title.toLowerCase() === targetTitle.toLowerCase()
                )

                const dom = document.createElement('div')
                dom.className = 'cm-wiki-hover'

                if (snippet) {
                  // Header with title
                  const header = document.createElement('div')
                  header.className = 'wiki-hover-header'

                  const title = document.createElement('div')
                  title.className = 'wiki-hover-title'
                  title.textContent = snippet.title

                  // Metadata
                  const raw = snippet.code || ''
                  const wordCount = raw.trim() ? raw.trim().split(/\s+/).length : 0
                  const charCount = raw.length

                  const meta = document.createElement('div')
                  meta.className = 'wiki-hover-meta'
                  meta.textContent = `${wordCount} words · ${charCount} chars`

                  header.appendChild(title)
                  header.appendChild(meta)

                  // Content area
                  const contentWrap = document.createElement('div')
                  contentWrap.className = 'wiki-hover-content-wrap'

                  const content = document.createElement('div')
                  content.className = 'wiki-hover-content markdown-rendered-preview'

                  if (raw.trim()) {
                    content.innerHTML = marked.parse(raw)
                  } else {
                    content.textContent = '(Empty note)'
                    content.style.opacity = '0.4'
                    content.style.fontStyle = 'italic'
                  }

                  contentWrap.appendChild(content)

                  // Footer
                  const footer = document.createElement('div')
                  footer.className = 'wiki-hover-footer'

                  const hint = document.createElement('span')
                  hint.textContent = isReadOnly ? 'Click to open' : 'Ctrl+Click to open'
                  hint.style.opacity = '0.6'

                  footer.appendChild(hint)

                  dom.appendChild(header)
                  dom.appendChild(contentWrap)
                  dom.appendChild(footer)
                } else {
                  // Not found state - MAKE IT INTERACTIVE
                  dom.classList.add('not-found')
                  dom.style.cursor = 'pointer'

                  const notFoundIcon = document.createElement('div')
                  notFoundIcon.className = 'wiki-hover-not-found-icon'
                  notFoundIcon.textContent = '➕'

                  const notFoundText = document.createElement('div')
                  notFoundText.className = 'wiki-hover-not-found-text'
                  notFoundText.textContent = `Create note: "${targetTitle}"`

                  const notFoundHint = document.createElement('div')
                  notFoundHint.className = 'wiki-hover-not-found-hint'
                  notFoundHint.textContent = 'Click to instantly create this note'

                  dom.appendChild(notFoundIcon)
                  dom.appendChild(notFoundText)
                  dom.appendChild(notFoundHint)

                  dom.onclick = () => {
                    if (typeof onCreate === 'function') onCreate(targetTitle)
                  }
                }
                return { dom }
              } catch (err) {
                console.error('WikiHover Error:', err)
                const errDom = document.createElement('div')
                errDom.className = 'cm-wiki-hover error'
                errDom.textContent = 'Error loading preview'
                return { dom: errDom }
              }
            }
          }
        }
      }
      return null
    },
    {
      // Hover configuration
      hoverTime: 300, // Show after 300ms hover
      hideOnChange: true // Hide when document changes
    }
  )
