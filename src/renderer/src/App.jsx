import React, { useEffect } from 'react'
import AppShell from './features/Layout/AppShell'
import { useTheme } from './core/hooks/useTheme'

function App() {
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    // robust initialization
    const savedTheme = localStorage.getItem('theme-id') || 'dark'
    document.documentElement.setAttribute('data-theme', savedTheme)
  }, [])

  return (
    <div className="lumina-app">
      <AppShell />
    </div>
  )
}

export default App
