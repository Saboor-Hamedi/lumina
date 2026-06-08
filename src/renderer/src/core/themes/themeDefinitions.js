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
      '--bg-app': '#181818',
      '--bg-sidebar': '#1e1e1e',
      '--bg-activitybar': '#191919',
      '--bg-panel': '#252525',
      '--bg-editor': '#181818',
      '--bg-active': 'rgba(64, 186, 250, 0.12)',
      '--bg-card': '#2a2a2a',

      '--text-main': '#e0e0e0',
      '--text-muted': '#a0a0a0',
      '--text-faint': '#5a5a5a',
      '--text-accent': '#40bafa',
      '--text-accent-rgb': '64, 186, 250',

      '--border-dim': '#282828',
      '--border-subtle': '#333333',
      '--border-main': '#404040',
      '--border-card': '#353535',

      '--scroll-thumb': '#404040',
      '--scroll-track': '#1a1a1a',

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
      '--bg-app': '#0d0d0d',
      '--bg-sidebar': '#141414',
      '--bg-activitybar': '#101010',
      '--bg-panel': '#1a1a1a',
      '--bg-editor': '#0d0d0d',
      '--bg-active': 'rgba(64, 186, 250, 0.15)',
      '--bg-card': '#202020',

      '--text-main': '#ebebeb',
      '--text-muted': '#9a9a9a',
      '--text-faint': '#444444',
      '--text-accent': '#40bafa',
      '--text-accent-rgb': '64, 186, 250',

      '--border-dim': '#1a1a1a',
      '--border-subtle': '#252525',
      '--border-main': '#2d2d2d',
      '--border-card': '#282828',

      '--scroll-thumb': '#333333',
      '--scroll-track': '#0d0d0d',

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
      '--bg-active': 'rgba(136, 192, 208, 0.15)',
      '--bg-card': '#414b5e',

      '--text-main': '#eceff4',
      '--text-muted': '#d8dee9',
      '--text-faint': '#616c89',
      '--text-accent': '#88c0d0',
      '--text-accent-rgb': '136, 192, 208',

      '--border-dim': '#3b4455',
      '--border-subtle': '#4c566a',
      '--border-main': '#5e81ac',
      '--border-card': '#4c566a',

      '--scroll-thumb': '#4c566a',
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
      '--bg-app': '#1e1f29',
      '--bg-sidebar': '#252636',
      '--bg-activitybar': '#212232',
      '--bg-panel': '#2b2d40',
      '--bg-editor': '#1e1f29',
      '--bg-active': 'rgba(189, 147, 249, 0.15)',
      '--bg-card': '#32344a',

      '--text-main': '#f8f8f2',
      '--text-muted': '#c0c0c0',
      '--text-faint': '#6272a4',
      '--text-accent': '#bd93f9',
      '--text-accent-rgb': '189, 147, 249',

      '--border-dim': '#363850',
      '--border-subtle': '#44475a',
      '--border-main': '#6272a4',
      '--border-card': '#40435a',

      '--scroll-thumb': '#6272a4',
      '--scroll-track': '#252636',

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
    description: 'Light theme inspired by GitHub',
    colors: {
      '--bg-app': '#ffffff',
      '--bg-sidebar': '#f6f8fa',
      '--bg-activitybar': '#f0f2f5',
      '--bg-panel': '#eef1f5',
      '--bg-editor': '#ffffff',
      '--bg-active': 'rgba(3, 102, 214, 0.08)',
      '--bg-card': '#e6eaef',

      '--text-main': '#1f2328',
      '--text-muted': '#656d76',
      '--text-faint': '#8c959f',
      '--text-accent': '#0969da',
      '--text-accent-rgb': '9, 105, 218',

      '--border-dim': '#d0d7de',
      '--border-subtle': '#c8d1da',
      '--border-main': '#b0b8c4',
      '--border-card': '#d0d7de',

      '--scroll-thumb': '#c0c6cd',
      '--scroll-track': '#f6f8fa',

      '--icon-primary': '#0969da',
      '--icon-secondary': '#1a7f37',
      '--icon-tertiary': '#bf8700',
      '--icon-danger': '#cf222e',
      '--icon-love': '#bf3989',

      '--caret-width': '2px',
      '--caret-color': '#0969da'
    }
  },

  monokai: {
    id: 'monokai',
    name: 'Monokai',
    description: 'Vibrant dark theme with colorful accents',
    colors: {
      '--bg-app': '#1e1f1b',
      '--bg-sidebar': '#252621',
      '--bg-activitybar': '#21221e',
      '--bg-panel': '#2b2c27',
      '--bg-editor': '#1e1f1b',
      '--bg-active': 'rgba(249, 38, 114, 0.15)',
      '--bg-card': '#31322d',

      '--text-main': '#f8f8f2',
      '--text-muted': '#c0c0b0',
      '--text-faint': '#75715e',
      '--text-accent': '#f92672',
      '--text-accent-rgb': '249, 38, 114',

      '--border-dim': '#32332e',
      '--border-subtle': '#3e3d32',
      '--border-main': '#49483e',
      '--border-card': '#383932',

      '--scroll-thumb': '#49483e',
      '--scroll-track': '#252621',

      '--icon-primary': '#f92672',
      '--icon-secondary': '#a6e22e',
      '--icon-tertiary': '#e6db74',
      '--icon-danger': '#f92672',
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
      '--bg-active': 'rgba(38, 139, 210, 0.15)',
      '--bg-card': '#0a4050',

      '--text-main': '#93a1a1',
      '--text-muted': '#839496',
      '--text-faint': '#586e75',
      '--text-accent': '#268bd2',
      '--text-accent-rgb': '38, 139, 210',

      '--border-dim': '#073642',
      '--border-subtle': '#0d4a5a',
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
      '--bg-active': 'rgba(97, 175, 239, 0.15)',
      '--bg-card': '#3b4150',

      '--text-main': '#abb2bf',
      '--text-muted': '#828997',
      '--text-faint': '#5c6370',
      '--text-accent': '#61afef',
      '--text-accent-rgb': '97, 175, 239',

      '--border-dim': '#353b45',
      '--border-subtle': '#3e4451',
      '--border-main': '#4b5263',
      '--border-card': '#3a4050',

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
      '--bg-active': 'rgba(137, 180, 250, 0.15)',
      '--bg-card': '#313156',

      '--text-main': '#cdd6f4',
      '--text-muted': '#a6adc8',
      '--text-faint': '#6c7086',
      '--text-accent': '#89b4fa',
      '--text-accent-rgb': '137, 180, 250',

      '--border-dim': '#313156',
      '--border-subtle': '#45475a',
      '--border-main': '#585b70',
      '--border-card': '#38385e',

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
