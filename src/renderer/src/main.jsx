import './assets/index.css'
// import './assets/markdown.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

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
    <App />
  </StrictMode>
)
