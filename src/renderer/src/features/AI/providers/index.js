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

export function resolveProviderConfig(settingsObj = {}) {
  const providerType = settingsObj.activeProvider || 'deepseek'
  let activeModel = settingsObj.activeModel || null
  let apiKey =
    settingsObj.deepSeekKey ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('lumina_deepseek_key')) ||
    import.meta.env.VITE_DEEPSEEK_KEY ||
    null

  if (providerType === 'openai') {
    apiKey =
      settingsObj.openaiKey ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('lumina_openai_key')) ||
      null
    if (!activeModel) activeModel = 'gpt-4o'
  } else if (providerType === 'anthropic') {
    apiKey =
      settingsObj.anthropicKey ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('lumina_anthropic_key')) ||
      null
    if (!activeModel) activeModel = 'claude-3-5-sonnet-20241022'
  } else if (providerType === 'ollama') {
    apiKey = 'unused'
  } else if (providerType === 'deepseek') {
    if (!activeModel) activeModel = settingsObj.deepSeekModel || 'deepseek-chat'
  }

  return {
    providerType,
    activeModel,
    apiKey,
    baseUrl: settingsObj.ollamaUrl || 'http://localhost:11434/api/chat'
  }
}

