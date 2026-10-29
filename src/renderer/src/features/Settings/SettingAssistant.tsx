import React, { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw } from 'lucide-react'
import { useSettingsStore } from '../../core/store/SettingStore'
import Toggle from '../../components/toggle'
import { AI_MODEL_CATALOG, getDefaultModel, getProviderModels } from '../AI/providers/modelCatalog'

const POPULAR_OLLAMA_MODELS = [
  'phi:latest',
  'llama3.5:latest',
  'llama3:latest',
  'mistral:latest',
  'gemma2:latest',
  'qwen2.5:latest'
]

/**
 * Extracts protocol and host from a full Ollama URL (e.g., http://localhost:11434/api/chat -> http://localhost:11434)
 */
function getOllamaBaseUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl || 'http://localhost:11434')
    return `${url.protocol}//${url.host}`
  } catch {
    return 'http://localhost:11434'
  }
}

/**
 * SettingAssistant Component
 * Configures Lumina's active AI model provider (DeepSeek, OpenAI, Anthropic, or Ollama),
 * API keys, endpoint URLs, Groq speech dictation, and local AI index preferences.
 */
export const SettingAssistant: React.FC = () => {
  const { settings, updateSetting, updateSettings } = useSettingsStore()

  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [isLoadingOllama, setIsLoadingOllama] = useState<boolean>(false)
  const [isCustomModel, setIsCustomModel] = useState<boolean>(false)
  const [cloudModels, setCloudModels] = useState<Record<string, { id: string; name: string }[]>>({})
  const [cloudModelLoading, setCloudModelLoading] = useState(false)
  const [cloudModelError, setCloudModelError] = useState<string | null>(null)
  const discoveryRequest = useRef(0)

  const fetchCloudModels = useCallback(async (provider: string, apiKey: string) => {
    const api = (window as any)?.api
    if (!api || typeof api.listAIProviderModels !== 'function' || !apiKey) return
    const requestId = ++discoveryRequest.current
    setCloudModelLoading(true)
    setCloudModelError(null)
    try {
      const result = await api.listAIProviderModels(provider, apiKey)
      if (requestId !== discoveryRequest.current) return
      if (!result?.ok || !Array.isArray(result.models)) {
        setCloudModelError(result?.error || 'Could not load models from this provider.')
        return
      }
      const models = result.models.map((item: { id: string; name?: string }) => {
        const known = AI_MODEL_CATALOG.find((entry) => entry.provider === provider && entry.id === item.id)
        return { id: item.id, name: known?.name || item.name || item.id }
      })
      setCloudModels((current) => ({ ...current, [provider]: models }))
      if (!models.length) {
        setCloudModelError('This provider returned no conversational models for this key.')
        return
      }
      const currentSettings = useSettingsStore.getState().settings
      const availableModels = {
        ...(currentSettings.aiAvailableModelsByProvider || {}),
        [provider]: models.map((model: { id: string }) => model.id)
      }
      const savedModel = currentSettings.aiModelsByProvider?.[provider] ||
        (currentSettings.activeModelProvider === provider ? currentSettings.activeModel : null) ||
        (provider === 'deepseek' && !['deepseek-chat', 'deepseek-reasoner'].includes(currentSettings.deepSeekModel)
          ? currentSettings.deepSeekModel
          : null)
      const selected = models.some((model: { id: string }) => model.id === savedModel)
        ? savedModel
        : models.find((model: { id: string }) => model.id === getDefaultModel(provider))?.id || models[0]?.id
      if (selected) {
        const nextModelMap = { ...(currentSettings.aiModelsByProvider || {}), [provider]: selected }
        updateSettings({
          aiModelsByProvider: nextModelMap,
          aiAvailableModelsByProvider: availableModels,
          ...(currentSettings.activeProvider === provider ? {
            activeModelProvider: provider,
            activeModel: selected,
            ...(provider === 'deepseek' ? { deepSeekModel: selected } : {})
          } : {})
        })
      }
    } catch (error: any) {
      if (requestId !== discoveryRequest.current) return
      setCloudModelError(error?.message || 'Could not load models from this provider.')
    } finally {
      if (requestId === discoveryRequest.current) setCloudModelLoading(false)
    }
  }, [updateSettings])

  const selectCloudModel = useCallback((provider: string, model: string) => {
    const next = { ...(settings.aiModelsByProvider || {}), [provider]: model }
    updateSettings({
      aiModelsByProvider: next,
      activeProvider: provider,
      activeModelProvider: provider,
      activeModel: model,
      ...(provider === 'deepseek' ? { deepSeekModel: model } : {})
    })
  }, [settings.aiModelsByProvider, updateSettings])

  const modelsFor = (provider: string) =>
    cloudModels[provider] !== undefined ? cloudModels[provider] : getProviderModels(provider)

  const selectedModelFor = (provider: string) => {
    const models = modelsFor(provider)
    const saved = settings.aiModelsByProvider?.[provider] ||
      (settings.activeModelProvider === provider ? settings.activeModel : null) ||
      (provider === 'deepseek' ? settings.deepSeekModel : null)
    if (saved && models.some((model) => model.id === saved)) return saved
    return models.find((model) => model.id === getDefaultModel(provider))?.id || models[0]?.id || ''
  }

  // Migrate the previous shared model selection into a provider-scoped value.
  useEffect(() => {
    const provider = settings.activeProvider || 'deepseek'
    if (settings.activeModel && !settings.aiModelsByProvider?.[provider] &&
      (!settings.activeModelProvider || settings.activeModelProvider === provider)) {
      updateSetting('aiModelsByProvider', { ...(settings.aiModelsByProvider || {}), [provider]: settings.activeModel })
      updateSetting('activeModelProvider', provider)
    }
  }, [settings.activeProvider, settings.activeModel, settings.activeModelProvider, settings.aiModelsByProvider, updateSetting])

  // Move installations still pointing at retired DeepSeek aliases to the
  // current API model ID while preserving explicitly selected custom IDs.
  useEffect(() => {
    const legacyDeepSeekIds = ['deepseek-chat', 'deepseek-reasoner']
    if (
      (settings.activeProvider || 'deepseek') === 'deepseek' &&
      legacyDeepSeekIds.includes(settings.activeModel || settings.deepSeekModel || '')
    ) {
      const currentModel = getDefaultModel('deepseek')!
      updateSetting('aiModelsByProvider', { ...(settings.aiModelsByProvider || {}), deepseek: currentModel })
      updateSetting('activeModelProvider', 'deepseek')
      updateSetting('activeModel', currentModel)
      updateSetting('deepSeekModel', currentModel)
    }
  }, [settings.activeProvider, settings.activeModel, settings.deepSeekModel, settings.aiModelsByProvider, updateSetting])

  useEffect(() => {
    const provider = settings.activeProvider
    setCloudModelError(null)
    const apiKey = provider === 'deepseek' ? settings.deepSeekKey :
      provider === 'openai' ? settings.openaiKey :
        provider === 'anthropic' ? settings.anthropicKey : null
    if (provider && apiKey) {
      const timer = setTimeout(() => fetchCloudModels(provider, apiKey), 500)
      return () => {
        clearTimeout(timer)
        discoveryRequest.current += 1
        setCloudModelLoading(false)
      }
    }
  }, [settings.activeProvider, settings.deepSeekKey, settings.openaiKey, settings.anthropicKey, fetchCloudModels])

  /**
   * Fetches installed models from local Ollama (/api/tags) via Main Process IPC or direct fetch
   */
  const fetchOllamaModels = useCallback(
    async (customUrl?: string) => {
      setIsLoadingOllama(true)
      let names: string[] = []
      const targetUrl = customUrl || settings.ollamaUrl || 'http://localhost:11434/api/chat'

      // 1. Try Main Process IPC (bypasses browser CORS & IPv4/IPv6 localhost binding issues)
      try {
        const api = (window as any)?.api
        if (api && typeof api.getOllamaModels === 'function') {
          const res = await api.getOllamaModels(targetUrl)
          if (res?.ok && Array.isArray(res?.models) && res.models.length > 0) {
            names = res.models
          }
        }
      } catch (_) {}

      // 2. Direct renderer fetch fallback (useful for dev/test/browser environments)
      if (names.length === 0) {
        try {
          const baseUrl = getOllamaBaseUrl(targetUrl)
          const urlsToTry = [
            `${baseUrl}/api/tags`,
            baseUrl.includes('localhost')
              ? `${baseUrl.replace('localhost', '127.0.0.1')}/api/tags`
              : `${baseUrl.replace('127.0.0.1', 'localhost')}/api/tags`
          ]

          for (const url of [...new Set(urlsToTry)]) {
            try {
              const controller = new AbortController()
              const timeoutId = setTimeout(() => controller.abort(), 2500)
              const response = await fetch(url, { signal: controller.signal })
              clearTimeout(timeoutId)

              if (response.ok) {
                const data = await response.json()
                const rawList: any[] = Array.isArray(data?.models) ? data.models : []
                const parsed = rawList
                  .map((m) => (typeof m === 'string' ? m : m.name || m.model))
                  .filter((n): n is string => Boolean(n))
                if (parsed.length > 0) {
                  names = parsed
                  break
                }
              }
            } catch (_) {}
          }
        } catch (_) {}
      }

      if (names.length > 0) {
        setOllamaModels(names)

        const latestSettings = useSettingsStore.getState().settings
        // Keep the user's explicit/custom choice even when it isn't in /api/tags
        // (for example, a model hosted on a custom Ollama endpoint).
        const current = latestSettings.ollamaModel
        if (!current?.trim()) {
          // Prioritize: 3.5 (e.g. llama3.5) -> phi (e.g. phi:latest) -> llama -> first available
          const preferred =
            names.find((n) => /3\.5/i.test(n)) ||
            names.find((n) => /phi/i.test(n)) ||
            names.find((n) => /llama/i.test(n)) ||
            names[0]

          if (preferred) {
            updateSetting('ollamaModel', preferred)
            updateSetting('activeModel', preferred)
          }
        }
      } else {
        setOllamaModels([])
      }

      setIsLoadingOllama(false)
    },
    [settings.ollamaUrl, settings.ollamaModel, settings.activeModel, updateSetting]
  )

  // Fetch Ollama models the moment Ollama provider is selected
  useEffect(() => {
    if (settings.activeProvider === 'ollama') {
      fetchOllamaModels()
    }
  }, [settings.activeProvider, fetchOllamaModels])

  return (
    <div className="settings-pane">
      <div className="settings-pane-header">
        <div className="settings-pane-header-info">
          <h2 className="settings-pane-title">AI Assistant</h2>
          <p className="settings-pane-subtitle">
            Model providers, API credentials, and voice dictation.
          </p>
        </div>
      </div>

      <section>
        <h3>Active Intelligence Provider</h3>
        <div className="settings-row">
          <div className="row-info">
            <div className="row-label">Primary AI Brain</div>
            <div className="row-hint">Choose which model powers chat and smart features.</div>
          </div>
          <select
            value={settings.activeProvider || 'deepseek'}
            onChange={(e) => {
              const newProvider = e.target.value
              if (newProvider === 'ollama') {
                const modelToUse = settings.ollamaModel || 'phi:latest'
                updateSettings({
                  activeProvider: newProvider,
                  ollamaModel: modelToUse,
                  activeModelProvider: 'ollama',
                  activeModel: modelToUse
                })
              } else if (getDefaultModel(newProvider)) {
                const model = selectedModelFor(newProvider)
                updateSettings({
                  activeProvider: newProvider,
                  activeModelProvider: newProvider,
                  activeModel: model,
                  ...(newProvider === 'deepseek' ? { deepSeekModel: model } : {})
                })
              } else {
                updateSetting('activeProvider', newProvider)
              }
            }}
            className="settings-select"
          >
            <option value="deepseek">DeepSeek (Default)</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="ollama">Ollama (Local / Offline)</option>
          </select>
        </div>
      </section>

      {/* DeepSeek Configuration */}
      {(settings.activeProvider === 'deepseek' || !settings.activeProvider) && (
        <section style={{ marginTop: '24px', animation: 'fadeIn 0.3s' }}>
          <h3>DeepSeek Configuration</h3>
          <div className="settings-row">
            <div className="row-info">
              <div className="row-label">Connect an AI (optional)</div>
              <div className="row-hint">
                Paste your key here (starts with sk-...){' '}
                <a
                  href="https://platform.deepseek.com/"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--text-accent)' }}
                >
                  Where do I find this?
                </a>
              </div>
            </div>
            <input
              type="password"
              className="settings-select"
              value={settings.deepSeekKey || ''}
              onChange={(e) => updateSetting('deepSeekKey', e.target.value.trim() || null)}
              placeholder="sk-..."
            />
          </div>
          <div className="settings-row">
            <div className="row-info">
              <div className="row-label">Model</div>
            </div>
            <div style={{ display: 'flex', gap: 8, minWidth: 240 }}>
              <select value={selectedModelFor('deepseek')}
                onChange={(e) => selectCloudModel('deepseek', e.target.value)} className="settings-select" disabled={!modelsFor('deepseek').length}>
                {modelsFor('deepseek').map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
              </select>
              <button type="button" onClick={() => fetchCloudModels('deepseek', settings.deepSeekKey || '')} disabled={!settings.deepSeekKey || cloudModelLoading} className="settings-select" title="Refresh models from DeepSeek" style={{ minWidth: 86, cursor: settings.deepSeekKey ? 'pointer' : 'not-allowed' }}>{cloudModelLoading ? 'Loading…' : 'Refresh'}</button>
            </div>
          </div>
          {cloudModelError && <div className="settings-row"><div className="row-hint" role="status">{cloudModelError}. The saved catalog is still available.</div></div>}
        </section>
      )}

      {/* OpenAI Configuration */}
      {settings.activeProvider === 'openai' && (
        <section style={{ marginTop: '24px', animation: 'fadeIn 0.3s' }}>
          <h3>OpenAI Configuration</h3>
          <div className="settings-row">
            <div className="row-info">
              <div className="row-label">Connect an AI (optional)</div>
              <div className="row-hint">
                OpenAI API key (starts with sk-...). Model availability depends on your account.{' '}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--text-accent)' }}
                >
                  Where do I find this?
                </a>
              </div>
            </div>
            <input
              type="password"
              className="settings-select"
              value={settings.openaiKey || ''}
              onChange={(e) => updateSetting('openaiKey', e.target.value.trim() || null)}
              placeholder="sk-..."
            />
          </div>
          <div className="settings-row">
            <div className="row-info"><div className="row-label">Model</div></div>
            <div style={{ display: 'flex', gap: 8, minWidth: 240 }}>
              <select className="settings-select" value={selectedModelFor('openai')} onChange={(e) => selectCloudModel('openai', e.target.value)} disabled={!modelsFor('openai').length}>
                {modelsFor('openai').map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
              </select>
              <button type="button" onClick={() => fetchCloudModels('openai', settings.openaiKey || '')} disabled={!settings.openaiKey || cloudModelLoading} className="settings-select" title="Refresh models from OpenAI" style={{ minWidth: 86, cursor: settings.openaiKey ? 'pointer' : 'not-allowed' }}>{cloudModelLoading ? 'Loading…' : 'Refresh'}</button>
            </div>
          </div>
          {cloudModelError && <div className="settings-row"><div className="row-hint" role="status">{cloudModelError}. The saved catalog is still available.</div></div>}
        </section>
      )}

      {/* Anthropic Configuration */}
      {settings.activeProvider === 'anthropic' && (
        <section style={{ marginTop: '24px', animation: 'fadeIn 0.3s' }}>
          <h3>Anthropic Configuration</h3>
          <div className="settings-row">
            <div className="row-info">
              <div className="row-label">Connect an AI (optional)</div>
              <div className="row-hint">
                Anthropic API key (starts with sk-ant-...). Model availability depends on your account.{' '}
                <a
                  href="https://console.anthropic.com/"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--text-accent)' }}
                >
                  Where do I find this?
                </a>
              </div>
            </div>
            <input
              type="password"
              className="settings-select"
              value={settings.anthropicKey || ''}
              onChange={(e) => updateSetting('anthropicKey', e.target.value.trim() || null)}
              placeholder="sk-ant-..."
            />
          </div>
          <div className="settings-row">
            <div className="row-info"><div className="row-label">Model</div></div>
            <div style={{ display: 'flex', gap: 8, minWidth: 240 }}>
              <select className="settings-select" value={selectedModelFor('anthropic')} onChange={(e) => selectCloudModel('anthropic', e.target.value)} disabled={!modelsFor('anthropic').length}>
                {modelsFor('anthropic').map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
              </select>
              <button type="button" onClick={() => fetchCloudModels('anthropic', settings.anthropicKey || '')} disabled={!settings.anthropicKey || cloudModelLoading} className="settings-select" title="Refresh models from Anthropic" style={{ minWidth: 86, cursor: settings.anthropicKey ? 'pointer' : 'not-allowed' }}>{cloudModelLoading ? 'Loading…' : 'Refresh'}</button>
            </div>
          </div>
          {cloudModelError && <div className="settings-row"><div className="row-hint" role="status">{cloudModelError}. The saved catalog is still available.</div></div>}
        </section>
      )}

      {/* Ollama Configuration */}
      {settings.activeProvider === 'ollama' && (() => {
        const currentOllamaModel = settings.ollamaModel || ollamaModels[0] || 'phi:latest'
        const isPresetOrInstalled =
          ollamaModels.includes(currentOllamaModel) ||
          POPULAR_OLLAMA_MODELS.includes(currentOllamaModel)

        return (
          <section style={{ marginTop: '24px', animation: 'fadeIn 0.3s' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0 }}>Use AI on this computer</h3>
                {ollamaModels.length > 0 ? (
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: 'rgba(34, 197, 94, 0.15)',
                      color: '#22c55e',
                      fontWeight: 600
                    }}
                  >
                    Connected ({ollamaModels.length})
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-muted)',
                      fontWeight: 500
                    }}
                  >
                    Offline
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => fetchOllamaModels()}
                disabled={isLoadingOllama}
                title="Refresh models"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: 500,
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-normal)',
                  cursor: isLoadingOllama ? 'not-allowed' : 'pointer'
                }}
              >
                <RefreshCw
                  size={13}
                  className={isLoadingOllama ? 'spin' : ''}
                />
                <span>{isLoadingOllama ? 'Scanning...' : 'Refresh'}</span>
              </button>
            </div>

            {/* Model Row */}
            <div className="settings-row">
              <div className="row-info">
                <div className="row-label">Model</div>
                <div className="row-hint">
                  {ollamaModels.length > 0
                    ? 'Select from models installed on your computer.'
                    : 'Start Ollama to automatically detect your local models.'}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '220px' }}>
                <select
                  value={isCustomModel || !isPresetOrInstalled ? '__custom__' : currentOllamaModel}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '__custom__') {
                      setIsCustomModel(true)
                    } else {
                      setIsCustomModel(false)
                      updateSetting('ollamaModel', val)
                      updateSetting('activeModel', val)
                    }
                  }}
                  className="settings-select"
                >
                  {ollamaModels.length > 0 ? (
                    <>
                      <optgroup label="Installed on your computer">
                        {ollamaModels.map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Other Models">
                        {POPULAR_OLLAMA_MODELS.filter((m) => !ollamaModels.includes(m)).map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </optgroup>
                    </>
                  ) : (
                    POPULAR_OLLAMA_MODELS.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))
                  )}
                  <option value="__custom__">Custom Model...</option>
                </select>

                {(isCustomModel || !isPresetOrInstalled) && (
                  <input
                    type="text"
                    className="settings-select"
                    value={settings.ollamaModel || ''}
                    onChange={(e) => {
                      const val = e.target.value.trim()
                      updateSetting('ollamaModel', val)
                      updateSetting('activeModel', val)
                    }}
                    placeholder="Enter model name (e.g. phi4, mistral)"
                    autoFocus
                  />
                )}
              </div>
            </div>

            {/* Connection Address Row */}
            <div className="settings-row">
              <div className="row-info">
                <div className="row-label">Connection Address</div>
                <div className="row-hint">Default is http://localhost:11434/api/chat</div>
              </div>
              <input
                type="text"
                className="settings-select"
                value={settings.ollamaUrl || 'http://localhost:11434/api/chat'}
                onChange={(e) => updateSetting('ollamaUrl', e.target.value.trim())}
                placeholder="http://localhost:11434..."
              />
            </div>
          </section>
        )
      })()}

      {/* Groq Speech Dictation Configuration */}
      <section style={{ marginTop: '24px' }}>
        <h3>Voice Dictation (Groq Whisper Cloud)</h3>
        <div className="settings-row">
          <div className="row-info">
            <div className="row-label">Groq API Key (Free)</div>
            <div className="row-hint">
              Enables instant ~300ms speech-to-text with Whisper Large v3.{' '}
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--text-accent)' }}
              >
                Get free key from console.groq.com
              </a>
            </div>
          </div>
          <input
            type="password"
            className="settings-select"
            value={settings.groqKey || ''}
            onChange={(e) => updateSetting('groqKey', e.target.value.trim() || null)}
            placeholder="gsk_..."
          />
        </div>
      </section>

      {/* Local Features */}
      <section style={{ marginTop: '32px' }}>
        <h3>Local Features</h3>
        <div className="settings-row">
          <div className="row-info">
            <div className="row-label">Smart Search (learns as you write)</div>
            <div className="row-hint">Improve answers using your notes.</div>
          </div>
          <Toggle
            checked={settings.enableLocalAI ?? true}
            onChange={(e) => updateSetting('enableLocalAI', e.target.checked)}
          />
        </div>
      </section>
    </div>
  )
}

export default React.memo(SettingAssistant)
