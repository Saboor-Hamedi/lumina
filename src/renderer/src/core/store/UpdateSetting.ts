/**
 * @file UpdateSetting.ts
 * @description TypeScript migration of useUpdateStore.
 * 
 * MIGRATION NOTICE:
 * This store has been migrated from JavaScript (`useUpdateStore.js`) to TypeScript (`UpdateSetting.ts`)
 * to provide strict status typing, typed update payloads, progress indicators,
 * and reliable IPC communication with the Electron auto-updater service.
 */

import { create } from 'zustand'

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'ready'
  | 'error'

export interface UpdateInfo {
  version?: string
  releaseDate?: string
  releaseNotes?: string
  [key: string]: any
}

export interface UpdateProgress {
  bytesPerSecond?: number
  percent?: number
  total?: number
  transferred?: number
  [key: string]: any
}

export interface UpdateSettingState {
  status: UpdateStatus
  updateInfo: UpdateInfo | null
  progress: UpdateProgress | null
  error: any
  lastChecked: number

  // Actions
  init: () => (() => void) | void
  check: () => Promise<void>
  download: () => Promise<void>
  cancel: () => Promise<void>
  install: () => Promise<void>
}

export const useUpdateSettingStore = create<UpdateSettingState>((set, get) => ({
  status: 'idle',
  updateInfo: null,
  progress: null,
  error: null,
  lastChecked: Date.now(),

  init: () => {
    const api = (window as any).api
    if (api?.onUpdateStatus) {
      return api.onUpdateStatus(({ status, data }: { status: UpdateStatus; data: any }) => {
        switch (status) {
          case 'checking':
            set({ status: 'checking', error: null })
            break
          case 'available':
            set({ status: 'available', updateInfo: data, lastChecked: Date.now() })
            break
          case 'not-available':
            set({ status: 'not-available', updateInfo: data, lastChecked: Date.now() })
            setTimeout(() => {
              if (get().status === 'not-available') {
                set({ status: 'idle' })
              }
            }, 3000)
            break
          case 'downloading':
            set({ status: 'downloading', progress: data })
            break
          case 'ready':
            set({ status: 'ready', updateInfo: data, progress: null, lastChecked: Date.now() })
            break
          case 'error':
            set({ status: 'error', error: data, lastChecked: Date.now() })
            break
          default:
            break
        }
      })
    }
  },

  check: async () => {
    set({ status: 'checking', error: null })

    const timeout = setTimeout(() => {
      if (get().status === 'checking') {
        set({ status: 'not-available', lastChecked: Date.now() })
        setTimeout(() => {
          if (get().status === 'not-available') {
            set({ status: 'idle' })
          }
        }, 3000)
      }
    }, 4000)

    try {
      const api = (window as any).api
      await api?.checkForUpdates?.()
    } catch (e) {
      clearTimeout(timeout)
      set({ status: 'not-available', lastChecked: Date.now() })
      setTimeout(() => {
        if (get().status === 'not-available') {
          set({ status: 'idle' })
        }
      }, 3000)
    }
  },

  download: async () => {
    set({ status: 'downloading' })
    const api = (window as any).api
    await api?.downloadUpdate?.()
  },

  cancel: async () => {
    set({ status: 'idle', progress: null })
    const api = (window as any).api
    await api?.cancelUpdate?.()
  },

  install: async () => {
    const api = (window as any).api
    await api?.quitAndInstall?.()
  }
}))

/**
 * Backward compatibility alias for legacy imports (`useUpdateStore`).
 */
export const useUpdateStore = useUpdateSettingStore
export default useUpdateSettingStore
