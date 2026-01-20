import React, { useEffect } from 'react'
import AppShell from './features/Layout/AppShell'
import { useTheme } from './core/hooks/useTheme'
import { applyTheme } from './core/themes/themeDefinitions'
import ErrorBoundary from './components/ErrorBoundary'
import './components/ErrorBoundary.css'

function App() {
  const { theme } = useTheme()

  useEffect(() => {
    // Apply theme on mount to ensure all CSS variables are set
    const savedTheme = localStorage.getItem('theme-id') || 'dark'
    applyTheme(savedTheme)
  }, [])

  // Listen for main process errors
  useEffect(() => {
    if (window.electron?.ipcRenderer) {
      const handleError = (_, errorData) => {
        console.error('[App] Main process error:', errorData)
        // ErrorBoundary will catch if this causes a render error
      }
      window.electron.ipcRenderer.on('app:error', handleError)
      return () => {
        window.electron.ipcRenderer.removeListener('app:error', handleError)
      }
    }
  }, [])

  return (
    <ErrorBoundary>
      <div className="lumina-app">
        <ErrorBoundary>
          <AppShell />
        </ErrorBoundary>
      </div>
    </ErrorBoundary>
  )
}

export default App
