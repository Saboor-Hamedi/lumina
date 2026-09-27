import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import SettingWorkspace from '../../../../../src/renderer/src/features/Settings/SettingWorkspace'
import { useSettingsStore } from '../../../../../src/renderer/src/core/store/SettingStore'

const baseSettings = () => ({
  vaultPath: '/fake/vault',
  workspacePath: null
})

interface MockApi {
  selectVault: ReturnType<typeof vi.fn>
  selectWorkspace: ReturnType<typeof vi.fn>
  openVaultFolder: ReturnType<typeof vi.fn>
  openWorkspaceFolder: ReturnType<typeof vi.fn>
}

describe('SettingWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSettingsStore.setState({ settings: baseSettings() })
    const mockApi: MockApi = {
      selectVault: vi.fn(),
      selectWorkspace: vi.fn(),
      openVaultFolder: vi.fn(),
      openWorkspaceFolder: vi.fn()
    }
    ;(global.window as unknown as { api: MockApi }).api = mockApi
  })

  it('renders the workspace configuration header and location', () => {
    render(<SettingWorkspace />)
    expect(screen.getByText('Workspace Configuration')).toBeInTheDocument()
    expect(screen.getByText('/fake/vault')).toBeInTheDocument()
  })

  it('shows the default workspace text when no path is set', () => {
    useSettingsStore.setState({ settings: { vaultPath: null, workspacePath: null } })
    render(<SettingWorkspace />)
    expect(screen.getByText('No workspace selected (using default)')).toBeInTheDocument()
  })

  it('calls openWorkspaceFolder or openVaultFolder when Open in Explorer is clicked', () => {
    render(<SettingWorkspace />)
    fireEvent.click(screen.getByRole('button', { name: 'Open in Explorer' }))
    const api = (global.window as unknown as { api: MockApi }).api
    expect(api.openWorkspaceFolder || api.openVaultFolder).toHaveBeenCalled()
  })

  it('calls selectWorkspace or selectVault when Change Location is clicked', async () => {
    const api = (global.window as unknown as { api: MockApi }).api
    api.selectVault.mockResolvedValue('/new/vault')
    api.selectWorkspace.mockResolvedValue('/new/vault')

    render(<SettingWorkspace />)
    fireEvent.click(screen.getByRole('button', { name: 'Change Location' }))
    await act(async () => {})
    expect(api.selectWorkspace.mock.calls.length + api.selectVault.mock.calls.length).toBeGreaterThan(0)
  })
})
