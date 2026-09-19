import type { ProviderConfig } from '../types/ai.types'

export interface ChatMessageParam {
  role: string
  content: string
  [key: string]: unknown
}

export interface ChatStreamOptions {
  signal?: AbortSignal
  model?: string
  temperature?: number
  max_tokens?: number
  [key: string]: unknown
}

/**
 * Base abstract class for AI Providers.
 * Ensures consistent behavior across different models (DeepSeek, OpenAI, Claude, etc).
 */
export class BaseProvider {
  public config: ProviderConfig
  public baseUrl: string
  public defaultModel: string
  public id: string = ''
  public name: string = ''

  constructor(config: ProviderConfig = {}) {
    this.config = config
    this.baseUrl = ''
    this.defaultModel = ''
  }

  /**
   * Main generation function. Must be implemented by subclasses.
   * @param messages - Chat history [{role, content}]
   * @param options - { signal, model, temperature, ... }
   * @yields Streamed text chunks
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async *chatStream(messages: ChatMessageParam[], options: ChatStreamOptions = {}): AsyncGenerator<string, void, unknown> {
    throw new Error('Method not implemented')
  }

  /**
   * Validate if the provider is ready (has key, etc)
   */
  isConfigured(): boolean {
    return !!this.config.apiKey
  }

  /**
   * Helper to parse SSE streams (Server-Sent Events) with buffer handling
   * so line splits across network packets are handled safely.
   */
  async *parseSSE(response: Response): AsyncGenerator<any, void, unknown> {
    if (!response.body) throw new Error('Response body null')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        // Preserve the last line if it is incomplete
        buffer = lines.pop() || ''

        for (const rawLine of lines) {
          const line = rawLine.trim()
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') return

            try {
              const parsed = JSON.parse(data)
              yield parsed
            } catch {
              // Ignore parse errors for partial/malformed chunks
            }
          }
        }
      }

      // Flush remainder in buffer if any
      if (buffer.trim().startsWith('data: ')) {
        const data = buffer.trim().slice(6).trim()
        if (data !== '[DONE]') {
          try {
            yield JSON.parse(data)
          } catch {
            // ignore
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}
