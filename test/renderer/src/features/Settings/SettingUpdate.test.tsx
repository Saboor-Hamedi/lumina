import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import SettingUpdate from '../../../../../src/renderer/src/features/Settings/SettingUpdate'
import { useUpdateStore } from '../../../../../src/renderer/src/core/store/UpdateSetting'

describe('SettingUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useUpdateStore.setState({ status: 'idle', progress: null, updateInfo: null, error: null })
    ;(global.window as unknown as { api: { getVersion: () => Promise<string> } }).api = {
      getVersion: vi.fn().mockResolvedValue('1.0.82')
    }
  })

  const renderUpdate = async () => {
    let result: ReturnType<typeof render>
    await act(async () => {
      result = render(<SettingUpdate />)
    })
    return result!
  }

  it('renders the update header and hero card', async () => {
    await renderUpdate()
    expect(screen.getByRole('heading', { level: 2, name: 'Updates' })).toBeInTheDocument()
    expect(screen.getByText('Lumina Desktop')).toBeInTheDocument()
    expect(screen.getByText('Check for Updates')).toBeInTheDocument()
  })

  it('calls check when the Check for Updates button is clicked while idle', async () => {
    const check = vi.spyOn(useUpdateStore.getState(), 'check').mockResolvedValue()
    await renderUpdate()
    fireEvent.click(screen.getByRole('button', { name: /Check for Updates/i }))
    expect(check).toHaveBeenCalled()
    check.mockRestore()
  })

  it('calls download when status is available', async () => {
    const download = vi.spyOn(useUpdateStore.getState(), 'download').mockResolvedValue()
    useUpdateStore.setState({ status: 'available', updateInfo: { version: '1.0.83' } as any })
    await renderUpdate()
    expect(screen.getByText(/A new version \(v1\.0\.83\) is ready to download\./i)).toBeInTheDocument()
    const btn = screen.getByRole('button', { name: /Download v1\.0\.83/i })
    fireEvent.click(btn)
    expect(download).toHaveBeenCalled()
    download.mockRestore()
  })

  it('shows Restart & Install and calls install when status is ready', async () => {
    const install = vi.spyOn(useUpdateStore.getState(), 'install').mockResolvedValue()
    useUpdateStore.setState({ status: 'ready' })
    await renderUpdate()
    const btn = screen.getByRole('button', { name: /Restart & Install/i })
    fireEvent.click(btn)
    expect(install).toHaveBeenCalled()
    install.mockRestore()
  })

  it('shows download progress while downloading', async () => {
    useUpdateStore.setState({
      status: 'downloading',
      progress: { percent: 45, transferred: 45 * 1024 * 1024, total: 100 * 1024 * 1024 } as any
    })
    await renderUpdate()
    expect(screen.getByText(/Downloading update\.\.\. 45%/i)).toBeInTheDocument()
  })

  it('shows error state when update fails', async () => {
    useUpdateStore.setState({
      status: 'error',
      error: new Error('Network timeout connecting to server')
    })
    await renderUpdate()
    expect(screen.getByText('Network timeout connecting to server')).toBeInTheDocument()
  })
})
