/**
 * =========================================================================
 * User Profile & Google Authentication Hook (`useCurrentUser.js`)
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

export function useCurrentUser() {
  const storedUser = useSettingsStore((state) => state.settings?.googleUser)
  const [user, setUser] = useState(storedUser || null)
  const [isLoading, setIsLoading] = useState(false)

  // Keep local state in sync when settings store updates
  useEffect(() => {
    setUser(storedUser || null)
  }, [storedUser])

  // Sync with main process on mount, window focus, and custom event
  const refreshUser = useCallback(async () => {
    try {
      if (window.api?.getGoogleUser) {
        const remoteUser = await window.api.getGoogleUser()
        const validUser = remoteUser && remoteUser.token ? remoteUser : null
        setUser(validUser)

        // Sync into settings store if different
        const currentInStore = useSettingsStore.getState().settings?.googleUser
        if (JSON.stringify(currentInStore) !== JSON.stringify(validUser)) {
          useSettingsStore.getState().updateSetting('googleUser', validUser)
        }
      }
    } catch (err) {
      console.warn('[useCurrentUser] Failed to check Google user:', err)
    }
  }, [])

  useEffect(() => {
    refreshUser()

    const handleUserChanged = () => {
      refreshUser()
    }

    window.addEventListener('google-user-changed', handleUserChanged)
    window.addEventListener('focus', handleUserChanged)

    return () => {
      window.removeEventListener('google-user-changed', handleUserChanged)
      window.removeEventListener('focus', handleUserChanged)
    }
  }, [refreshUser])

  const login = useCallback(
    async (clientId = DEFAULT_GOOGLE_CLIENT_ID) => {
      if (!window.api?.loginWithGoogle) {
        return { error: 'Authentication API not available' }
      }

      setIsLoading(true)
      try {
        const userInfo = await window.api.loginWithGoogle(clientId)
        if (userInfo && !userInfo.error) {
          useSettingsStore.getState().updateSetting('googleUser', userInfo)
          setUser(userInfo)
          window.dispatchEvent(new CustomEvent('google-user-changed', { detail: userInfo }))
          return { success: true, user: userInfo }
        } else {
          const errMsg = userInfo?.error || 'Sign in failed'
          return { error: errMsg }
        }
      } catch (err) {
        console.error('[useCurrentUser] Login failed:', err)
        return { error: err?.message || 'Login failed' }
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const logout = useCallback(async () => {
    setIsLoading(true)
    try {
      if (window.api?.logoutFromGoogle) {
        await window.api.logoutFromGoogle()
      }
      useSettingsStore.getState().updateSetting('googleUser', null)
      setUser(null)
      window.dispatchEvent(new CustomEvent('google-user-changed', { detail: null }))
      return { success: true }
    } catch (err) {
      console.error('[useCurrentUser] Logout error:', err)
      return { error: err?.message || 'Logout failed' }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const isLoggedIn = Boolean(user && (user.token || user.email))

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
