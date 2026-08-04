import { ipcMain, BrowserWindow, net } from 'electron'
import SettingsManager from '../SettingsManager'

export function setupGoogleAuth() {
  ipcMain.handle('auth:loginWithGoogle', async (event, clientId) => {
    return new Promise((resolve) => {
      let authWindow = new BrowserWindow({
        width: 600,
        height: 700,
        show: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })

      // Use the Implicit Flow (response_type=token) which does not require a client secret.
      // We use a dummy redirect URI that Electron will intercept before it actually loads.
      const redirectUri = 'http://localhost/oauth2callback'
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=https://www.googleapis.com/auth/drive.file email profile`

      authWindow.loadURL(authUrl)

      authWindow.webContents.on('will-redirect', async (e, url) => {
        if (url.startsWith(redirectUri)) {
          e.preventDefault()

          // With response_type=token, the access token is returned in the URL hash, not query params.
          // Example: http://localhost/oauth2callback#access_token=ya29...&token_type=Bearer&expires_in=3599
          const hashString = new URL(url).hash.substring(1)
          const params = new URLSearchParams(hashString)
          const accessToken = params.get('access_token')
          const error = params.get('error')

          authWindow.close()

          if (error) {
            resolve({ error: `Google returned error: ${error}` })
            return
          }

          if (accessToken) {
            try {
              // Fetch user profile info using the access token to show in the UI
              const response = await net.fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` }
              })

              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
              }

              const profile = await response.json()

              const user = {
                name: profile.name,
                email: profile.email,
                picture: profile.picture,
                token: accessToken
              }

              await SettingsManager.save('googleUser', user)
              resolve(user)
            } catch (fetchErr) {
              resolve({ error: `Failed to fetch profile: ${fetchErr.message}` })
            }
          } else {
            resolve({ error: 'Failed to retrieve access token from Google.' })
          }
        }
      })

      authWindow.on('closed', () => {
        authWindow = null
        resolve({ error: 'Authentication window was closed.' })
      })
    })
  })

  ipcMain.handle('auth:getGoogleUser', async () => {
    try {
      const user = await SettingsManager.get('googleUser')
      return user || null
    } catch (e) {
      return null
    }
  })

  ipcMain.handle('auth:logoutFromGoogle', async () => {
    try {
      await SettingsManager.save('googleUser', null)
      return true
    } catch (e) {
      return false
    }
  })
}
