import React, { useEffect } from 'react'
import AppShell from './features/Layout/AppShell'
import TitleBar from './features/Layout/TitleBar'
import { useTheme } from './features/theme/hooks/useTheme'
import { applyTheme } from './features/theme/hooks/themeDefinitions'
import GlobalErrorHandler from './components/GlobalErrorHandler'
import './assets/globalErrorHandler.css'

function App() {
  const { theme } = useTheme()

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme-id') || 'dark'
    applyTheme(savedTheme)
  }, [])

  useEffect(() => {
    if (window.electron?.ipcRenderer) {
      const handleError = (_, errorData) => {
        console.error('[App] Main process error:', errorData)
      }
      window.electron.ipcRenderer.on('app:error', handleError)
      return () => {
        window.electron.ipcRenderer.removeListener('app:error', handleError)
      }
    }
  }, [])

  return (
    <GlobalErrorHandler>
      <div
        className="lumina-app"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          width: '100%',
          overflow: 'hidden'
        }}
      >
        <TitleBar />
        <GlobalErrorHandler>
          <AppShell />
        </GlobalErrorHandler>
      </div>
    </GlobalErrorHandler>
  )
}

export default App
