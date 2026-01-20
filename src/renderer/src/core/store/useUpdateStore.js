import { create } from 'zustand'

export const useUpdateStore = create((set, get) => ({
  status: 'idle', // idle, checking, available, not-available, downloading, ready, error
  updateInfo: null,
  progress: null,
  error: null,

  init: () => {
    if (window.api?.onUpdateStatus) {
      return window.api.onUpdateStatus(({ status, data }) => {
        // update status received (silent)
        switch (status) {
          case 'checking':
            set({ status: 'checking', error: null })
            break
          case 'available':
            set({ status: 'available', updateInfo: data })
            break
          case 'not-available':
            set({ status: 'not-available', updateInfo: data })
            break
          case 'downloading':
            set({ status: 'downloading', progress: data })
            break
          case 'ready':
            set({ status: 'ready', updateInfo: data, progress: null })
            break
          case 'error':
            set({ status: 'error', error: data })
            break
          default:
            break
        }
      })
    }
  },

  check: async () => {
    set({ status: 'checking', error: null })
    await window.api?.checkForUpdates()
  },

  download: async () => {
    set({ status: 'downloading' })
    await window.api?.downloadUpdate()
  },

  install: async () => {
    await window.api?.quitAndInstall()
  }
}))
