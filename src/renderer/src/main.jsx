import './assets/index.css'
import './assets/globalErrorHandler.css'
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import ScreenLoader from './components/ScreenLoader.tsx'
import { initScreenLoader } from './components/screenLoader'
import GlobalErrorHandler from './components/GlobalErrorHandler'
import { initDomTooltips } from './components/atoms/domTooltip'

const App = lazy(() => import('./App'))

initScreenLoader()
initDomTooltips()

window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i') || e.key === 'F12') {
    window.api?.openDevTools?.()
  }
})

/**
 * Robust Early Theme Loader (VS Code Standard)
 * Prevents FOUC (Flash of Unstyled Content) by checking localStorage before React boots.
 */
const bootTheme = () => {
  try {
    const themeId = localStorage.getItem('theme-id') || 'dark'
    document.documentElement.setAttribute('data-theme', themeId)
    // Apply basic theme colors immediately to prevent flash
    const root = document.documentElement
    if (themeId === 'dark') {
      root.style.setProperty('--bg-app', '#1e1e1e')
      root.style.setProperty('--text-main', '#dfdfdf')
    } else if (themeId === 'light') {
      root.style.setProperty('--bg-app', '#ffffff')
      root.style.setProperty('--text-main', '#1a1a1a')
    }
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark')
  }
}

bootTheme()

// Purge any leaked or legacy keys from localStorage, leaving ONLY theme-id and theme-colors
try {
  const allowedKeys = new Set(['theme-id', 'theme-colors'])
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (key && !allowedKeys.has(key)) {
      localStorage.removeItem(key)
    }
  }
} catch (_) {}

if (import.meta.env.PROD) {
  console.clear()
  console.log(
    '%c LUMINA ',
    'font-size: 50px; font-weight: bold; color: white; background: linear-gradient(to right, #1e1e1e 0%, #3a3a3a 100%); border-radius: 8px; padding: 10px;'
  )
  console.log(
    '%cThe premium AI-powered thinking environment.',
    'font-size: 14px; color: #888; font-style: italic;'
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GlobalErrorHandler isRoot={true}>
      <Suspense fallback={<ScreenLoader status="Loading your notes..." />}>
        <App />
      </Suspense>
    </GlobalErrorHandler>
  </StrictMode>
)
