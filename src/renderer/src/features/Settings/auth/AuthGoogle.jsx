import React, { useState, useEffect } from 'react'

const AuthGoogle = () => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Check if user is already logged in
    if (window.api?.getGoogleUser) {
      window.api.getGoogleUser().then(setUser).catch(console.error)
    }
  }, [])

  const handleLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      if (window.api?.loginWithGoogle) {
        // Using the user-provided ID
        const clientId = '736587690312-33s4trbiculu5dvctb92lkl6njgc14ae.apps.googleusercontent.com'
        const userInfo = await window.api.loginWithGoogle(clientId)
        if (userInfo && userInfo.error) {
          setError(userInfo.error)
        } else if (userInfo) {
          setUser(userInfo)
        }
      } else {
        setError('Google login API is not available in this environment.')
      }
    } catch (err) {
      setError(err.message || 'Failed to login with Google')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    setLoading(true)
    try {
      if (window.api?.logoutFromGoogle) {
        await window.api.logoutFromGoogle()
        setUser(null)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="settings-pane">
      <section>
        <h3>Google Drive Sync</h3>
        <div
          className="settings-block"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '16px',
            background: 'var(--bg-primary)',
            borderRadius: '6px'
          }}
        >
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Connect your Google account to automatically back up and sync your Lumina workspace to
            Google Drive.
          </p>

          {error && (
            <div
              style={{
                color: 'var(--text-error)',
                fontSize: '12px',
                background: 'var(--bg-tertiary)',
                padding: '8px',
                borderRadius: '4px'
              }}
            >
              {error}
            </div>
          )}

          {user ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px',
                background: 'var(--bg-secondary)',
                borderRadius: '6px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'var(--bg-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
                  }}
                >
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt="Profile"
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : (
                    <span style={{ color: 'var(--text-main)' }}>{user.name?.charAt(0) || 'U'}</span>
                  )}
                </div>
                <div>
                  <div style={{ color: 'var(--text-main)', fontSize: '14px', fontWeight: '500' }}>
                    {user.name}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{user.email}</div>
                </div>
              </div>
              <button
                className="btn btn-secondary"
                onClick={handleLogout}
                disabled={loading}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-main)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div>
              <button
                className="btn btn-primary"
                onClick={handleLogin}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  background: 'var(--theme-accent, #007acc)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                {loading ? 'Connecting...' : 'Sign in with Google'}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default AuthGoogle
