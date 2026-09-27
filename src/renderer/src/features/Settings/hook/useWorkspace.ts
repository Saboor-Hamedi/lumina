import { useCallback } from 'react'
import { useToast } from '../../../core/notification'

interface WindowApiWithWorkspace {
  selectWorkspace?: () => Promise<string | null>
  selectVault?: () => Promise<string | null>
  openWorkspaceFolder?: () => void
  openVaultFolder?: () => void
}

/**
 * Custom hook to handle workspace actions:
 * - Switching the active workspace directory
 * - Opening the current workspace folder in the system file manager (Explorer/Finder)
 */
export function useWorkspace() {
  const { showToast } = useToast()

  const handleSwitchWorkspace = useCallback(async () => {
    try {
      const api = (window as unknown as { api?: WindowApiWithWorkspace }).api
      const selectFn = api?.selectWorkspace || api?.selectVault
      if (!selectFn) {
        showToast('❌ API Error: Restart App')
        return
      }
      const newPath = await selectFn()
      if (newPath) {
        showToast(`✓ Switched to: ${newPath}`)
        setTimeout(() => window.location.reload(), 1000)
      }
    } catch (e) {
      console.error('[useWorkspace] Switch workspace error:', e)
      showToast('❌ Failed to switch workspace')
    }
  }, [showToast])

  const handleOpenFolder = useCallback(() => {
    const api = (window as unknown as { api?: WindowApiWithWorkspace }).api
    const openFn = api?.openWorkspaceFolder || api?.openVaultFolder
    if (openFn) {
      openFn()
    } else {
      showToast('❌ API Error: Restart App')
    }
  }, [showToast])

  return {
    handleSwitchWorkspace,
    handleOpenFolder
  }
}
