import React from 'react'
import { useSettingsStore } from '../../core/store/useSettingsStore'

const SettingAssistant = () => {
  const { settings, updateSetting } = useSettingsStore()

  return (
    <div className="settings-pane">
      <section>
        <h3>Active Intelligence Provider</h3>
        <div className="settings-row">
          <div className="row-info">
            <div className="row-label">Primary AI Brain</div>
            <div className="row-hint">Choose which model powers chat and smart features.</div>
          </div>
          <select
            value={settings.activeProvider || 'deepseek'}
            onChange={(e) => updateSetting('activeProvider', e.target.value)}
            className="settings-select"
          >
            <option value="deepseek">DeepSeek (Default)</option>
            <option value="openai">OpenAI (GPT-4o)</option>
            <option value="anthropic">Anthropic (Claude 3.5)</option>
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
            <select
              value={settings.deepSeekModel || 'deepseek-chat'}
              onChange={(e) => updateSetting('deepSeekModel', e.target.value)}
              className="settings-select"
            >
              <option value="deepseek-chat">DeepSeek Chat (V3)</option>
              <option value="deepseek-reasoner">DeepSeek Reasoner (R1)</option>
            </select>
          </div>
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
                Requires GPT-4o access (starts with sk-...){' '}
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
                Claude 3.5 Sonnet key (starts with sk-ant-...){' '}
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
        </section>
      )}

      {/* Ollama Configuration */}
      {settings.activeProvider === 'ollama' && (
        <section style={{ marginTop: '24px', animation: 'fadeIn 0.3s' }}>
          <h3>Use AI on this computer</h3>
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
      )}

      <section style={{ marginTop: '32px' }}>
        <h3>Local Features</h3>
        <div className="settings-row">
          <div className="row-info">
            <div className="row-label">Smart Search (learns as you write)</div>
            <div className="row-hint">Improve answers using your notes.</div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.enableLocalAI ?? true}
              onChange={(e) => updateSetting('enableLocalAI', e.target.checked)}
            />
            <span className="slider round"></span>
          </label>
        </div>
      </section>
    </div>
  )
}

export default React.memo(SettingAssistant)
