import React, { useEffect } from 'react'
import { MainLayout, TitleBar } from './features/Layout'
import { applyTheme } from './features/theme/hooks/themeDefinitions'
import GlobalErrorHandler from './components/GlobalErrorHandler'
import { hideScreenLoader } from './components/screenLoader'
import './assets/globalErrorHandler.css'
import './assets/modernUI/modernUi.css'

function App() {

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme-id') || 'dark'
    applyTheme(savedTheme)
    document.documentElement.setAttribute('data-modern-ui', 'true')

    // Smoothly dissolve screen loader once React layout is ready
    hideScreenLoader({ minDuration: 200, fadeDuration: 280 })
  }, [])

  useEffect(() => {
    if (window.api?.onAppError) {
      const handleError = (errorData) => {
        console.error('[App] Main process error:', errorData)
        window.dispatchEvent(
          new CustomEvent('show-toast', {
            detail: {
              message: `Background Task: ${errorData?.message || 'A service error occurred'}`,
              type: 'warning'
            }
          })
        )
      }
      return window.api.onAppError(handleError)
    }
  }, [])

  return (
    <GlobalErrorHandler>
      <div
        className="lumina-app"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
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
