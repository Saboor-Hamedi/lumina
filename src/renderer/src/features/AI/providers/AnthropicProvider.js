import { BaseProvider } from './BaseProvider'

export class AnthropicProvider extends BaseProvider {
  constructor(config = {}) {
    super(config)
    this.baseUrl = 'https://api.anthropic.com/v1/messages'
    this.defaultModel = 'claude-3-5-sonnet-20240620'
    this.id = 'anthropic'
    this.name = 'Anthropic'
  }

  async *chatStream(messages, options = {}) {
    if (!this.config.apiKey) {
      throw new Error('Missing Anthropic API Key')
    }

    // Extract system message if present
    let system = ''
    const cleanMessages = messages.filter(m => {
      if (m.role === 'system') {
        system = m.content
        return false
      }
      return true
    })

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true' // Required for client-side calls
      },
      body: JSON.stringify({
        model: options.model || this.defaultModel,
        messages: cleanMessages,
        system: system,
        max_tokens: 4096,
        stream: true
      }),
      signal: options.signal
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Anthropic API Error (${response.status}): ${errorText}`)
    }

    for await (const chunk of this.parseSSE(response)) {
      if (chunk.type === 'content_block_delta') {
        yield chunk.delta.text
      }
    }
  }
}
