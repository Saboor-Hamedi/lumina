import { useState, useEffect } from 'react'

/**
 * Custom hook to safely retrieve the Lumina application version
 * from the Electron main process via preload window.api bridge.
 */
export function useAppVersion(): string {
  const [appVersion, setAppVersion] = useState<string>('')

  useEffect(() => {
    // Type-safe invocation through the window.api preload bridge
    const api = (window as unknown as { api?: { getVersion?: () => Promise<string> } }).api
    if (api?.getVersion) {
      api.getVersion().then(setAppVersion).catch((err: unknown) => {
        console.error('[useAppVersion] Failed to fetch version:', err)
      })
    }
  }, [])

  return appVersion
}
