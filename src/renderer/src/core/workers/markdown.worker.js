import { marked } from 'marked'

/**
 * Worker-Thread Markdown Parser
 * Keeps the main thread free for 60fps typing.
 */
self.onmessage = async (e) => {
  const { code, id } = e.data

  try {
    // Heavy lifting happens here
    const html = marked.parse(code || '')
    self.postMessage({ html, id })
  } catch (err) {
    self.postMessage({ error: 'Failed to parse markdown', id })
  }
}
