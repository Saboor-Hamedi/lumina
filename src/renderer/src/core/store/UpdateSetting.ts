import { create } from 'zustand'

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'ready'
  | 'installing'
  | 'error'

export interface UpdateProgress {
  percent: number
  transferred?: number
  total?: number
}

export interface ReleaseAssetInfo {
  name: string
  browserDownloadUrl: string
  size: number
  downloadCount: number
  contentType?: string | null
  sha256?: string | null
}

export interface ReleaseNoteEntry {
  id: number
  tagName: string
  version: string
  name: string
  body: string
  htmlUrl: string
  publishedAt?: string | null
  prerelease: boolean
  isLatest: boolean
  isInstalled: boolean
  isNewerThanCurrent: boolean
  assets: ReleaseAssetInfo[]
}

export interface GitHubReleasesResponse {
  currentVersion: string
  latestVersion?: string | null
  updateAvailable: bool | boolean
  releases: ReleaseNoteEntry[]
  fromCache: boolean
  cachedAt: number
  etag?: string | null
}

type bool = boolean

export interface UpdateInfo {
  version: string
  releaseNotes?: string
  releaseDate?: string
  url?: string
  assetUrl?: string
  assetName?: string
  assetSize?: number
  assetSha256?: string | null
  [key: string]: any
}

export interface UpdateSettingState {
  status: UpdateStatus
  updateInfo: UpdateInfo | null
  progress: UpdateProgress | null
  error: any
  lastChecked: number
  releases: ReleaseNoteEntry[]
  releasesLoading: boolean
  selectedReleaseVersion: string | null
  init: () => (() => void) | undefined
  check: () => Promise<void>
  download: () => Promise<void>
  cancel: () => Promise<void>
  install: () => Promise<void>
  fetchReleases: (force?: boolean) => Promise<GitHubReleasesResponse | null>
  setSelectedReleaseVersion: (version: string | null) => void
}

let notAvailableResetTimer: ReturnType<typeof setTimeout> | null = null

export const useUpdateSettingStore = create<UpdateSettingState>((set, get) => ({
  status: 'idle',
  updateInfo: null,
  progress: null,
  error: null,
  lastChecked: Date.now(),
  releases: [],
  releasesLoading: false,
  selectedReleaseVersion: null,

  setSelectedReleaseVersion: (version) => set({ selectedReleaseVersion: version }),

  fetchReleases: async (force = false) => {
    const api = (window as any).api
    if (!api?.getGithubReleases) {
      return null
    }
    set({ releasesLoading: true })
    try {
      const res = (await api.getGithubReleases(force)) as GitHubReleasesResponse | null
      if (res && Array.isArray(res.releases)) {
        const currentSel = get().selectedReleaseVersion
        const nextSel =
          currentSel && res.releases.some((r) => r.version === currentSel)
            ? currentSel
            : res.releases[0]?.version || null
        set({
          releases: res.releases,
          selectedReleaseVersion: nextSel,
          releasesLoading: false
        })
        return res
      }
      set({ releasesLoading: false })
      return null
    } catch {
      set({ releasesLoading: false })
      return null
    }
  },

  init: () => {
    if (typeof window === 'undefined' || !(window as any).api?.onUpdateStatus) return undefined

    const unsubscribe = (window as any).api.onUpdateStatus(
      ({ status, data }: { status: UpdateStatus; data?: any }) => {
        if (notAvailableResetTimer) {
          clearTimeout(notAvailableResetTimer)
          notAvailableResetTimer = null
        }

        if (status === 'checking') {
          set({ status: 'checking', error: null })
        } else if (status === 'available') {
          set({
            status: 'available',
            updateInfo: data || get().updateInfo,
            error: null,
            lastChecked: Date.now()
          })
        } else if (status === 'downloading') {
          set({
            status: 'downloading',
            progress: data || { percent: 0 },
            error: null
          })
        } else if (status === 'ready') {
          set({
            status: 'ready',
            updateInfo: data || get().updateInfo,
            progress: null,
            error: null,
            lastChecked: Date.now()
          })
        } else if (status === 'installing') {
          set({
            status: 'installing',
            updateInfo: data || get().updateInfo,
            error: null
          })
        } else if (status === 'not-available') {
          set({
            status: 'not-available',
            error: null,
            lastChecked: Date.now()
          })
          notAvailableResetTimer = setTimeout(() => {
            if (get().status === 'not-available') {
              set({ status: 'idle' })
            }
          }, 3000)
        } else if (status === 'error') {
          set({
            status: 'error',
            error: data,
            progress: null
          })
        }
      }
    )

    return unsubscribe
  },

  check: async () => {
    if (notAvailableResetTimer) {
      clearTimeout(notAvailableResetTimer)
      notAvailableResetTimer = null
    }

    set({ status: 'checking', error: null })

    // Safety timeout: only fall back to not-available if still 'checking' after 12s, and always clear on finish
    const safetyTimer = setTimeout(() => {
      if (get().status === 'checking') {
        set({ status: 'not-available', lastChecked: Date.now() })
        notAvailableResetTimer = setTimeout(() => {
          if (get().status === 'not-available') {
            set({ status: 'idle' })
          }
        }, 3000)
      }
    }, 12000)

    try {
      await (window as any).api?.checkForUpdates?.()
    } catch {
      set({ status: 'not-available', error: null, lastChecked: Date.now() })
      notAvailableResetTimer = setTimeout(() => {
        if (get().status === 'not-available') {
          set({ status: 'idle' })
        }
      }, 3000)
    } finally {
      clearTimeout(safetyTimer)
    }
  },

  download: async () => {
    set({ status: 'downloading', progress: { percent: 0 }, error: null })
    try {
      await (window as any).api?.downloadUpdate?.()
    } catch (err: any) {
      set({ status: 'error', error: err?.message || String(err), progress: null })
    }
  },

  cancel: async () => {
    try {
      await (window as any).api?.cancelUpdate?.()
    } catch {}
    set({ status: 'idle', progress: null })
  },

  install: async () => {
    try {
      await (window as any).api?.quitAndInstall?.()
    } catch (err: any) {
      set({ status: 'error', error: err?.message || String(err) })
    }
  }
}))

export const useUpdateStore = useUpdateSettingStore
export default useUpdateSettingStore
