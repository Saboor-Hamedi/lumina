import { net } from 'electron'
import SettingsManager from '../settings'

/**
 * Retrieves the currently authenticated Google user from settings.
 * Throws an error if no user or token exists.
 */
export async function getDriveUser() {
  const user = await SettingsManager.get('googleUser')
  if (!user || !user.token) {
    throw new Error('Not logged in to Google Drive. Please log in from Settings.')
  }
  return user
}

/**
 * Refreshes the Google OAuth access token using the refresh token.
 */
export async function refreshAccessToken(user) {
  if (!user.refreshToken || !user.clientId) {
    throw new Error('Missing refresh token or client ID. Please logout and log back in.')
  }

  const response = await net.fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: user.clientId,
      client_secret: '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',
      refresh_token: user.refreshToken,
      grant_type: 'refresh_token'
    }).toString()
  })

  if (!response.ok) {
    throw new Error('Failed to refresh access token. Please logout and log back in.')
  }

  const data = await response.json()
  user.token = data.access_token
  await SettingsManager.set('googleUser', user)
  return user.token
}

/**
 * Wrapper around global fetch that adds Authorization header,
 * automatically attempts a token refresh on 401, and supports AbortSignal.
 */
export async function driveFetch(url, options = {}, user, signal = null) {
  const makeHeaders = (token) => {
    const h = new Headers(options.headers || {})
    h.set('Authorization', `Bearer ${token}`)
    return h
  }

  const effectiveSignal = signal || options.signal || null

  let response = await fetch(url, {
    ...options,
    signal: effectiveSignal,
    headers: makeHeaders(user.token)
  })

  if (response.status === 401) {
    if (effectiveSignal?.aborted) {
      throw new Error('Request aborted')
    }
    console.info('[GoogleDrive] Access token expired, attempting refresh...')
    const newToken = await refreshAccessToken(user)
    response = await fetch(url, {
      ...options,
      signal: effectiveSignal,
      headers: makeHeaders(newToken)
    })
  }

  return response
}

/**
 * Escapes single quotes for Google Drive search queries.
 */
export function escapeDriveQuery(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}
