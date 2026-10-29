/**
 * Fallback labels/defaults for cloud providers when discovery is not available.
 * With an API key configured, the provider's model-list endpoint is the source
 * of truth and newly released models appear without a catalog code change.
 */
export interface AIModelDefinition {
  id: string
  name: string
  provider: 'deepseek' | 'openai' | 'anthropic'
  isDefault?: boolean
}

export const AI_MODEL_CATALOG: AIModelDefinition[] = [
  { provider: 'deepseek', id: 'deepseek-flash', name: 'DeepSeek V4.1 Flash 1017', isDefault: true },
  { provider: 'deepseek', id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' },

  { provider: 'openai', id: 'gpt-6-astra', name: 'GPT-6 Astra' },
  { provider: 'openai', id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol' },
  { provider: 'openai', id: 'gpt-6.1-terra', name: 'GPT-6.1 Terra', isDefault: true },
  { provider: 'openai', id: 'gpt-6-luna', name: 'GPT-6 Luna' },
  { provider: 'openai', id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra' },
  { provider: 'openai', id: 'gpt-5.4', name: 'GPT-5.4' },
  { provider: 'openai', id: 'gpt-5.4-mini', name: 'GPT-5.4 mini' },
  { provider: 'openai', id: 'gpt-4.1', name: 'GPT-4.1' },
  { provider: 'openai', id: 'gpt-4.1-mini', name: 'GPT-4.1 mini' },
  { provider: 'openai', id: 'gpt-4o', name: 'GPT-4o' },

  { provider: 'anthropic', id: 'claude-opus-5', name: 'Claude Opus 5' },
  { provider: 'anthropic', id: 'claude-sonnet-5', name: 'Claude Sonnet 5', isDefault: true },
  { provider: 'anthropic', id: 'claude-opus-4-8', name: 'Claude Opus 4.8' },
  { provider: 'anthropic', id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
  { provider: 'anthropic', id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
  { provider: 'anthropic', id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' }
]

export function getProviderModels(provider: string): AIModelDefinition[] {
  return AI_MODEL_CATALOG.filter((model) => model.provider === provider)
}

export function getDefaultModel(provider: string): string | null {
  return getProviderModels(provider).find((model) => model.isDefault)?.id ?? null
}
