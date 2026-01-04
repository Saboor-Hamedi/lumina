import './assets/index.css'
import './assets/toast.css'
import './assets/markdown.css'
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
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark')
  }
}

bootTheme()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
