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
      // Backgrounds
      '--bg-app': '#1e1e1e',
      '--bg-sidebar': '#171717',
      '--bg-panel': '#0f0f0f',
      '--bg-editor': '#1e1e1e',
      '--bg-active': 'rgba(64, 186, 250, 0.12)',
      '--bg-card': '#252525',
      
      // Text
      '--text-main': '#dfdfdf',
      '--text-muted': '#aaaaaa',
      '--text-faint': '#666666',
      '--text-accent': '#40bafa',
      '--text-accent-rgb': '64, 186, 250',
      
      // Borders
      '--border-dim': '#2d2d2d',
      '--border-subtle': '#333333',
      '--border-main': '#404040',
      '--border-card': '#3a3a3a',
      
      // Scrollbar
      '--scroll-thumb': '#404040',
      '--scroll-track': '#1a1a1a',
      
      // Icon colors (for colorful icons)
      '--icon-primary': '#40bafa',
      '--icon-secondary': '#10b981',
      '--icon-tertiary': '#f59e0b',
      '--icon-danger': '#ef4444',
      '--icon-love': '#ec4899',
      
      // Caret (cursor) styling - 2px vertical line matching theme accent
      '--caret-width': '2px',
      '--caret-color': '#40bafa'
    }
  },
  
  light: {
    id: 'light',
    name: 'Light',
    description: 'Clean light theme with blue accents',
    colors: {
      '--bg-app': '#ffffff',
      '--bg-sidebar': '#f6f6f6',
      '--bg-panel': '#f2f2f2',
      '--bg-editor': '#ffffff',
      '--bg-active': 'rgba(64, 186, 250, 0.08)',
      '--bg-card': '#fafafa',
      
      '--text-main': '#1a1a1a',
      '--text-muted': '#666666',
      '--text-faint': '#999999',
      '--text-accent': '#40bafa',
      '--text-accent-rgb': '64, 186, 250',
      
      '--border-dim': '#e0e0e0',
      '--border-subtle': '#e5e5e5',
      '--border-main': '#d0d0d0',
      '--border-card': '#e8e8e8',
      
      '--scroll-thumb': '#c0c0c0',
      '--scroll-track': '#f5f5f5',
      
      '--icon-primary': '#40bafa',
      '--icon-secondary': '#10b981',
      '--icon-tertiary': '#f59e0b',
      '--icon-danger': '#ef4444',
      '--icon-love': '#ec4899'
    }
  },
  
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'Deep black theme inspired by Obsidian',
    colors: {
      '--bg-app': '#000000',
      '--bg-sidebar': '#111111',
      '--bg-panel': '#0a0a0a',
      '--bg-editor': '#000000',
      '--bg-active': 'rgba(64, 186, 250, 0.15)',
      '--bg-card': '#1a1a1a',
      
      '--text-main': '#f0f0f0',
      '--text-muted': '#a0a0a0',
      '--text-faint': '#444444',
      '--text-accent': '#40bafa',
      '--text-accent-rgb': '64, 186, 250',
      
      '--border-dim': '#1a1a1a',
      '--border-subtle': '#222222',
      '--border-main': '#2a2a2a',
      '--border-card': '#252525',
      
      '--scroll-thumb': '#333333',
      '--scroll-track': '#0a0a0a',
      
      '--icon-primary': '#40bafa',
      '--icon-secondary': '#10b981',
      '--icon-tertiary': '#f59e0b',
      '--icon-danger': '#ef4444',
      '--icon-love': '#ec4899',
      
      // Caret (cursor) styling - 2px vertical line matching theme accent
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
      '--bg-sidebar': '#3b4252',
      '--bg-panel': '#434c5e',
      '--bg-editor': '#2e3440',
      '--bg-active': 'rgba(136, 192, 208, 0.15)',
      '--bg-card': '#3b4252',
      
      '--text-main': '#eceff4',
      '--text-muted': '#d8dee9',
      '--text-faint': '#4c566a',
      '--text-accent': '#88c0d0',
      '--text-accent-rgb': '136, 192, 208',
      
      '--border-dim': '#434c5e',
      '--border-subtle': '#4c566a',
      '--border-main': '#5e81ac',
      '--border-card': '#4c566a',
      
      '--scroll-thumb': '#4c566a',
      '--scroll-track': '#3b4252',
      
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
      '--bg-app': '#282a36',
      '--bg-sidebar': '#21222c',
      '--bg-panel': '#1e1f29',
      '--bg-editor': '#282a36',
      '--bg-active': 'rgba(189, 147, 249, 0.15)',
      '--bg-card': '#343746',
      
      '--text-main': '#f8f8f2',
      '--text-muted': '#bd93f9',
      '--text-faint': '#6272a4',
      '--text-accent': '#bd93f9',
      '--text-accent-rgb': '189, 147, 249',
      
      '--border-dim': '#44475a',
      '--border-subtle': '#6272a4',
      '--border-main': '#bd93f9',
      '--border-card': '#44475a',
      
      '--scroll-thumb': '#6272a4',
      '--scroll-track': '#21222c',
      
      '--icon-primary': '#bd93f9',
      '--icon-secondary': '#50fa7b',
      '--icon-tertiary': '#ffb86c',
      '--icon-danger': '#ff5555',
      '--icon-love': '#ff79c6',
      
      // Caret (cursor) styling - 2px vertical line matching theme accent
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
      '--bg-panel': '#fafbfc',
      '--bg-editor': '#ffffff',
      '--bg-active': 'rgba(3, 102, 214, 0.08)',
      '--bg-card': '#ffffff',
      
      '--text-main': '#24292e',
      '--text-muted': '#586069',
      '--text-faint': '#959da5',
      '--text-accent': '#0366d6',
      '--text-accent-rgb': '3, 102, 214',
      
      '--border-dim': '#e1e4e8',
      '--border-subtle': '#d1d5da',
      '--border-main': '#0366d6',
      '--border-card': '#e1e4e8',
      
      '--scroll-thumb': '#c6cbd1',
      '--scroll-track': '#f6f8fa',
      
      '--icon-primary': '#0366d6',
      '--icon-secondary': '#28a745',
      '--icon-tertiary': '#f59e0b',
      '--icon-danger': '#d73a49',
      '--icon-love': '#ea4aaa',
      
      // Caret (cursor) styling - 2px vertical line matching theme accent
      '--caret-width': '2px',
      '--caret-color': '#0366d6'
    }
  },
  
  monokai: {
    id: 'monokai',
    name: 'Monokai',
    description: 'Vibrant dark theme with colorful accents',
    colors: {
      '--bg-app': '#272822',
      '--bg-sidebar': '#1e1f1c',
      '--bg-panel': '#1a1b17',
      '--bg-editor': '#272822',
      '--bg-active': 'rgba(249, 38, 114, 0.15)',
      '--bg-card': '#2d2e28',
      
      '--text-main': '#f8f8f2',
      '--text-muted': '#a6e22e',
      '--text-faint': '#75715e',
      '--text-accent': '#f92672',
      '--text-accent-rgb': '249, 38, 114',
      
      '--border-dim': '#3e3d32',
      '--border-subtle': '#49483e',
      '--border-main': '#f92672',
      '--border-card': '#3e3d32',
      
      '--scroll-thumb': '#49483e',
      '--scroll-track': '#1e1f1c',
      
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
      '--bg-app': '#002b36',
      '--bg-sidebar': '#073642',
      '--bg-panel': '#0a2933',
      '--bg-editor': '#002b36',
      '--bg-active': 'rgba(38, 139, 210, 0.15)',
      '--bg-card': '#073642',
      
      '--text-main': '#839496',
      '--text-muted': '#93a1a1',
      '--text-faint': '#586e75',
      '--text-accent': '#268bd2',
      '--text-accent-rgb': '38, 139, 210',
      
      '--border-dim': '#073642',
      '--border-subtle': '#586e75',
      '--border-main': '#268bd2',
      '--border-card': '#073642',
      
      '--scroll-thumb': '#586e75',
      '--scroll-track': '#0a2933',
      
      '--icon-primary': '#268bd2',
      '--icon-secondary': '#859900',
      '--icon-tertiary': '#b58900',
      '--icon-danger': '#dc322f',
      '--icon-love': '#d33682',
      
      // Caret (cursor) styling - 2px vertical line matching theme accent
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
      '--bg-sidebar': '#21252b',
      '--bg-panel': '#1e2127',
      '--bg-editor': '#282c34',
      '--bg-active': 'rgba(97, 175, 239, 0.15)',
      '--bg-card': '#2c313c',
      
      '--text-main': '#abb2bf',
      '--text-muted': '#5c6370',
      '--text-faint': '#4b5263',
      '--text-accent': '#61afef',
      '--text-accent-rgb': '97, 175, 239',
      
      '--border-dim': '#3e4451',
      '--border-subtle': '#4b5263',
      '--border-main': '#61afef',
      '--border-card': '#3e4451',
      
      '--scroll-thumb': '#4b5263',
      '--scroll-track': '#21252b',
      
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
      '--bg-sidebar': '#181825',
      '--bg-panel': '#11111b',
      '--bg-editor': '#1e1e2e',
      '--bg-active': 'rgba(137, 180, 250, 0.15)',
      '--bg-card': '#313244',
      
      '--text-main': '#cdd6f4',
      '--text-muted': '#bac2de',
      '--text-faint': '#6c7086',
      '--text-accent': '#89b4fa',
      '--text-accent-rgb': '137, 180, 250',
      
      '--border-dim': '#45475a',
      '--border-subtle': '#585b70',
      '--border-main': '#89b4fa',
      '--border-card': '#45475a',
      
      '--scroll-thumb': '#585b70',
      '--scroll-track': '#181825',
      
      '--icon-primary': '#89b4fa',
      '--icon-secondary': '#a6e3a1',
      '--icon-tertiary': '#f9e2af',
      '--icon-danger': '#f38ba8',
      '--icon-love': '#f5c2e7',
      
      // Caret (cursor) styling - 2px vertical line matching theme accent
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
