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

marked.use({ extensions: [wikiLinkExtension] })

/**
 * Worker-Thread Markdown Parser
 * Keeps the main thread free for 60fps typing.
 */
self.onmessage = async (e) => {
  const { code, id } = e.data

  try {
    // Heavy lifting happens here
    const html = await marked.parse(code || '')
    self.postMessage({ html, id })
  } catch (err) {
    console.error('Markdown Worker Error:', err)
    self.postMessage({ error: 'Failed to parse markdown', id })
  }
}
