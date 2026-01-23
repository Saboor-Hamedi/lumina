import { BaseProvider } from './BaseProvider'

export class OpenAIProvider extends BaseProvider {
  constructor(config = {}) {
    super(config)
    this.baseUrl = 'https://api.openai.com/v1/chat/completions'
    this.defaultModel = 'gpt-4o'
    this.id = 'openai'
    this.name = 'OpenAI'
  }

  async *chatStream(messages, options = {}) {
    if (!this.config.apiKey) {
      throw new Error('Missing OpenAI API Key')
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
      throw new Error(`OpenAI API Error (${response.status}): ${errorText}`)
    }

    for await (const chunk of this.parseSSE(response)) {
      const content = chunk?.choices?.[0]?.delta?.content
      if (content) {
        yield content
      }
    }
  }
}
