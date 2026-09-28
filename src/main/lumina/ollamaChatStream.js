/**
 * Streams Ollama's NDJSON chat response to the renderer over request-scoped IPC.
 * Kept separate from index.js so provider transport details stay out of app setup.
 */
export function registerOllamaChatStream(ipcMain, net) {
  const activeStreams = new Map()

  ipcMain.on('ollama:chat-cancel', (_event, requestId) => {
    activeStreams.get(requestId)?.abort()
  })

  ipcMain.on('ollama:chat-stream', (event, payload = {}) => {
    const { requestId, url: rawUrl, model, messages, tools, options } = payload
    if (!requestId || activeStreams.has(requestId)) return

    const controller = new AbortController()
    const sender = event.sender
    activeStreams.set(requestId, controller)
    const send = (message) => {
      if (!sender.isDestroyed()) sender.send('ollama:chat-event', { requestId, ...message })
    }

    const onSenderDestroyed = () => controller.abort()
    sender.once('destroyed', onSenderDestroyed)

    void (async () => {
      try {
        const ollamaFetch = typeof net?.fetch === 'function' ? net.fetch.bind(net) : fetch
        let baseUrl = 'http://127.0.0.1:11434'
        try {
          const parsed = new URL(rawUrl || baseUrl)
          baseUrl = `${parsed.protocol}//${parsed.hostname}:${parsed.port || '11434'}`
        } catch {}

        const parsedUrl = new URL(baseUrl)
        const port = parsedUrl.port || '11434'
        const endpoints = [...new Set([
          `${baseUrl}/api/chat`,
          `${parsedUrl.protocol}//127.0.0.1:${port}/api/chat`,
          `${parsedUrl.protocol}//localhost:${port}/api/chat`
        ])]

        let response = null
        let connectionError = ''
        for (const endpoint of endpoints) {
          if (controller.signal.aborted) return
          try {
            response = await ollamaFetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
              body: JSON.stringify({
                model: model || 'llama3',
                messages: Array.isArray(messages) ? messages : [],
                tools: Array.isArray(tools) && tools.length ? tools : undefined,
                stream: true,
                options: options || {}
              }),
              signal: controller.signal
            })
            break
          } catch (error) {
            if (controller.signal.aborted) return
            connectionError = error?.message || String(error)
          }
        }

        if (!response) {
          send({ type: 'headers', status: 503 })
          send({
            type: 'chunk',
            chunk: JSON.stringify({
              error: `Unable to connect to Ollama at ${baseUrl}. ${connectionError || 'Check that Ollama is running and the server URL is correct.'}`
            }) + '\n'
          })
          send({ type: 'done' })
          return
        }

        send({ type: 'headers', status: response.status })
        if (!response.ok) {
          const detail = await response.text().catch(() => '')
          send({ type: 'chunk', chunk: detail || JSON.stringify({ error: `Ollama returned HTTP ${response.status}` }) })
          send({ type: 'done' })
          return
        }

        if (!response.body) {
          send({ type: 'chunk', chunk: JSON.stringify({ error: 'Ollama returned an empty response.' }) + '\n' })
          send({ type: 'done' })
          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        try {
          while (!controller.signal.aborted) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value, { stream: true })
            if (chunk) send({ type: 'chunk', chunk })
          }
          const remaining = decoder.decode()
          if (remaining && !controller.signal.aborted) send({ type: 'chunk', chunk: remaining })
        } finally {
          reader.releaseLock()
        }
        send({ type: 'done', aborted: controller.signal.aborted })
      } catch (error) {
        if (!controller.signal.aborted) {
          send({ type: 'headers', status: 503 })
          send({ type: 'chunk', chunk: JSON.stringify({ error: error?.message || 'Ollama streaming failed.' }) + '\n' })
          send({ type: 'done' })
        }
      } finally {
        activeStreams.delete(requestId)
        sender.removeListener('destroyed', onSenderDestroyed)
      }
    })()
  })
}
