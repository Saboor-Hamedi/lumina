// Prevent Flash of Unstyled Content (FOUC) on First Launch & Refresh
try {
  const themeId = localStorage.getItem('theme-id') || 'light'
  document.documentElement.setAttribute('data-theme', themeId)

  const activeColorsRaw = localStorage.getItem('lumina_active_theme_colors')
  if (activeColorsRaw) {
    const activeColors = JSON.parse(activeColorsRaw)
    const bootVars = [
      '--bg-app',
      '--bg-sidebar',
      '--text-main',
      '--text-muted',
      '--text-faint',
      '--text-accent',
      '--border-dim'
    ]
    for (let i = 0; i < bootVars.length; i++) {
      const key = bootVars[i]
      if (activeColors[key]) {
        document.documentElement.style.setProperty(key, activeColors[key])
      }
    }
  }

  const stored = localStorage.getItem('theme-colors')
  if (stored) {
    const colors = JSON.parse(stored)
    if (colors.themeAccentColor) {
      let accent = colors.themeAccentColor
      if (!accent.startsWith('#')) accent = '#' + accent
      document.documentElement.style.setProperty('--text-accent', accent)
    }
  }
} catch (_e) {}

// Instant early progress animation while main.tsx bundles download & parse
;(function () {
  let p = 18
  const timer = setInterval(function () {
    const bar = document.getElementById('screen-loader-bar-fill')
    const pct = document.getElementById('screen-loader-percent')
    if (!bar || !pct) return
    // Respect any higher progress set by controller or scripts
    const currentText = parseInt(pct.textContent || '0', 10) || 0
    if (currentText > p) {
      p = currentText
    }
    if (p < 96) {
      p += Math.max(0.4, (96 - p) * 0.045)
      const rounded = Math.min(96, Math.round(p))
      bar.style.width = rounded + '%'
      pct.textContent = rounded + '%'
    } else {
      clearInterval(timer)
    }
  }, 80)
  window.__LUMINA_SCREEN_LOADER__ = {
    stopSimulation: function () {
      clearInterval(timer)
    }
  }
})()
