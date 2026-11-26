import './assets/index.css'
import './assets/globalErrorHandler.css'
import { initTauriBridge } from './core/tauriBridge'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ScreenLoader from './components/ScreenLoader.tsx'
import { initScreenLoader } from './components/screenLoader'
import GlobalErrorHandler from './components/GlobalErrorHandler'
import { initDomTooltips } from './components/atoms/domTooltip'

void ScreenLoader

initTauriBridge()
initScreenLoader()
initDomTooltips()

// Prevent WebView2 native page-scale pinch-zoom on non-zoomable UI chrome
// while allowing capture/target handlers (editor, graphs, canvas, lightboxes) to handle zoom first.
window.addEventListener(
  'wheel',
  (e: WheelEvent) => {
    if (e.ctrlKey && !e.defaultPrevented) {
      e.preventDefault()
    }
  },
  { passive: false }
)

window.addEventListener('keydown', (e: KeyboardEvent) => {
  if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i') || e.key === 'F12') {
    window.api?.openDevTools?.()
  }
})

/**
 * Robust Early Theme Loader (VS Code Standard)
 * Prevents FOUC (Flash of Unstyled Content) by checking localStorage before React boots.
 */
const bootTheme = (): void => {
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
  } catch {
    document.documentElement.setAttribute('data-theme', 'dark')
  }
}

bootTheme()

// Purge any leaked or legacy keys from localStorage, while preserving valid Lumina settings and state
try {
  const allowedExactKeys = new Set([
    'theme-id',
    'theme-colors',
    'aiChatModalState'
  ])
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (
      key &&
      !allowedExactKeys.has(key) &&
      !key.startsWith('lumina_') &&
      !key.startsWith('lumina-')
    ) {
      localStorage.removeItem(key)
    }
  }
} catch {
  // Ignore storage access errors
}

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

const rootElement = document.getElementById('root')
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <GlobalErrorHandler isRoot={true}>
        <App />
      </GlobalErrorHandler>
    </StrictMode>
  )
}
