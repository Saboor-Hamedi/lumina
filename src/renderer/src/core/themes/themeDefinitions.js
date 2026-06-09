/**
 * Centralized Theme Definitions
 * DRY theme system with 10 carefully crafted themes
 * All themes include complete color palettes for consistent application
 */

export const THEMES = {
  dark: {
    id: 'dark',
    name: 'Dark',
    description: 'Classic dark theme with blue accents',
    colors: {
      '--bg-app': '#000000',
      '--bg-sidebar': '#0a0a0a',
      '--bg-activitybar': '#050505',
      '--bg-panel': '#111111',
      '--bg-editor': '#000000',
      '--bg-active': 'rgba(64, 186, 250, 0.12)',
      '--bg-card': '#161616',

      '--text-main': '#e0e0e0',
      '--text-muted': '#a0a0a0',
      '--text-faint': '#5a5a5a',
      '--text-accent': '#40bafa',
      '--text-accent-rgb': '64, 186, 250',

      '--border-dim': '#1a1a1a',
      '--border-subtle': '#222222',
      '--border-main': '#333333',
      '--border-card': '#202020',

      '--scroll-thumb': '#333333',
      '--scroll-track': '#0a0a0a',

      '--icon-primary': '#40bafa',
      '--icon-secondary': '#10b981',
      '--icon-tertiary': '#f59e0b',
      '--icon-danger': '#ef4444',
      '--icon-love': '#ec4899',

      '--caret-width': '2px',
      '--caret-color': '#40bafa'
    }
  },

  light: {
    id: 'light',
    name: 'Light',
    description: 'Clean light theme with blue accents',
    colors: {
      '--bg-app': '#fafafa',
      '--bg-sidebar': '#f0f0f0',
      '--bg-activitybar': '#ececec',
      '--bg-panel': '#e4e4e4',
      '--bg-editor': '#fafafa',
      '--bg-active': 'rgba(64, 186, 250, 0.08)',
      '--bg-card': '#e0e0e0',

      '--text-main': '#1a1a1a',
      '--text-muted': '#666666',
      '--text-faint': '#999999',
      '--text-accent': '#1a8cd8',
      '--text-accent-rgb': '26, 140, 216',

      '--border-dim': '#e0e0e0',
      '--border-subtle': '#d4d4d4',
      '--border-main': '#c0c0c0',
      '--border-card': '#d0d0d0',

      '--scroll-thumb': '#c0c0c0',
      '--scroll-track': '#f5f5f5',

      '--icon-primary': '#1a8cd8',
      '--icon-secondary': '#10b981',
      '--icon-tertiary': '#f59e0b',
      '--icon-danger': '#ef4444',
      '--icon-love': '#ec4899',

      '--caret-width': '2px',
      '--caret-color': '#1a8cd8'
    }
  },

  obsidian: {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'Deep black theme inspired by Obsidian',
    colors: {
      '--bg-app': '#000000',
      '--bg-sidebar': '#080808',
      '--bg-activitybar': '#050505',
      '--bg-panel': '#0f0f0f',
      '--bg-editor': '#000000',
      '--bg-active': 'rgba(64, 186, 250, 0.2)',
      '--bg-card': '#151515',

      '--text-main': '#f0f0f0',
      '--text-muted': '#b0b0b0',
      '--text-faint': '#555555',
      '--text-accent': '#40bafa',
      '--text-accent-rgb': '64, 186, 250',

      '--border-dim': '#181818',
      '--border-subtle': '#222222',
      '--border-main': '#2a2a2a',
      '--border-card': '#1c1c1c',

      '--scroll-thumb': '#2a2a2a',
      '--scroll-track': '#080808',

      '--icon-primary': '#40bafa',
      '--icon-secondary': '#10b981',
      '--icon-tertiary': '#f59e0b',
      '--icon-danger': '#ef4444',
      '--icon-love': '#ec4899',

      '--caret-width': '2px',
      '--caret-color': '#40bafa'
    }
  },

  nord: {
    id: 'nord',
    name: 'Nord',
    description: 'Arctic, north-bluish color palette',
    colors: {
      '--bg-app': '#2e3440',
      '--bg-sidebar': '#353e4e',
      '--bg-activitybar': '#303848',
      '--bg-panel': '#3b4455',
      '--bg-editor': '#2e3440',
      '--bg-active': 'rgba(136, 192, 208, 0.2)',
      '--bg-card': '#434d60',

      '--text-main': '#eceff4',
      '--text-muted': '#d8dee9',
      '--text-faint': '#7a88a8',
      '--text-accent': '#88c0d0',
      '--text-accent-rgb': '136, 192, 208',

      '--border-dim': '#434c5e',
      '--border-subtle': '#4c566a',
      '--border-main': '#5e81ac',
      '--border-card': '#4c566a',

      '--scroll-thumb': '#5e81ac',
      '--scroll-track': '#353e4e',

      '--icon-primary': '#88c0d0',
      '--icon-secondary': '#a3be8c',
      '--icon-tertiary': '#ebcb8b',
      '--icon-danger': '#bf616a',
      '--icon-love': '#b48ead'
    }
  },

  dracula: {
    id: 'dracula',
    name: 'Dracula',
    description: 'Dark theme with vibrant purple accents',
    colors: {
      '--bg-app': '#1a1b26',
      '--bg-sidebar': '#202132',
      '--bg-activitybar': '#1c1d2e',
      '--bg-panel': '#26273c',
      '--bg-editor': '#1a1b26',
      '--bg-active': 'rgba(189, 147, 249, 0.22)',
      '--bg-card': '#2d2f44',

      '--text-main': '#f8f8f2',
      '--text-muted': '#d0d0d0',
      '--text-faint': '#7a8ab8',
      '--text-accent': '#bd93f9',
      '--text-accent-rgb': '189, 147, 249',

      '--border-dim': '#3e4058',
      '--border-subtle': '#4e5168',
      '--border-main': '#6272a4',
      '--border-card': '#404358',

      '--scroll-thumb': '#6272a4',
      '--scroll-track': '#202132',

      '--icon-primary': '#bd93f9',
      '--icon-secondary': '#50fa7b',
      '--icon-tertiary': '#ffb86c',
      '--icon-danger': '#ff5555',
      '--icon-love': '#ff79c6',

      '--caret-width': '2px',
      '--caret-color': '#bd93f9'
    }
  },

  github: {
    id: 'github',
    name: 'GitHub',
    description: 'Dark theme inspired by GitHub',
    colors: {
      '--bg-app': '#0d1117',
      '--bg-sidebar': '#161b22',
      '--bg-activitybar': '#0d1117',
      '--bg-panel': '#161b22',
      '--bg-editor': '#0d1117',
      '--bg-active': 'rgba(56, 139, 253, 0.2)',
      '--bg-card': '#21262d',

      '--text-main': '#e6edf3',
      '--text-muted': '#8b949e',
      '--text-faint': '#848d97',
      '--text-accent': '#58a6ff',
      '--text-accent-rgb': '88, 166, 255',

      '--border-dim': '#30363d',
      '--border-subtle': '#21262d',
      '--border-main': '#30363d',
      '--border-card': '#21262d',

      '--scroll-thumb': '#30363d',
      '--scroll-track': '#0d1117',

      '--icon-primary': '#58a6ff',
      '--icon-secondary': '#3fb950',
      '--icon-tertiary': '#d29922',
      '--icon-danger': '#f85149',
      '--icon-love': '#db61a2',

      '--caret-width': '2px',
      '--caret-color': '#58a6ff'
    }
  },

  monokai: {
    id: 'monokai',
    name: 'Monokai',
    description: 'Vibrant dark theme with colorful accents',
    colors: {
      '--bg-app': '#1a1b17',
      '--bg-sidebar': '#1e1f1b',
      '--bg-activitybar': '#161713',
      '--bg-panel': '#24251f',
      '--bg-editor': '#1a1b17',
      '--bg-active': 'rgba(249, 38, 114, 0.2)',
      '--bg-card': '#2b2c25',

      '--text-main': '#f8f8f2',
      '--text-muted': '#d0d0c0',
      '--text-faint': '#8a8a74',
      '--text-accent': '#f92672',
      '--text-accent-rgb': '249, 38, 114',

      '--border-dim': '#3e3d32',
      '--border-subtle': '#4a4940',
      '--border-main': '#5a5948',
      '--border-card': '#3a3b30',

      '--scroll-thumb': '#5a5948',
      '--scroll-track': '#1e1f1b',

      '--icon-primary': '#f92672',
      '--icon-secondary': '#a6e22e',
      '--icon-tertiary': '#e6db74',
      '--icon-danger': '#fd971f',
      '--icon-love': '#ae81ff'
    }
  },

  solarized: {
    id: 'solarized',
    name: 'Solarized Dark',
    description: 'Precision colors for machines and people',
    colors: {
      '--bg-app': '#00212b',
      '--bg-sidebar': '#052c38',
      '--bg-activitybar': '#03242e',
      '--bg-panel': '#073642',
      '--bg-editor': '#00212b',
      '--bg-active': 'rgba(38, 139, 210, 0.2)',
      '--bg-card': '#0a4050',

      '--text-main': '#a0b0b0',
      '--text-muted': '#95a5a5',
      '--text-faint': '#6a7e85',
      '--text-accent': '#268bd2',
      '--text-accent-rgb': '38, 139, 210',

      '--border-dim': '#0d4a5a',
      '--border-subtle': '#155a6a',
      '--border-main': '#185b6b',
      '--border-card': '#0b3e4c',

      '--scroll-thumb': '#586e75',
      '--scroll-track': '#052c38',

      '--icon-primary': '#268bd2',
      '--icon-secondary': '#859900',
      '--icon-tertiary': '#b58900',
      '--icon-danger': '#dc322f',
      '--icon-love': '#d33682',

      '--caret-width': '2px',
      '--caret-color': '#268bd2'
    }
  },

  oneDark: {
    id: 'oneDark',
    name: 'One Dark',
    description: 'Atom One Dark theme',
    colors: {
      '--bg-app': '#282c34',
      '--bg-sidebar': '#2f343f',
      '--bg-activitybar': '#2b303a',
      '--bg-panel': '#353b45',
      '--bg-editor': '#282c34',
      '--bg-active': 'rgba(97, 175, 239, 0.2)',
      '--bg-card': '#3d4352',

      '--text-main': '#b8bfca',
      '--text-muted': '#939aab',
      '--text-faint': '#6e7585',
      '--text-accent': '#61afef',
      '--text-accent-rgb': '97, 175, 239',

      '--border-dim': '#3a404e',
      '--border-subtle': '#424857',
      '--border-main': '#4b5263',
      '--border-card': '#3d4352',

      '--scroll-thumb': '#4b5263',
      '--scroll-track': '#2f343f',

      '--icon-primary': '#61afef',
      '--icon-secondary': '#98c379',
      '--icon-tertiary': '#e5c07b',
      '--icon-danger': '#e06c75',
      '--icon-love': '#c678dd'
    }
  },

  catppuccin: {
    id: 'catppuccin',
    name: 'Catppuccin',
    description: 'Soothing pastel theme',
    colors: {
      '--bg-app': '#1e1e2e',
      '--bg-sidebar': '#252540',
      '--bg-activitybar': '#21213b',
      '--bg-panel': '#2b2b4a',
      '--bg-editor': '#1e1e2e',
      '--bg-active': 'rgba(137, 180, 250, 0.2)',
      '--bg-card': '#353562',

      '--text-main': '#cdd6f4',
      '--text-muted': '#b5bcd8',
      '--text-faint': '#7c80a0',
      '--text-accent': '#89b4fa',
      '--text-accent-rgb': '137, 180, 250',

      '--border-dim': '#383862',
      '--border-subtle': '#45475a',
      '--border-main': '#585b70',
      '--border-card': '#3a3a66',

      '--scroll-thumb': '#585b70',
      '--scroll-track': '#252540',

      '--icon-primary': '#89b4fa',
      '--icon-secondary': '#a6e3a1',
      '--icon-tertiary': '#f9e2af',
      '--icon-danger': '#f38ba8',
      '--icon-love': '#f5c2e7',

      '--caret-width': '2px',
      '--caret-color': '#89b4fa'
    }
  }
}

