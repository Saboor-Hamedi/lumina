import { BaseProvider } from './BaseProvider'
import { DeepSeekProvider } from './DeepSeekProvider'
import { OpenAIProvider } from './OpenAIProvider'
import { AnthropicProvider } from './AnthropicProvider'
import { OllamaProvider } from './OllamaProvider'
import type { ProviderConfig, ResolvedProviderConfig } from '../types/ai.types'

export interface ProviderMeta {
  id: string
  name: string
}

export class AIProviderFactory {
  static createProvider(type: string, config: ProviderConfig = {}): BaseProvider {
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

  static getAvailableProviders(): ProviderMeta[] {
    return [
      { id: 'deepseek', name: 'DeepSeek' },
      { id: 'openai', name: 'OpenAI' },
      { id: 'anthropic', name: 'Anthropic' },
      { id: 'ollama', name: 'Ollama (Local)' }
    ]
  }
}

export function resolveProviderConfig(settingsObj: Record<string, any> = {}): ResolvedProviderConfig {
  const providerType = settingsObj.activeProvider || 'deepseek'
  let activeModel: string | null = settingsObj.activeModel || null
  let apiKey: string | null =
    settingsObj.deepSeekKey ||
    (import.meta as any).env?.VITE_DEEPSEEK_KEY ||
    null

  if (providerType === 'openai') {
    apiKey = settingsObj.openaiKey || null
    if (!activeModel) activeModel = 'gpt-4o'
  } else if (providerType === 'anthropic') {
    apiKey = settingsObj.anthropicKey || null
    if (!activeModel) activeModel = 'claude-3-5-sonnet-20241022'
  } else if (providerType === 'ollama') {
    apiKey = 'unused'
    // activeModel is shared across providers and can contain a stale cloud
    // model after switching providers. Ollama has its own explicit selection.
    activeModel = settingsObj.ollamaModel || 'llama3'
  } else if (providerType === 'deepseek') {
    if (!activeModel) activeModel = settingsObj.deepSeekModel || 'deepseek-chat'
  }

  return {
    providerType,
    activeModel,
    apiKey,
    baseUrl: settingsObj.ollamaUrl || 'http://127.0.0.1:11434/api/chat'
  }
}

export { BaseProvider, DeepSeekProvider, OpenAIProvider, AnthropicProvider, OllamaProvider }
