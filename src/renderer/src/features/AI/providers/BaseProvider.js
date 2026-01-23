/**
 * Base abstract class for AI Providers.
 * Ensures consistent behavior across different models (DeepSeek, OpenAI, Claude, etc).
 */
export class BaseProvider {
  constructor(config = {}) {
    this.config = config
    this.baseUrl = ''
    this.defaultModel = ''
  }

  /**
   * Main generation function. Must be implemented by subclasses.
   * @param {Array} messages - Chat history [{role, content}]
   * @param {Object} options - { signal, model, temperature, ... }
   * @yields {String} - Streamed text chunks
   */
  async *chatStream(messages, options = {}) {
    throw new Error('Method not implemented')
  }

  /**
   * Validate if the provider is ready (has key, etc)
   */
  isConfigured() {
    return !!this.config.apiKey
  }

  /**
   * Helper to parse SSE streams (Server-Sent Events)
   * which most providers (OpenAI, DeepSeek) use.
   */
  async *parseSSE(response) {
    if (!response.body) throw new Error('Response body null')
    
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') return
            
            try {
              const parsed = JSON.parse(data)
              yield parsed
            } catch (e) {
              // Ignore parse errors for partial chunks
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}