/**
 * Get theme by ID
 */
export const getTheme = (themeId) => {
  return THEMES[themeId] || THEMES.dark
}

/**
 * Get all theme IDs
 */
export const getThemeIds = () => {
  return Object.keys(THEMES)
}

/**
 * Apply theme to document
 * Applies all theme colors including caret styling
 * Caret color matches theme accent unless user has set a custom color
 * 
 * @param {string} themeId - Theme identifier
 */
export const applyTheme = (themeId) => {
  const theme = getTheme(themeId)
  const root = document.documentElement

  // Check if user has custom caret color (from useFontSettings)
  // Only preserve custom color if explicitly set (not empty string)
  let customCaretColor = null
  let customCaretWidth = null

  try {
    const savedColors = localStorage.getItem('theme-colors')
    if (savedColors) {
      const parsed = JSON.parse(savedColors)
      // Only use custom color if it's explicitly set (not empty)
      if (parsed.caretColor && parsed.caretColor.trim() !== '') {
        customCaretColor = parsed.caretColor
      }
      // Only use custom width if it's explicitly set
      if (parsed.caretWidth && parsed.caretWidth !== '2px') {
        customCaretWidth = parsed.caretWidth
      }
    }
  } catch (e) {
    // Ignore parse errors, use theme defaults
  }

  // Clear all existing theme variables
  const allVars = Object.keys(theme.colors)
  allVars.forEach((varName) => {
    root.style.removeProperty(varName)
  })

  // Apply new theme
  Object.entries(theme.colors).forEach(([varName, value]) => {
    // Override caret color/width if user has custom settings
    if (varName === '--caret-color' && customCaretColor) {
      root.style.setProperty(varName, customCaretColor)
    } else if (varName === '--caret-width' && customCaretWidth) {
      root.style.setProperty(varName, customCaretWidth)
    } else {
      root.style.setProperty(varName, value)
    }
  })

  // Set data attribute
  root.setAttribute('data-theme', themeId)

  // Persist to localStorage
  localStorage.setItem('theme-id', themeId)
}
