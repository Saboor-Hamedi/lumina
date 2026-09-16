import { app, ipcMain, shell, net } from 'electron'
import http from 'http'
import url from 'url'
import path from 'path'
import fs from 'fs'
import SettingsManager from '../settings'

let authServer = null

function bringWindowToFront(getMainWindow) {
  try {
    const win = typeof getMainWindow === 'function' ? getMainWindow() : null
    if (!win || win.isDestroyed()) return

    if (win.isMinimized()) {
      win.restore()
    }

    // Bypass Windows OS foreground lockout prevention:
    // Temporarily setting always-on-top forces Windows to bring the window
    // to the actual foreground above the browser instead of just flashing/shaking the taskbar.
    win.setAlwaysOnTop(true)
    win.show()
    win.focus()

    if (typeof app.focus === 'function') {
      app.focus({ steal: true })
    }

    setTimeout(() => {
      if (!win.isDestroyed()) {
        win.setAlwaysOnTop(false)
        win.focus()
      }
    }, 300)
  } catch (err) {
    console.error('Error bringing window to front:', err)
  }
}

export function setupGoogleAuth(getMainWindow) {
  ipcMain.handle('auth:loginWithGoogle', async (event, clientId) => {
    return new Promise((resolve) => {
      if (authServer) {
        authServer.close()
      }

      const redirectUri = 'http://localhost:3000/oauth2callback'
      const scopes = [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
        'email',
        'profile'
      ].join(' ')
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&access_type=offline&prompt=consent&scope=${encodeURIComponent(scopes)}`

      // Try reading app icon from resources for browser display
      let iconBase64 = ''
      try {
        const iconPaths = [
          path.join(process.cwd(), 'resources', 'icon.png'),
          path.join(__dirname, '../../resources/icon.png'),
          path.join(__dirname, '../../../resources/icon.png')
        ]
        for (const p of iconPaths) {
          if (fs.existsSync(p)) {
            iconBase64 = fs.readFileSync(p).toString('base64')
            break
          }
        }
      } catch (err) {
        console.warn('Could not load icon for auth screen:', err.message)
      }

      const iconSrc = iconBase64
        ? `data:image/png;base64,${iconBase64}`
        : 'http://localhost:3000/app-icon.png'

      authServer = http.createServer(async (req, res) => {
        try {
          const reqUrl = url.parse(req.url, true)

          if (reqUrl.pathname === '/return-to-app') {
            bringWindowToFront(getMainWindow)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: true }))
            setTimeout(() => {
              if (authServer) {
                authServer.close()
                authServer = null
              }
            }, 2000)
            return
          }

          if (reqUrl.pathname === '/oauth2callback') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(`
              <!DOCTYPE html>
              <html lang="en">
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Authentication Successful - Lumina</title>
                  <style>
                    * {
                      box-sizing: border-box;
                      margin: 0;
                      padding: 0;
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    }
                    body {
                      background: #ffffff;
                      color: #0f172a;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      min-height: 100vh;
                      padding: 24px;
                      text-rendering: optimizeLegibility;
                    }
                    .auth-container {
                      max-width: 420px;
                      width: 100%;
                      text-align: center;
                    }
                    .icon-wrap {
                      width: 64px;
                      height: 64px;
                      margin: 0 auto 20px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                    }
                    .icon-wrap img {
                      width: 56px;
                      height: 56px;
                      border-radius: 12px;
                      object-fit: cover;
                    }
                    .badge {
                      display: inline-flex;
                      align-items: center;
                      gap: 6px;
                      background: #f0fdf4;
                      color: #16a34a;
                      font-size: 12px;
                      font-weight: 500;
                      padding: 4px 10px;
                      border-radius: 6px;
                      margin-bottom: 16px;
                      border: 1px solid #dcfce7;
                    }
                    .badge svg {
                      width: 14px;
                      height: 14px;
                    }
                    h1 {
                      font-size: 22px;
                      font-weight: 700;
                      color: #0f172a;
                      margin-bottom: 8px;
                      letter-spacing: -0.02em;
                    }
                    p {
                      font-size: 14px;
                      color: #64748b;
                      line-height: 1.5;
                      margin-bottom: 28px;
                    }
                    .btn-group {
                      display: flex;
                      flex-direction: column;
                      gap: 10px;
                    }
                    .btn {
                      display: inline-flex;
                      align-items: center;
                      justify-content: center;
                      gap: 8px;
                      padding: 12px 20px;
                      font-size: 14px;
                      font-weight: 600;
                      border-radius: 8px;
                      cursor: pointer;
                      text-decoration: none;
                      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
                      border: 1px solid transparent;
                    }
                    .btn-primary {
                      background: #2563eb;
                      color: #ffffff;
                    }
                    .btn-primary:hover {
                      background: #1d4ed8;
                    }
                    .btn-secondary {
                      background: transparent;
                      color: #64748b;
                      border: 1px solid #e2e8f0;
                    }
                    .btn-secondary:hover {
                      background: #f8fafc;
                      color: #0f172a;
                      border-color: #cbd5e1;
                    }
                    .status-hint {
                      margin-top: 24px;
                      font-size: 12px;
                      color: #94a3b8;
                      line-height: 1.5;
                    }
                    @media (prefers-color-scheme: dark) {
                      body {
                        background: #0d1117;
                        color: #f1f5f9;
                      }
                      h1 {
                        color: #f8fafc;
                      }
                      p {
                        color: #94a3b8;
                      }
                      .badge {
                        background: rgba(34, 197, 94, 0.1);
                        color: #4ade80;
                        border-color: rgba(34, 197, 94, 0.2);
                      }
                      .btn-primary {
                        background: #3b82f6;
                        color: #ffffff;
                      }
                      .btn-primary:hover {
                        background: #2563eb;
                      }
                      .btn-secondary {
                        background: transparent;
                        color: #94a3b8;
                        border-color: #30363d;
                      }
                      .btn-secondary:hover {
                        background: #161b22;
                        color: #f1f5f9;
                        border-color: #484f58;
                      }
                      .status-hint {
                        color: #64748b;
                      }
                    }
                  </style>
                </head>
                <body>
                  <div class="auth-container">
                    <div class="icon-wrap">
                      <img src="${iconSrc}" alt="Lumina Logo" onerror="this.style.display='none'">
                    </div>
                    <div class="badge">
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Verified & Connected
                    </div>
                    <h1>Authentication Successful!</h1>
                    <p>Your Google account has been safely connected to Lumina. You may now return to your workspace.</p>
                    
                    <div class="btn-group">
                      <button id="returnBtn" class="btn btn-primary" onclick="handleReturn()">
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Return to Lumina
                      </button>
                      <button id="closeBtn" class="btn btn-secondary" onclick="handleClose()">Close this tab</button>
                    </div>

                    <div id="statusHint" class="status-hint">
                      You can return to Lumina using the button above or close this tab.
                    </div>
                  </div>

                  <script>
                    function tryCloseWindow() {
                      window.open('', '_self', '');
                      window.close();
                    }

                    function handleReturn() {
                      fetch('/return-to-app', { method: 'POST' }).catch(() => {});
                      const btn = document.getElementById('returnBtn');
                      if (btn) {
                        btn.innerHTML = 'Returning to Lumina...';
                      }
                      tryCloseWindow();
                      setTimeout(() => {
                        const hint = document.getElementById('statusHint');
                        if (hint) {
                          hint.textContent = 'Lumina has been brought to the foreground. You can safely close this tab (Ctrl+W / ⌘+W).';
                        }
                      }, 150);
                    }

                    function handleClose() {
                      tryCloseWindow();
                      setTimeout(() => {
                        const hint = document.getElementById('statusHint');
                        if (hint) {
                          hint.textContent = 'Browser security prevents scripts from closing this tab. Please close it using Ctrl+W (or ⌘+W).';
                          hint.style.color = '#ef4444';
                        }
                      }, 150);
                    }
                  </script>
                </body>
              </html>
            `)

            const code = reqUrl.query.code
            const error = reqUrl.query.error

            // Keep server alive for 60 seconds so user can click Return to Lumina
            setTimeout(() => {
              if (authServer) {
                authServer.close()
                authServer = null
              }
            }, 60000)

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
                    client_secret: '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',
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
                const refreshToken = tokenData.refresh_token

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
                  token: accessToken,
                  refreshToken: refreshToken,
                  clientId: clientId
                }

                await SettingsManager.set('googleUser', user)
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
      await SettingsManager.set('googleUser', null)
      return true
    } catch (e) {
      return false
    }
  })
}

