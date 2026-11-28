import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '../../../core/notification'
import { useSettingsStore } from '../../../core/store/SettingStore'
import { screenLoader } from '../../../components/screenLoader'

export type WorkspaceSource = 'lumina' | 'obsidian' | 'notion' | 'folder'

export interface WorkspaceItem {
  path: string
  name: string
  lastOpened: number
  source: WorkspaceSource
  exists: boolean
  isCurrent?: boolean
}

interface RecentWorkspacesResponse {
  currentWorkspace?: WorkspaceItem
  recentWorkspaces?: WorkspaceItem[]
}

interface SwitchWorkspaceResult {
  path?: string
  workspacePath?: string
  recentWorkspaces?: WorkspaceItem[]
}

interface WindowApiWithWorkspace {
  selectWorkspace?: () => Promise<string | SwitchWorkspaceResult | null>
  selectVault?: () => Promise<string | SwitchWorkspaceResult | null>
  switchWorkspace?: (path: string) => Promise<SwitchWorkspaceResult | null>
  getRecentWorkspaces?: () => Promise<RecentWorkspacesResponse | null>
  removeRecentWorkspace?: (path: string) => Promise<RecentWorkspacesResponse | null>
  openWorkspaceFolder?: (path?: string) => void
  openVaultFolder?: (path?: string) => void
  openPath?: (path: string) => void
}

export function getWorkspaceBasename(path?: string | null): string {
  if (!path) return 'Lumina'
  const cleaned = path.trim().replace(/[\\/]+$/, '')
  if (!cleaned) return 'Lumina'
  const parts = cleaned.split(/[\\/]/)
  return parts[parts.length - 1] || 'Lumina'
}

export function formatWorkspacePath(path?: string | null, maxLen = 44): string {
  if (!path) return ''
  const normalized = path.trim()
  if (normalized.length <= maxLen) return normalized
  const parts = normalized.split(/[\\/]/).filter(Boolean)
  if (parts.length <= 2) return `…${normalized.slice(-(maxLen - 1))}`
  const tail = parts.slice(-2).join('/')
  const prefix = normalized.startsWith('/') ? '/' : `${parts[0]}/`
  const candidate = `${prefix}…/${tail}`
  return candidate.length <= maxLen ? candidate : `…/${tail}`
}

export function getWorkspaceSourceLabel(source?: WorkspaceSource): string | null {
  if (source === 'obsidian') return 'Obsidian'
  if (source === 'notion') return 'Notion'
  if (source === 'lumina') return 'Lumina'
  return null
}

function normalizePathKey(path: string): string {
  return path.trim().replace(/[\\/]+$/, '').replace(/\\/g, '/').toLowerCase()
}

function getWorkspaceApi(): WindowApiWithWorkspace | undefined {
  return (window as unknown as { api?: WindowApiWithWorkspace }).api
}

/**
 * Shared DRY hook for workspace switching, recent workspaces history,
 * and smooth skeleton-loader transitions across TitleBar and Settings.
 */
