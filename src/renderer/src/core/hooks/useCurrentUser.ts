/**
 * =========================================================================
 * User Profile & Google Authentication Hook (`useCurrentUser.ts`)
 * =========================================================================
 *
 * Provides reactive access to the authenticated Google user profile,
 * login/logout actions, and real-time synchronization across the application.
 *
 * Features:
 * - Robust cross-component state synchronization via useSettingsStore
 * - Listens to 'google-user-changed' and 'focus' events
 * - Safe async login & logout with error handling and event emission
 * - Fallbacks for offline / unauthenticated states
 * =========================================================================
 */

import { useState, useEffect, useCallback } from 'react'
import { useSettingsStore } from '../store/SettingStore'

export const DEFAULT_GOOGLE_CLIENT_ID =
  '736587690312-33s4trbiculu5dvctb92lkl6njgc14ae.apps.googleusercontent.com'

export interface GoogleUser {
  name?: string | null
  email?: string | null
  picture?: string | null
  error?: string
  [key: string]: unknown
}

export type GoogleLoginResult =
  | { success: true; user: GoogleUser; error?: undefined }
  | { success?: false; error: string; user?: undefined }

export type GoogleLogoutResult =
  | { success: true; error?: undefined }
  | { success?: false; error: string }

export interface UseCurrentUserReturn {
  user: GoogleUser | null
  isLoggedIn: boolean
  isLoading: boolean
  login: (clientId?: string) => Promise<GoogleLoginResult>
  logout: () => Promise<GoogleLogoutResult>
  refreshUser: () => Promise<void>
}

function syncGoogleUserInStore(validUser: GoogleUser | null): void {
  const currentInStore = useSettingsStore.getState().settings?.googleUser as
    | GoogleUser
    | null
    | undefined
  const currentSanitized = currentInStore
    ? {
        name: currentInStore.name ?? null,
        email: currentInStore.email ?? null,
        picture: currentInStore.picture ?? null
      }
    : null
  if (JSON.stringify(currentSanitized) !== JSON.stringify(validUser)) {
    useSettingsStore.setState((state) => ({
      settings: {
        ...state.settings,
        googleUser: validUser
      }
    }))
  }
}

export function useCurrentUser(): UseCurrentUserReturn {
  const storedUser = useSettingsStore(
    (state) => state.settings?.googleUser as GoogleUser | null | undefined
  )
  const [user, setUser] = useState<GoogleUser | null>(storedUser || null)
  const [isLoading, setIsLoading] = useState(false)

  // Keep local state in sync when settings store updates
  useEffect(() => {
    setUser(storedUser || null)
  }, [storedUser])

  // Sync with main process on mount, window focus, and custom event
  const refreshUser = useCallback(async (): Promise<void> => {
    try {
      if (window.api?.getGoogleUser) {
        const remoteUser: GoogleUser | null | undefined = await window.api.getGoogleUser()
        const validUser = remoteUser && (remoteUser.email || remoteUser.name) ? remoteUser : null
        setUser(validUser)
        syncGoogleUserInStore(validUser)
      }
    } catch (err: unknown) {
      console.warn('[useCurrentUser] Failed to check Google user:', err)
    }
  }, [])

  useEffect(() => {
    refreshUser()

    const handleUserChanged = (): void => {
      refreshUser()
    }

    window.addEventListener('google-user-changed', handleUserChanged)
    window.addEventListener('focus', handleUserChanged)

    let unsubSettings: (() => void) | null = null
    if (window.api?.onSettingsChanged) {
      unsubSettings = window.api.onSettingsChanged(() => {
        refreshUser()
      })
    }

    return () => {
      window.removeEventListener('google-user-changed', handleUserChanged)
      window.removeEventListener('focus', handleUserChanged)
      if (typeof unsubSettings === 'function') {
        unsubSettings()
      }
    }
  }, [refreshUser])

  const login = useCallback(
    async (clientId = DEFAULT_GOOGLE_CLIENT_ID): Promise<GoogleLoginResult> => {
      if (!window.api?.loginWithGoogle) {
        return { error: 'Authentication API not available' }
      }

      setIsLoading(true)
      try {
        const userInfo: GoogleUser | null | undefined = await window.api.loginWithGoogle(clientId)
        if (userInfo && !userInfo.error) {
          syncGoogleUserInStore(userInfo)
          setUser(userInfo)
          window.dispatchEvent(new CustomEvent('google-user-changed', { detail: userInfo }))
          return { success: true, user: userInfo }
        } else {
          const errMsg = userInfo?.error || 'Sign in failed'
          return { error: errMsg }
        }
      } catch (err: unknown) {
        console.error('[useCurrentUser] Login failed:', err)
        const message = err instanceof Error ? err.message : undefined
        return { error: message || 'Login failed' }
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const logout = useCallback(async (): Promise<GoogleLogoutResult> => {
    setIsLoading(true)
    try {
      if (window.api?.logoutFromGoogle) {
        await window.api.logoutFromGoogle()
      }
      syncGoogleUserInStore(null)
      setUser(null)
      window.dispatchEvent(new CustomEvent('google-user-changed', { detail: null }))
      return { success: true }
    } catch (err: unknown) {
      console.error('[useCurrentUser] Logout error:', err)
      const message = err instanceof Error ? err.message : undefined
      return { error: message || 'Logout failed' }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const isLoggedIn = Boolean(user && (user.email || user.name))

  return {
    user,
    isLoggedIn,
    isLoading,
    login,
    logout,
    refreshUser
  }
}

export default useCurrentUser
