import { ipcMain, shell, net } from 'electron'
import http from 'http'
import url from 'url'
import SettingsManager from '../SettingsManager'

let authServer = null

export function setupGoogleAuth() {
  ipcMain.handle('auth:loginWithGoogle', async (event, clientId) => {
    return new Promise((resolve) => {
      if (authServer) {
        authServer.close()
      }

      const redirectUri = 'http://localhost:3000/oauth2callback'
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=https://www.googleapis.com/auth/drive.file email profile`

      authServer = http.createServer(async (req, res) => {
        try {
          const reqUrl = url.parse(req.url, true)

          if (reqUrl.pathname === '/oauth2callback') {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(`
              <html>
                <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #121212; color: white;">
                  <div style="text-align: center;">
                    <h2>Authentication Successful!</h2>
                    <p style="color: #888;">You can close this tab and return to Lumina.</p>
                    <script>window.close()</script>
                  </div>
                </body>
              </html>
            `)

            const code = reqUrl.query.code
            const error = reqUrl.query.error

            authServer.close()
            authServer = null

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
                const profileResponse = await net.fetch(
                  'https://www.googleapis.com/oauth2/v2/userinfo',
                  {
                    headers: { Authorization: `Bearer ${accessToken}` }
                  }
                )

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
        } catch (serverErr) {
          console.error(serverErr)
          resolve({ error: 'Local server encountered an error.' })
        }
      })

      authServer.listen(3000, () => {
        // Open the auth URL in the user's default browser (e.g. Chrome)
        shell.openExternal(authUrl)
      })

      // Timeout after 2 minutes to prevent the server from hanging indefinitely
      setTimeout(() => {
        if (authServer) {
          authServer.close()
          authServer = null
          resolve({ error: 'Authentication window timed out.' })
        }
      }, 120000)
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
