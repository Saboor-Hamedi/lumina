import React, { useEffect } from 'react'
import AppShell from './features/Layout/AppShell'
import { useTheme } from './core/hooks/useTheme'
import { applyTheme } from './core/themes/themeDefinitions'

function App() {
  const { theme } = useTheme()

  useEffect(() => {
    // Apply theme on mount to ensure all CSS variables are set
    const savedTheme = localStorage.getItem('theme-id') || 'dark'
    applyTheme(savedTheme)
  }, [])

  return (
    <div className="lumina-app">
      <AppShell />
    </div>
  )
}

export default App
