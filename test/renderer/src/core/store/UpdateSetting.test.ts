/**
 * @file UpdateSetting.test.ts
 * @description Unit tests for UpdateSetting.ts (TypeScript migration).
 */

import { useUpdateSettingStore } from '../../../../../src/renderer/src/core/store/UpdateSetting'

describe('UpdateSetting store', () => {
  beforeEach(() => {
    vi.useFakeTimers()

    window.api = {
      onUpdateStatus: vi.fn(),
      checkForUpdates: vi.fn().mockResolvedValue(undefined),
      downloadUpdate: vi.fn().mockResolvedValue(undefined),
      cancelUpdate: vi.fn().mockResolvedValue(undefined),
      quitAndInstall: vi.fn().mockResolvedValue(undefined)
    } as any

    useUpdateSettingStore.setState({
      status: 'idle',
      updateInfo: null,
      progress: null,
      error: null,
      lastChecked: 1000
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initial state', () => {
    it('has default idle status', () => {
      const state = useUpdateSettingStore.getState()
      expect(state.status).toBe('idle')
      expect(state.updateInfo).toBeNull()
      expect(state.progress).toBeNull()
      expect(state.error).toBeNull()
    })
  })

  describe('init', () => {
    it('registers onUpdateStatus listener and processes status events', () => {
      let listenerCallback: any = null
      ;(window.api.onUpdateStatus as any).mockImplementation((cb: any) => {
        listenerCallback = cb
        return () => {}
      })

      useUpdateSettingStore.getState().init()
      expect(window.api.onUpdateStatus).toHaveBeenCalled()

      // Checking
      listenerCallback({ status: 'checking' })
      expect(useUpdateSettingStore.getState().status).toBe('checking')

      // Available
      listenerCallback({ status: 'available', data: { version: '1.2.0' } })
      expect(useUpdateSettingStore.getState().status).toBe('available')
      expect(useUpdateSettingStore.getState().updateInfo).toEqual({ version: '1.2.0' })

      // Downloading
      listenerCallback({ status: 'downloading', data: { percent: 45 } })
      expect(useUpdateSettingStore.getState().status).toBe('downloading')
      expect(useUpdateSettingStore.getState().progress).toEqual({ percent: 45 })

      // Ready
      listenerCallback({ status: 'ready', data: { version: '1.2.0' } })
      expect(useUpdateSettingStore.getState().status).toBe('ready')
      expect(useUpdateSettingStore.getState().progress).toBeNull()

      // Error
      listenerCallback({ status: 'error', data: 'Network error' })
      expect(useUpdateSettingStore.getState().status).toBe('error')
      expect(useUpdateSettingStore.getState().error).toBe('Network error')
    })

    it('auto-resets not-available status to idle after 3000ms', () => {
      let listenerCallback: any = null
      ;(window.api.onUpdateStatus as any).mockImplementation((cb: any) => {
        listenerCallback = cb
        return () => {}
      })

      useUpdateSettingStore.getState().init()
      listenerCallback({ status: 'not-available', data: null })
      expect(useUpdateSettingStore.getState().status).toBe('not-available')

      vi.advanceTimersByTime(3000)
      expect(useUpdateSettingStore.getState().status).toBe('idle')
    })
  })

  describe('check', () => {
    it('triggers checkForUpdates IPC call', async () => {
      const promise = useUpdateSettingStore.getState().check()
      expect(useUpdateSettingStore.getState().status).toBe('checking')

      await promise
      expect(window.api.checkForUpdates).toHaveBeenCalled()
    })

    it('handles checkForUpdates failure gracefully', async () => {
      ;(window.api.checkForUpdates as any).mockRejectedValueOnce(new Error('Update failed'))

      await useUpdateSettingStore.getState().check()
      expect(useUpdateSettingStore.getState().status).toBe('not-available')

      vi.advanceTimersByTime(3000)
      expect(useUpdateSettingStore.getState().status).toBe('idle')
    })
  })

  describe('download, cancel, install', () => {
    it('calls downloadUpdate API', async () => {
      await useUpdateSettingStore.getState().download()
      expect(useUpdateSettingStore.getState().status).toBe('downloading')
      expect(window.api.downloadUpdate).toHaveBeenCalled()
    })

    it('cancels update and resets status to idle', async () => {
      useUpdateSettingStore.setState({ status: 'downloading', progress: { percent: 50 } })
      await useUpdateSettingStore.getState().cancel()

      expect(useUpdateSettingStore.getState().status).toBe('idle')
      expect(useUpdateSettingStore.getState().progress).toBeNull()
      expect(window.api.cancelUpdate).toHaveBeenCalled()
    })

    it('calls quitAndInstall API', async () => {
      await useUpdateSettingStore.getState().install()
      expect(window.api.quitAndInstall).toHaveBeenCalled()
    })
  })
})
