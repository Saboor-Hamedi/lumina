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

      // We use the standard Authorization Code flow (response_type=code)
      // because "Desktop App" client types do not support response_type=token
      const redirectUri = 'http://localhost/oauth2callback'
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=https://www.googleapis.com/auth/drive.file email profile`

      authWindow.loadURL(authUrl)

      authWindow.webContents.on('will-redirect', async (e, url) => {
        if (url.startsWith(redirectUri)) {
          e.preventDefault()

          // Extract the authorization code from the query parameters
          const urlObj = new URL(url)
          const code = urlObj.searchParams.get('code')
          const error = urlObj.searchParams.get('error')

          authWindow.close()

          if (error) {
            resolve({ error: `Google returned error: ${error}` })
            return
          }

          if (code) {
            try {
              // Exchange the authorization code for an access token using the Client Secret
              const tokenResponse = await net.fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                  client_id: clientId,
                  client_secret: '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', // From user's previous message
                  code: code,
                  grant_type: 'authorization_code',
                  redirect_uri: redirectUri
                }).toString()
              })

              if (!tokenResponse.ok) {
                const errText = await tokenResponse.text()
                throw new Error(`Token exchange failed: ${errText}`)
              }

              const tokenData = await tokenResponse.json()
              const accessToken = tokenData.access_token

              // Fetch user profile info using the access token to show in the UI
              const profileResponse = await net.fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` }
              })

              if (!profileResponse.ok) {
                throw new Error(`Profile fetch failed: ${profileResponse.status}`)
              }

              const profile = await profileResponse.json()

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
