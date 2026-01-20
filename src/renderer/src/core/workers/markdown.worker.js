import { marked } from 'marked'

/**
 * Custom Extension for WikiLinks [[Title]] or [[Title|Label]]
 */
const wikiLinkExtension = {
  name: 'wikiLink',
  level: 'inline',
  start(src) { return src.indexOf('[[') },
  tokenizer(src, tokens) {
    const rule = /^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/
    const match = rule.exec(src)
    if (match) {
      return {
        type: 'wikiLink',
        raw: match[0],
        title: match[1].trim(),
        label: (match[2] || match[1]).trim()
      }
    }
  },
  renderer(token) {
    return `<a class="preview-wikilink" data-title="${token.title}">${token.label}</a>`
  }
}

// Helper to escape HTML inside code blocks
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Custom renderer to ensure code blocks include language classes and are escaped
const customRenderer = {
  code(code, infostring, escaped) {
    const lang = (infostring || '').trim().split(/\s+/)[0] || ''
    const classAttr = lang ? ` class="language-${lang}"` : ''
    return `<pre><code${classAttr}>${escapeHtml(code)}</code></pre>`
  }
}

marked.use({ extensions: [wikiLinkExtension], renderer: customRenderer })

/**
 * Worker-Thread Markdown Parser
 * Keeps the main thread free for 60fps typing.
 */
self.onmessage = async (e) => {
  const { code, id } = e.data

  try {
    // Heavy lifting happens here
    let source = code || ''

    // If the markdown still contains fenced code blocks, convert them to
    // safe HTML first so they render even if the parser misses them for
    // any reason. This also preserves language classes for styling.
    const fenceRegex = /```(\w+)?\n([\s\S]*?)```/g
    if (fenceRegex.test(source)) {
      source = source.replace(fenceRegex, (m, lang, inner) => {
        const l = (lang || 'text').trim()
        return `<pre><code class="language-${l}">${escapeHtml(inner)}</code></pre>`
      })
    }

    const html = await marked.parse(source || '')
    self.postMessage({ html, id })
  } catch (err) {
    console.error('Markdown Worker Error:', err)
    self.postMessage({ error: 'Failed to parse markdown', id })
  }
}
