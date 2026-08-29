import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import SettingAdvanced from '../../../../../src/renderer/src/features/Settings/SettingAdvanced'
import { useSettingsStore } from '../../../../../src/renderer/src/core/store/useSettingsStore'
import { useUpdateStore } from '../../../../../src/renderer/src/core/store/useUpdateStore'

const baseSettings = () => ({
  vaultPath: '/fake/vault',
  graphNodeSize: 1.5,
  graphShowTexts: true,
  graphNodeColor: '#40bafa',
  enableDevTools: true
})

describe('SettingAdvanced', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSettingsStore.setState({ settings: baseSettings() })
    useUpdateStore.setState({ status: 'idle', progress: null })
    global.window.api = {
      ...global.window.api,
      getVersion: vi.fn().mockResolvedValue('1.0.30'),
      selectVault: vi.fn(),
      openVaultFolder: vi.fn()
    }
  })

  const renderAdvanced = async () => {
    let result
    await act(async () => {
      result = render(<SettingAdvanced />)
    })
    return result
  }

  it('renders the update section with the app version', async () => {
    await renderAdvanced()
    expect(await screen.findByText(/Version 1.0.30/)).toBeInTheDocument()
    expect(screen.getByText('App Updates')).toBeInTheDocument()
  })

  it('shows an Update button when status is idle', async () => {
    await renderAdvanced()
    expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument()
  })

  it('calls check when the Update button is clicked while idle', async () => {
    const check = vi.spyOn(useUpdateStore.getState(), 'check').mockResolvedValue()
    await renderAdvanced()
    fireEvent.click(screen.getByRole('button', { name: 'Update' }))
    expect(check).toHaveBeenCalled()
    check.mockRestore()
  })

  it('calls download when status is available', async () => {
    const download = vi.spyOn(useUpdateStore.getState(), 'download').mockResolvedValue()
    useUpdateStore.setState({ status: 'available' })
    await renderAdvanced()
    expect(screen.getByText('New version available!')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Update' }))
    expect(download).toHaveBeenCalled()
    download.mockRestore()
  })

  it('shows Install & Restart and calls install when status is ready', async () => {
    const install = vi.spyOn(useUpdateStore.getState(), 'install').mockResolvedValue()
    useUpdateStore.setState({ status: 'ready' })
    await renderAdvanced()
    const btn = screen.getByRole('button', { name: 'Install & Restart' })
    fireEvent.click(btn)
    expect(install).toHaveBeenCalled()
    install.mockRestore()
  })

  it('shows download progress while downloading', async () => {
    useUpdateStore.setState({ status: 'downloading', progress: { percent: 42 } })
    await renderAdvanced()
    expect(screen.getByText(/Downloading update/)).toBeInTheDocument()
  })

  it('shows "No update." when status is not-available', async () => {
    useUpdateStore.setState({ status: 'not-available' })
    await renderAdvanced()
    expect(screen.getByText('No update.')).toBeInTheDocument()
  })

  it('renders the workspace path', async () => {
    await renderAdvanced()
    expect(screen.getByText('Workspace Configuration')).toBeInTheDocument()
    expect(screen.getByText('/fake/vault')).toBeInTheDocument()
  })

  it('shows the default workspace text when no path is set', async () => {
    useSettingsStore.setState({ settings: { ...baseSettings(), vaultPath: null } })
    await renderAdvanced()
    expect(screen.getByText('No workspace selected (using default)')).toBeInTheDocument()
  })

  it('calls openVaultFolder when Open in Explorer is clicked', async () => {
    await renderAdvanced()
    fireEvent.click(screen.getByRole('button', { name: 'Open in Explorer' }))
    expect(global.window.api.openVaultFolder).toHaveBeenCalled()
  })

  it('calls selectVault when Change Location is clicked and a path is chosen', async () => {
    global.window.api.selectVault.mockResolvedValue('/new/vault')
    await renderAdvanced()
    fireEvent.click(screen.getByRole('button', { name: 'Change Location' }))
    await act(async () => {})
    expect(global.window.api.selectVault).toHaveBeenCalled()
  })

  it('renders the graph visualization controls', async () => {
    await renderAdvanced()
    expect(screen.getByText('Graph Visualization')).toBeInTheDocument()
    expect(screen.getByText('Node Size')).toBeInTheDocument()
    expect(screen.getByText('Show Node Texts')).toBeInTheDocument()
  })

  it('toggles Show Node Texts', async () => {
    await renderAdvanced()
    const checkbox = screen
      .getByText('Show Node Texts')
      .closest('.settings-row')
      .querySelector('input')
    fireEvent.click(checkbox)
    expect(useSettingsStore.getState().settings.graphShowTexts).toBe(false)
  })

  it('updates graph node color when a swatch is clicked', async () => {
    const { container } = await renderAdvanced()
    const swatches = container.querySelectorAll('.color-picker-row > div')
    // swatch index 2 = #f59e0b
    fireEvent.click(swatches[2])
    expect(useSettingsStore.getState().settings.graphNodeColor).toBe('#f59e0b')
  })

  it('renders all keyboard shortcut groups', async () => {
    await renderAdvanced()
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument()
    expect(screen.getByText('General')).toBeInTheDocument()
    expect(screen.getByText('File')).toBeInTheDocument()
    expect(screen.getByText('Navigation')).toBeInTheDocument()
    expect(screen.getByText('Editor')).toBeInTheDocument()
    expect(screen.getByText('AI Chat')).toBeInTheDocument()
  })

  it('toggles Enable Developer Tools', async () => {
    await renderAdvanced()
    const checkbox = screen
      .getByText('Enable Developer Tools')
      .closest('.settings-row')
      .querySelector('input')
    fireEvent.click(checkbox)
    expect(useSettingsStore.getState().settings.enableDevTools).toBe(false)
  })
})
