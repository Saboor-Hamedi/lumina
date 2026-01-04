import { useState, useEffect } from 'react'

export const useTheme = () => {
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('theme-id') || 'dark'
  })

  const applyTheme = (themeId, colors) => {
    setCurrentTheme(themeId)
    localStorage.setItem('theme-id', themeId)

    // 1. Clear ALL existing overrides to prevent leakage (Engineering Std #2)
    const root = document.documentElement
    const robustVars = [
      '--bg-app',
      '--bg-sidebar',
      '--bg-panel',
      '--bg-editor',
      '--bg-active',
      '--text-main',
      '--text-muted',
      '--text-faint',
      '--text-accent',
      '--border-dim',
      '--border-card',
      '--scroll-thumb'
    ]
    robustVars.forEach((v) => root.style.removeProperty(v))

    // 2. Set persistency tokens
    setCurrentTheme(themeId)
    localStorage.setItem('theme-id', themeId)
    document.documentElement.setAttribute('data-theme', themeId)

    // 3. Apply overrides if it's a dynamic palette
    if (colors) {
      if (colors.primary) root.style.setProperty('--bg-app', colors.primary)
      if (colors.primary) root.style.setProperty('--bg-editor', colors.primary)
      if (colors.secondary) root.style.setProperty('--bg-sidebar', colors.secondary)
      if (colors.tertiary) root.style.setProperty('--bg-panel', colors.tertiary)
      if (colors.text) root.style.setProperty('--text-main', colors.text)
      if (colors.muted) root.style.setProperty('--text-muted', colors.muted)
      if (colors.faint) root.style.setProperty('--text-faint', colors.faint)
      if (colors.accent) root.style.setProperty('--text-accent', colors.accent)

      // Auto-calculate derivatives if not provided to maintain contrast
      root.style.setProperty('--bg-active', 'rgba(64, 186, 250, 0.12)')
    }
  }

  return { theme: currentTheme, setTheme: applyTheme }
}
