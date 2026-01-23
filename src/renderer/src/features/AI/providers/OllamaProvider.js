import { BaseProvider } from './BaseProvider'

export class OllamaProvider extends BaseProvider {
  constructor(config = {}) {
    super(config)
    this.baseUrl = config.baseUrl || 'http://localhost:11434/api/chat'
    this.defaultModel = 'llama3'
    this.id = 'ollama'
    this.name = 'Ollama (Local)'
  }

  async *chatStream(messages, options = {}) {
    // Ollama doesn't strictly require a key, but we ensure URL is set
    
    // Some Ollama setups might not support streaming via fetch reader standardly in older versions,
    // but newer ones send NDJSON.
    
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options.model || this.defaultModel,
        messages: messages,
        stream: true
      }),
      signal: options.signal
    })

    if (!response.ok) {
      throw new Error(`Ollama Error (${response.status})`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      // Ollama sends multiple JSON objects in one chunk sometimes
      // format: { "model": "...", "created_at": "...", "message": { "role": "assistant", "content": "..." }, "done": false }
      
      const lines = chunk.split('\n').filter(l => l.trim() !== '')
      
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line)
          if (parsed.message?.content) {
            yield parsed.message.content
          }
          if (parsed.done) return
        } catch (e) {
           console.warn('Ollama parse error:', e)
        }
      }
    }
  }
}