export function useWorkspace() {
  const { showToast } = useToast()
  const settings = useSettingsStore((s) => s.settings)
  const fallbackPath = settings?.workspacePath || settings?.vaultPath || ''

  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceItem | null>(() =>
    fallbackPath
      ? {
          path: fallbackPath,
          name: getWorkspaceBasename(fallbackPath),
          lastOpened: Date.now(),
          source: 'lumina',
          exists: true,
          isCurrent: true
        }
      : null
  )
  const [recentWorkspaces, setRecentWorkspaces] = useState<WorkspaceItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isSwitching, setIsSwitching] = useState<boolean>(false)

  const refreshWorkspaces = useCallback(async () => {
    const api = getWorkspaceApi()
    if (!api?.getRecentWorkspaces) {
      if (fallbackPath) {
        const fallback: WorkspaceItem = {
          path: fallbackPath,
          name: getWorkspaceBasename(fallbackPath),
          lastOpened: Date.now(),
          source: 'lumina',
          exists: true,
          isCurrent: true
        }
        setCurrentWorkspace(fallback)
        setRecentWorkspaces([fallback])
      }
      return
    }
    setIsLoading(true)
    try {
      const res = await api.getRecentWorkspaces()
      if (res?.currentWorkspace) {
        setCurrentWorkspace(res.currentWorkspace)
      }
      if (Array.isArray(res?.recentWorkspaces)) {
        setRecentWorkspaces(res.recentWorkspaces)
      }
    } catch (e) {
      console.error('[useWorkspace] Failed to fetch recent workspaces:', e)
    } finally {
      setIsLoading(false)
    }
  }, [fallbackPath])

  useEffect(() => {
    void refreshWorkspaces()
  }, [refreshWorkspaces])

  const transitionToWorkspace = useCallback((workspacePath: string, displayName?: string) => {
    const label = displayName || getWorkspaceBasename(workspacePath)
    try {
      sessionStorage.setItem('lumina_switching_workspace', label)
    } catch {
      // Ignore storage errors
    }
    screenLoader.show({
      status: `Opening ${label}…`,
      subStatus: formatWorkspacePath(workspacePath, 52),
      progress: 42
    })
    window.setTimeout(() => {
      screenLoader.setProgress(82, `Loading ${label}…`)
    }, 90)
    window.setTimeout(() => {
      window.location.reload()
    }, 220)
  }, [])

  const handleSwitchWorkspace = useCallback(async () => {
    if (isSwitching) return
    try {
      const api = getWorkspaceApi()
      const selectFn = api?.selectWorkspace || api?.selectVault
      if (!selectFn) {
        showToast('API Error: Restart App', 'error')
        return
      }
      const res = await selectFn()
      if (!res) return
      const chosenPath =
        typeof res === 'string' ? res : res.workspacePath || res.path || ''
      if (!chosenPath) return

      setIsSwitching(true)
      transitionToWorkspace(chosenPath, getWorkspaceBasename(chosenPath))
    } catch (e) {
      console.error('[useWorkspace] Switch workspace error:', e)
      setIsSwitching(false)
      screenLoader.hide()
      showToast('Failed to switch workspace', 'error')
    }
  }, [isSwitching, showToast, transitionToWorkspace])

  const handleOpenWorkspaceByPath = useCallback(
    async (targetPath: string, displayName?: string) => {
      if (isSwitching || !targetPath) return
      if (
        currentWorkspace?.path &&
        normalizePathKey(currentWorkspace.path) === normalizePathKey(targetPath)
      ) {
        return
      }
      const api = getWorkspaceApi()
      if (!api?.switchWorkspace) {
        showToast('API Error: Restart App', 'error')
        return
      }
      const label = displayName || getWorkspaceBasename(targetPath)
      setIsSwitching(true)
      screenLoader.show({
        status: `Switching to ${label}…`,
        subStatus: formatWorkspacePath(targetPath, 52),
        progress: 24
      })
      try {
        await api.switchWorkspace(targetPath)
        transitionToWorkspace(targetPath, label)
      } catch (e) {
        console.error('[useWorkspace] switchWorkspace error:', e)
        setIsSwitching(false)
        await screenLoader.hide({ minDuration: 0, fadeDuration: 180 })
        showToast(`Could not open "${label}" — folder may have moved.`, 'error')
        void refreshWorkspaces()
      }
    },
    [isSwitching, currentWorkspace?.path, showToast, transitionToWorkspace, refreshWorkspaces]
  )

  const handleRemoveRecentWorkspace = useCallback(
    async (targetPath: string) => {
      const api = getWorkspaceApi()
      if (!api?.removeRecentWorkspace) return
      try {
        const res = await api.removeRecentWorkspace(targetPath)
        if (Array.isArray(res?.recentWorkspaces)) {
          setRecentWorkspaces(res.recentWorkspaces)
        }
      } catch (e) {
        console.error('[useWorkspace] removeRecentWorkspace error:', e)
      }
    },
    []
  )

  const handleOpenFolder = useCallback(
    (targetPath?: string) => {
      const api = getWorkspaceApi()
      if (targetPath && api?.openPath) {
        api.openPath(targetPath)
        return
      }
      const openFn = api?.openWorkspaceFolder || api?.openVaultFolder
      if (openFn) {
        openFn()
      } else {
        showToast('API Error: Restart App', 'error')
      }
    },
    [showToast]
  )

  const otherWorkspaces = useMemo(
    () => recentWorkspaces.filter((w) => !w.isCurrent),
    [recentWorkspaces]
  )

  return {
    currentWorkspace,
    recentWorkspaces,
    otherWorkspaces,
    isLoading,
    isSwitching,
    refreshWorkspaces,
    handleSwitchWorkspace,
    handleOpenWorkspaceByPath,
    handleRemoveRecentWorkspace,
    handleOpenFolder
  }
}
