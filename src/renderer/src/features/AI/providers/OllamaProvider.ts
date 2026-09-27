import { BaseProvider } from './BaseProvider'
import type { ProviderConfig } from '../types/ai.types'
import type { ChatMessageParam, ChatStreamOptions } from './BaseProvider'

/**
 * Normalizes Ollama endpoint URLs to ensure they use IPv4 (127.0.0.1)
 * to avoid Windows IPv6 localhost ([::1]) binding issues, and targets the `/api/chat` endpoint.
 */
export function normalizeOllamaUrl(rawUrl?: string): string {
  if (!rawUrl) return 'http://127.0.0.1:11434/api/chat'
  let urlStr = rawUrl.trim()
  if (!urlStr) return 'http://127.0.0.1:11434/api/chat'

  if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
    urlStr = `http://${urlStr}`
  }

  // Replace localhost with 127.0.0.1 to avoid Windows IPv6 [::1] connection refused
  urlStr = urlStr.replace(/^http:\/\/localhost(?=[:/]|$)/i, 'http://127.0.0.1')
  urlStr = urlStr.replace(/^https:\/\/localhost(?=[:/]|$)/i, 'https://127.0.0.1')

  try {
    const parsed = new URL(urlStr)
    const host = parsed.hostname === 'localhost' ? '127.0.0.1' : parsed.hostname
    const port = parsed.port || '11434'
    let pathname = parsed.pathname
    if (!pathname || pathname === '/' || pathname === '') {
      pathname = '/api/chat'
    } else if (!pathname.endsWith('/api/chat')) {
      pathname = pathname.replace(/\/+$/, '') + '/api/chat'
    }
    return `${parsed.protocol}//${host}:${port}${pathname}`
  } catch {
    return 'http://127.0.0.1:11434/api/chat'
  }
}

/**
 * Ollama Provider.
 * Streams chat completions locally using Ollama's /api/chat NDJSON endpoint,
 * with automatic IPv4 normalization and Electron Main Process IPC fallback.
 */
export class OllamaProvider extends BaseProvider {
  constructor(config: ProviderConfig = {}) {
    super(config)
    this.baseUrl = normalizeOllamaUrl(config.baseUrl)
    this.defaultModel = config.activeModel || (config as any).model || 'llama3'
    this.id = 'ollama'
    this.name = 'Ollama (Local)'
  }

  async *chatStream(
    messages: ChatMessageParam[],
    options: ChatStreamOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    const targetModel = options.model || this.defaultModel
    const chatUrl = normalizeOllamaUrl(this.baseUrl)

    let response: Response | null = null
    let directFetchFailed = false

    try {
      response = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: targetModel,
          messages: messages,
          stream: true,
          options: {
            num_predict: options.max_tokens || 4096
          }
        }),
        signal: options.signal
      })
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err
      directFetchFailed = true
    }

    // Fallback: If direct renderer fetch fails (e.g. CORS restrictions or socket errors),
    // query Ollama via the Electron Main Process IPC bridge which runs in Node.js
    if (directFetchFailed || !response) {
      const api = (window as any)?.api
      if (api && typeof api.chatOllama === 'function') {
        const ipcRes = await api.chatOllama({
          url: chatUrl,
          model: targetModel,
          messages: messages,
          options: {
            num_predict: options.max_tokens || 4096
          }
        })

        if (options.signal?.aborted) return

        if (ipcRes?.ok && typeof ipcRes.content === 'string') {
          yield ipcRes.content
          return
        }

        if (ipcRes?.error) {
          throw new Error(ipcRes.error)
        }
      }

      throw new Error(
        'Ollama server is not running. Please start Ollama on your computer to chat.'
      )
    }

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          `Model "${targetModel}" was not found in Ollama. Pull it in terminal with "ollama pull ${targetModel}" or select an installed model in Settings.`
        )
      }
      throw new Error(`Ollama Error (${response.status})`)
    }

    if (!response.body) {
      throw new Error('Response body is null')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const parsed = JSON.parse(trimmed)
            if (parsed.message?.content) {
              yield parsed.message.content
            }
            if (parsed.done) return
          } catch (e) {
            console.warn('Ollama parse error:', e)
          }
        }
      }

      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer.trim())
          if (parsed.message?.content) {
            yield parsed.message.content
          }
        } catch {
          // ignore
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}
