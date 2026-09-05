import { create } from 'zustand'

export const useUpdateStore = create((set, get) => ({
  status: 'idle', // idle, checking, available, not-available, downloading, ready, error
  updateInfo: null,
  progress: null,
  error: null,
  lastChecked: Date.now(),

  init: () => {
    if (window.api?.onUpdateStatus) {
      return window.api.onUpdateStatus(({ status, data }) => {
        // update status received (silent)
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
      await window.api?.checkForUpdates()
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
    await window.api?.downloadUpdate()
  },

  install: async () => {
    await window.api?.quitAndInstall()
  }
}))
