import React, { useEffect } from 'react'
import MainLayout from './features/Layout/MainLayout'
import TitleBar from './features/Layout/TitleBar'
import { applyTheme } from './features/theme/hooks/themeDefinitions'
import GlobalErrorHandler from './components/GlobalErrorHandler'
import { hideScreenLoader } from './components/screenLoader'
import './assets/globalErrorHandler.css'
import './assets/modernUi.css'

function App() {

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme-id') || 'dark'
    applyTheme(savedTheme)
    const isModern = localStorage.getItem('lumina_modern_ui') === 'true'
    document.documentElement.setAttribute('data-modern-ui', String(isModern))

    // Smoothly dissolve screen loader once React layout is ready
    hideScreenLoader({ minDuration: 300, fadeDuration: 380 })
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
          <MainLayout />
        </GlobalErrorHandler>
      </div>
    </GlobalErrorHandler>
  )
}

export default App
