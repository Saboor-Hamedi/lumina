import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import SettingAdvanced from '../../../../../src/renderer/src/features/Settings/SettingAdvanced'
import { useSettingsStore } from '../../../../../src/renderer/src/core/store/SettingStore'
import { useUpdateStore } from '../../../../../src/renderer/src/core/store/UpdateSetting'

const baseSettings = () => ({
  graphNodeSize: 1.5,
  graphShowTexts: true,
  graphNodeColor: '#40bafa',
  enableDevTools: true,
  launchOnStartup: false
})

describe('SettingAdvanced', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSettingsStore.setState({ settings: baseSettings() })
    useUpdateStore.setState({ status: 'idle', progress: null })
    ;(global.window as unknown as { api: { getVersion: () => Promise<string> } }).api = {
      getVersion: vi.fn().mockResolvedValue('1.0.30')
    }
  })

  const renderAdvanced = async () => {
    let result: ReturnType<typeof render>
    await act(async () => {
      result = render(<SettingAdvanced />)
    })
    return result!
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
      ?.querySelector('input')
    expect(checkbox).toBeDefined()
    if (checkbox) {
      fireEvent.click(checkbox)
      expect(useSettingsStore.getState().settings.graphShowTexts).toBe(false)
    }
  })

  it('updates graph node color when a swatch is clicked', async () => {
    const { container } = await renderAdvanced()
    const swatches = container.querySelectorAll('.color-picker-row > div')
    // swatch index 2 = #f59e0b
    fireEvent.click(swatches[2])
    expect(useSettingsStore.getState().settings.graphNodeColor).toBe('#f59e0b')
  })

  it('toggles Enable Developer Tools', async () => {
    await renderAdvanced()
    const checkbox = screen
      .getByText('Enable Developer Tools')
      .closest('.settings-row')
      ?.querySelector('input')
    expect(checkbox).toBeDefined()
    if (checkbox) {
      fireEvent.click(checkbox)
      expect(useSettingsStore.getState().settings.enableDevTools).toBe(false)
    }
  })
})
