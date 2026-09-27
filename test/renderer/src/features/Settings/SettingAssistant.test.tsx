import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SettingAssistant from '../../../../../src/renderer/src/features/Settings/SettingAssistant'
import { useSettingsStore } from '../../../../../src/renderer/src/core/store/SettingStore'

const baseSettings = () => ({
  activeProvider: 'deepseek',
  deepSeekKey: null,
  deepSeekModel: 'deepseek-chat',
  openaiKey: null,
  anthropicKey: null,
  ollamaUrl: 'http://localhost:11434/api/chat',
  enableLocalAI: true
})

describe('SettingAssistant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSettingsStore.setState({ settings: baseSettings() })
  })

  it('renders the provider selector with all providers', () => {
    render(<SettingAssistant />)
    expect(screen.getByText('Active Intelligence Provider')).toBeInTheDocument()
    expect(screen.getByText('Primary AI Brain')).toBeInTheDocument()

    const select = screen.getByDisplayValue('DeepSeek (Default)')
    expect(select).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'OpenAI (GPT-4o)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Anthropic (Claude 3.5)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Ollama (Local / Offline)' })).toBeInTheDocument()
  })

  it('shows the DeepSeek configuration by default', () => {
    render(<SettingAssistant />)
    expect(screen.getByText('DeepSeek Configuration')).toBeInTheDocument()
    expect(screen.getByText('Connect an AI (optional)')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('sk-...')).toBeInTheDocument()
  })

  it('updates activeProvider when the dropdown changes', () => {
    render(<SettingAssistant />)
    fireEvent.change(screen.getByDisplayValue('DeepSeek (Default)'), {
      target: { value: 'openai' }
    })
    expect(useSettingsStore.getState().settings.activeProvider).toBe('openai')
  })

  it('shows OpenAI configuration when openai provider is selected', () => {
    useSettingsStore.setState({ settings: { ...baseSettings(), activeProvider: 'openai' } })
    render(<SettingAssistant />)
    expect(screen.getByText('OpenAI Configuration')).toBeInTheDocument()
    expect(screen.queryByText('DeepSeek Configuration')).not.toBeInTheDocument()
  })

  it('shows Anthropic configuration when anthropic provider is selected', () => {
    useSettingsStore.setState({ settings: { ...baseSettings(), activeProvider: 'anthropic' } })
    render(<SettingAssistant />)
    expect(screen.getByText('Anthropic Configuration')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('sk-ant-...')).toBeInTheDocument()
  })

  it('shows Ollama configuration when ollama provider is selected', () => {
    useSettingsStore.setState({ settings: { ...baseSettings(), activeProvider: 'ollama' } })
    render(<SettingAssistant />)
    expect(screen.getByText('Use AI on this computer')).toBeInTheDocument()
    expect(screen.getByDisplayValue('http://localhost:11434/api/chat')).toBeInTheDocument()
  })

  it('saves the deepseek key trimmed or null', () => {
    render(<SettingAssistant />)
    const input = screen.getByPlaceholderText('sk-...')
    fireEvent.change(input, { target: { value: '  sk-12345  ' } })
    expect(useSettingsStore.getState().settings.deepSeekKey).toBe('sk-12345')

    fireEvent.change(input, { target: { value: '   ' } })
    expect(useSettingsStore.getState().settings.deepSeekKey).toBeNull()
  })

  it('updates the deepseek model selection', () => {
    render(<SettingAssistant />)
    fireEvent.change(screen.getByDisplayValue('DeepSeek Chat (V3)'), {
      target: { value: 'deepseek-reasoner' }
    })
    expect(useSettingsStore.getState().settings.deepSeekModel).toBe('deepseek-reasoner')
  })

  it('saves the openai key trimmed or null', () => {
    useSettingsStore.setState({ settings: { ...baseSettings(), activeProvider: 'openai' } })
    render(<SettingAssistant />)
    const input = screen.getByPlaceholderText('sk-...')
    fireEvent.change(input, { target: { value: ' sk-openai-1 ' } })
    expect(useSettingsStore.getState().settings.openaiKey).toBe('sk-openai-1')
  })

  it('saves the ollama url', () => {
    useSettingsStore.setState({ settings: { ...baseSettings(), activeProvider: 'ollama' } })
    render(<SettingAssistant />)
    const input = screen.getByDisplayValue('http://localhost:11434/api/chat')
    fireEvent.change(input, { target: { value: 'http://localhost:1234/api/chat' } })
    expect(useSettingsStore.getState().settings.ollamaUrl).toBe('http://localhost:1234/api/chat')
  })

  it('toggles Smart Search (enableLocalAI)', () => {
    const { container } = render(<SettingAssistant />)
    const checkbox = (container.querySelector('.lumina-switch input[type="checkbox"]') ||
      container.querySelector('input[type="checkbox"]')) as HTMLInputElement
    expect(checkbox.checked).toBe(true)
    fireEvent.click(checkbox)
    expect(useSettingsStore.getState().settings.enableLocalAI).toBe(false)
  })

  it('fetches Ollama models and auto-selects 3.5 by default if available', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          { name: 'phi:latest', model: 'phi:latest' },
          { name: 'llama3.5:latest', model: 'llama3.5:latest' },
          { name: 'mistral:latest', model: 'mistral:latest' }
        ]
      })
    })
    vi.stubGlobal('fetch', mockFetch)

    useSettingsStore.setState({
      settings: { ...baseSettings(), activeProvider: 'ollama', ollamaModel: null }
    })

    render(<SettingAssistant />)

    // Wait for the dropdown with auto-selected 3.5 model
    const select = await screen.findByDisplayValue('llama3.5:latest')
    expect(select).toBeInTheDocument()
    expect(useSettingsStore.getState().settings.ollamaModel).toBe('llama3.5:latest')
    expect(useSettingsStore.getState().settings.activeModel).toBe('llama3.5:latest')

    vi.unstubAllGlobals()
  })

  it('auto-selects phi when 3.5 is not present', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          { name: 'phi:latest', model: 'phi:latest' },
          { name: 'qwen2.5:latest', model: 'qwen2.5:latest' }
        ]
      })
    })
    vi.stubGlobal('fetch', mockFetch)

    useSettingsStore.setState({
      settings: { ...baseSettings(), activeProvider: 'ollama', ollamaModel: null }
    })

    render(<SettingAssistant />)

    const select = await screen.findByDisplayValue('phi:latest')
    expect(select).toBeInTheDocument()
    expect(useSettingsStore.getState().settings.ollamaModel).toBe('phi:latest')

    vi.unstubAllGlobals()
  })

  it('allows the user to switch Ollama models in the dropdown', () => {
    useSettingsStore.setState({
      settings: { ...baseSettings(), activeProvider: 'ollama', ollamaModel: 'llama3.5:latest' }
    })

    render(<SettingAssistant />)

    const select = screen.getByDisplayValue('llama3.5:latest')
    fireEvent.change(select, { target: { value: 'phi:latest' } })

    expect(useSettingsStore.getState().settings.ollamaModel).toBe('phi:latest')
    expect(useSettingsStore.getState().settings.activeModel).toBe('phi:latest')
  })
})
