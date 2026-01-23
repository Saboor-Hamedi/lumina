import { BaseProvider } from './BaseProvider'

export class DeepSeekProvider extends BaseProvider {
  constructor(config = {}) {
    super(config)
    this.baseUrl = 'https://api.deepseek.com/chat/completions'
    this.defaultModel = 'deepseek-chat'
    this.id = 'deepseek'
    this.name = 'DeepSeek'
  }

  async *chatStream(messages, options = {}) {
    if (!this.config.apiKey) {
      throw new Error('Missing DeepSeek API Key')
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: options.model || this.defaultModel,
        messages: messages,
        temperature: options.temperature || 0.7,
        stream: true
      }),
      signal: options.signal
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`DeepSeek API Error (${response.status}): ${errorText}`)
    }

    // Reuse the SSE parser from BaseProvider
    for await (const chunk of this.parseSSE(response)) {
      const content = chunk?.choices?.[0]?.delta?.content
      if (content) {
        yield content
      }
    }
  }
}
