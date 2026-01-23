import { DeepSeekProvider } from './DeepSeekProvider'
import { OpenAIProvider } from './OpenAIProvider'
import { AnthropicProvider } from './AnthropicProvider'
import { OllamaProvider } from './OllamaProvider'

export class AIProviderFactory {
  static createProvider(type, config = {}) {
    switch (type) {
      case 'deepseek':
        return new DeepSeekProvider(config)
      case 'openai':
        return new OpenAIProvider(config)
      case 'anthropic':
        return new AnthropicProvider(config)
      case 'ollama':
        return new OllamaProvider(config)
      default:
        throw new Error(`Unknown provider type: ${type}`)
    }
  }

  static getAvailableProviders() {
    return [
      { id: 'deepseek', name: 'DeepSeek' },
      { id: 'openai', name: 'OpenAI' },
      { id: 'anthropic', name: 'Anthropic' },
      { id: 'ollama', name: 'Ollama (Local)' }
    ]
  }
}
