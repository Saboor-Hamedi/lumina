import { BaseProvider } from './BaseProvider'
import type { ProviderConfig } from '../types/ai.types'
import type { ChatMessageParam, ChatStreamOptions } from './BaseProvider'

/**
 * Ollama Provider.
 * Streams chat completions locally using Ollama's /api/chat NDJSON endpoint.
 */
export class OllamaProvider extends BaseProvider {
  constructor(config: ProviderConfig = {}) {
    super(config)
    this.baseUrl = config.baseUrl || 'http://localhost:11434/api/chat'
    this.defaultModel = 'llama3'
    this.id = 'ollama'
    this.name = 'Ollama (Local)'
  }

  async *chatStream(
    messages: ChatMessageParam[],
    options: ChatStreamOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options.model || this.defaultModel,
        messages: messages,
        stream: true,
        options: {
          num_predict: options.max_tokens || 4096
        }
      }),
      signal: options.signal
    })

    if (!response.ok) {
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
