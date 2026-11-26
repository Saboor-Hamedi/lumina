import { useEffect } from 'react'
import { MainLayout, TitleBar } from './features/Layout'
import { applyTheme } from './features/theme/hooks/themeDefinitions'
import GlobalErrorHandler from './components/GlobalErrorHandler'
import { hideScreenLoader } from './components/screenLoader'
import { useSettingsStore } from './core/store/SettingStore'
import { useZenWindowDrag } from './core/hooks/useZenWindowDrag'
import { markWindowResizing } from './core/tauriBridge'
import './assets/globalErrorHandler.css'

interface AppErrorData {
  message?: string
}

function App() {
  const isTitleBarVisible = useSettingsStore((state) => {
    if (state.settings?.zenMode?.enabled) {
      return state.settings?.titleBarVisible === true
    }
    return state.settings?.titleBarVisible !== false
  })
  const isZenMode = useSettingsStore(
    (state) => state.settings?.zenMode?.enabled === true
  )

  const isModernUi = useSettingsStore(
    (state) => state.settings?.modernUi !== false
  )

  const windowOpacity = useSettingsStore(
    (state) => state.settings?.windowOpacity ?? 1.0
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-modern-ui', String(isModernUi))
  }, [isModernUi])

  useEffect(() => {
    const num = typeof windowOpacity === 'number' ? windowOpacity : 1.0
    const normalized =
      num > 1.0
        ? Math.max(0.2, Math.min(1.0, num / 100))
        : Math.max(0.2, Math.min(1.0, num))
    document.documentElement.style.setProperty('--app-opacity', String(normalized))
    if (window.api?.setWindowOpacity) {
      window.api.setWindowOpacity(normalized).catch(() => {})
    }
  }, [windowOpacity])

  useZenWindowDrag({ enabled: true })

  useEffect(() => {
    window.addEventListener('resize', markWindowResizing, { passive: true })
    return () => window.removeEventListener('resize', markWindowResizing)
  }, [])

  useEffect(() => {
    if (isZenMode) {
      document.documentElement.setAttribute('data-zen-mode', 'true')
    } else {
      document.documentElement.removeAttribute('data-zen-mode')
    }
  }, [isZenMode])

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme-id') || 'dark'
    applyTheme(savedTheme)

    // Smoothly dissolve screen loader once React layout is ready
    hideScreenLoader({ minDuration: 200, fadeDuration: 280 })
  }, [])

  useEffect(() => {
    if (window.api?.onAppError) {
      const handleError = (errorData?: AppErrorData | null) => {
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
    return undefined
  }, [])

  return (
    <GlobalErrorHandler>
      <div
        className={`lumina-app ${isZenMode ? 'zen-mode' : ''}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: '100%',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <TitleBar isHidden={!isTitleBarVisible} />
        <GlobalErrorHandler>
          <MainLayout />
        </GlobalErrorHandler>
      </div>
    </GlobalErrorHandler>
  )
}

export default App
