/**
 * Centralized Theme Definitions
 * 26 meticulously crafted, ergonomic themes with balanced contrast,
 * readable typography, and harmonious palettes for long-session comfort.
 */

export type ThemeColorKey =
  | '--bg-app'
  | '--bg-sidebar'
  | '--bg-activitybar'
  | '--bg-panel'
  | '--bg-editor'
  | '--bg-active'
  | '--bg-card'
  | '--text-main'
  | '--text-muted'
  | '--text-faint'
  | '--text-accent'
  | '--text-accent-rgb'
  | '--border-dim'
  | '--border-subtle'
  | '--border-main'
  | '--border-card'
  | '--scroll-thumb'
  | '--scroll-track'
  | '--icon-primary'
  | '--icon-secondary'
  | '--icon-tertiary'
  | '--icon-danger'
  | '--icon-love'
  | '--caret-width'
  | '--caret-color'

export type ThemeColors = Record<ThemeColorKey, string>

export interface ThemeDefinition {
  id: string
  name: string
  description: string
  colors: ThemeColors
}

export type ThemeId =
  | 'dark'
  | 'dracula'
  | 'jellyfish'
  | 'one_monokai'
  | 'mayukai'
  | 'light'
  | 'obsidian'
  | 'tokyoNight'
  | 'synthwave'
  | 'rosePine'
  | 'catppuccin'
  | 'sunset'
  | 'gruvbox'
  | 'nord'
  | 'githubDark'
  | 'monokai'
  | 'aura'
  | 'cyberpunk'
  | 'solarizedDark'
  | 'nightOwl'
  | 'everforest'
  | 'ayuMirage'
  | 'kanagawa'
  | 'horizon'
  | 'palenight'
  | 'rosePineDawn'

export const THEMES: Record<string, ThemeDefinition> = {
  dark: {
    id: 'dark',
    name: 'Dark',
    description: 'Refined deep dark theme with balanced sky-blue accents',
    colors: {
      '--bg-app': '#0c0d10',
      '--bg-sidebar': '#08080a',
      '--bg-activitybar': '#040405',
      '--bg-panel': '#14161c',
      '--bg-editor': '#0c0d10',
      '--bg-active': 'rgba(56, 189, 248, 0.14)',
      '--bg-card': '#1a1d25',
      '--text-main': '#f8fafc',
      '--text-muted': '#94a3b8',
      '--text-faint': '#5b6b83',
      '--text-accent': '#38bdf8',
      '--text-accent-rgb': '56, 189, 248',
      '--border-dim': '#1e2129',
      '--border-subtle': '#282d38',
      '--border-main': '#3e4554',
      '--border-card': '#282d38',
      '--scroll-thumb': '#2e3442',
      '--scroll-track': '#08080a',
      '--icon-primary': '#38bdf8',
      '--icon-secondary': '#34d399',
      '--icon-tertiary': '#fbbf24',
      '--icon-danger': '#f87171',
      '--icon-love': '#f472b6',
      '--caret-width': '2px',
      '--caret-color': '#38bdf8'
    }
  },

  dracula: {
    id: 'dracula',
    name: 'Dracula',
    description: 'Official Dracula dark theme with vibrant accents',
    colors: {
      '--bg-app': '#1e1f29',
      '--bg-sidebar': '#171821',
      '--bg-activitybar': '#13141c',
      '--bg-panel': '#242631',
      '--bg-editor': '#1e1f29',
      '--bg-active': 'rgba(189, 147, 249, 0.16)',
      '--bg-card': '#2b2d3a',
      '--text-main': '#f8f8f2',
      '--text-muted': '#b0b5c9',
      '--text-faint': '#6272a4',
      '--text-accent': '#bd93f9',
      '--text-accent-rgb': '189, 147, 249',
      '--border-dim': '#2a2c3a',
      '--border-subtle': '#383a4c',
      '--border-main': '#44475a',
      '--border-card': '#383a4c',
      '--scroll-thumb': '#44475a',
      '--scroll-track': '#171821',
      '--icon-primary': '#bd93f9',
      '--icon-secondary': '#50fa7b',
      '--icon-tertiary': '#f1fa8c',
      '--icon-danger': '#ff5555',
      '--icon-love': '#ff79c6',
      '--caret-width': '2px',
      '--caret-color': '#ff79c6'
    }
  },

  jellyfish: {
    id: 'jellyfish',
    name: 'JellyFish',
    description: 'Deep ocean midnight with electric bioluminescent cyan & indigo',
    colors: {
      '--bg-app': '#0d111d',
      '--bg-sidebar': '#080b14',
      '--bg-activitybar': '#05070d',
      '--bg-panel': '#141c30',
      '--bg-editor': '#0d111d',
      '--bg-active': 'rgba(56, 189, 248, 0.16)',
      '--bg-card': '#1a223a',
      '--text-main': '#f0f6fc',
      '--text-muted': '#8ca0c2',
      '--text-faint': '#546685',
      '--text-accent': '#38bdf8',
      '--text-accent-rgb': '56, 189, 248',
      '--border-dim': '#162035',
      '--border-subtle': '#22304e',
      '--border-main': '#30446e',
      '--border-card': '#22304e',
      '--scroll-thumb': '#273859',
      '--scroll-track': '#080b14',
      '--icon-primary': '#38bdf8',
      '--icon-secondary': '#48cae4',
      '--icon-tertiary': '#c084fc',
      '--icon-danger': '#f43f5e',
      '--icon-love': '#f472b6',
      '--caret-width': '2px',
      '--caret-color': '#38bdf8'
    }
  },

  one_monokai: {
    id: 'one_monokai',
    name: 'One Monokai',
    description: 'A fusion of One Dark and Monokai color palettes',
    colors: {
      '--bg-app': '#181a1f',
      '--bg-sidebar': '#121417',
      '--bg-activitybar': '#0d0e11',
      '--bg-panel': '#20242c',
      '--bg-editor': '#181a1f',
      '--bg-active': 'rgba(97, 175, 239, 0.16)',
      '--bg-card': '#262a33',
      '--text-main': '#e6edf3',
      '--text-muted': '#9da5b4',
      '--text-faint': '#5c6370',
      '--text-accent': '#61afef',
      '--text-accent-rgb': '97, 175, 239',
      '--border-dim': '#21252b',
      '--border-subtle': '#2d333b',
      '--border-main': '#3e4451',
      '--border-card': '#2d333b',
      '--scroll-thumb': '#3e4451',
      '--scroll-track': '#121417',
      '--icon-primary': '#61afef',
      '--icon-secondary': '#98c379',
      '--icon-tertiary': '#e5c07b',
      '--icon-danger': '#e06c75',
      '--icon-love': '#c678dd',
      '--caret-width': '2px',
      '--caret-color': '#61afef'
    }
  },

  mayukai: {
    id: 'mayukai',
    name: 'Mayukai',
    description: 'Deep mirage dark canvas with luminous amber and gold accents',
    colors: {
      '--bg-app': '#141820',
      '--bg-sidebar': '#0f1218',
      '--bg-activitybar': '#0a0d12',
      '--bg-panel': '#1c222e',
      '--bg-editor': '#141820',
      '--bg-active': 'rgba(255, 204, 102, 0.15)',
      '--bg-card': '#242c3b',
      '--text-main': '#f0ede1',
      '--text-muted': '#a0aab8',
      '--text-faint': '#5f6c7d',
      '--text-accent': '#ffcc66',
      '--text-accent-rgb': '255, 204, 102',
      '--border-dim': '#1e2430',
      '--border-subtle': '#293242',
      '--border-main': '#3c495f',
      '--border-card': '#293242',
      '--scroll-thumb': '#344054',
      '--scroll-track': '#0f1218',
      '--icon-primary': '#ffcc66',
      '--icon-secondary': '#a3be8c',
      '--icon-tertiary': '#5ccfe6',
      '--icon-danger': '#f28779',
      '--icon-love': '#f07178',
      '--caret-width': '2px',
      '--caret-color': '#ffcc66'
    }
  },

  light: {
    id: 'light',
    name: 'Minimal Light',
    description: 'Clean, Apple-inspired light theme with soft slate surfaces',
    colors: {
      '--bg-app': '#ffffff',
      '--bg-sidebar': '#f8fafc',
      '--bg-activitybar': '#f1f5f9',
      '--bg-panel': '#f1f5f9',
      '--bg-editor': '#ffffff',
      '--bg-active': 'rgba(2, 132, 199, 0.08)',
      '--bg-card': '#ffffff',
      '--text-main': '#0f172a',
      '--text-muted': '#475569',
      '--text-faint': '#94a3b8',
      '--text-accent': '#0284c7',
      '--text-accent-rgb': '2, 132, 199',
      '--border-dim': '#e2e8f0',
      '--border-subtle': '#cbd5e1',
      '--border-main': '#94a3b8',
      '--border-card': '#e2e8f0',
      '--scroll-thumb': '#cbd5e1',
      '--scroll-track': '#f8fafc',
      '--icon-primary': '#0284c7',
      '--icon-secondary': '#10b981',
      '--icon-tertiary': '#f59e0b',
      '--icon-danger': '#ef4444',
      '--icon-love': '#ec4899',
      '--caret-width': '2px',
      '--caret-color': '#0284c7'
    }
  },

  obsidian: {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'Deep true black with royal purple accents',
    colors: {
      '--bg-app': '#08080a',
      '--bg-sidebar': '#040406',
      '--bg-activitybar': '#000000',
      '--bg-panel': '#121218',
      '--bg-editor': '#08080a',
      '--bg-active': 'rgba(168, 85, 247, 0.15)',
      '--bg-card': '#1a1a24',
      '--text-main': '#f8fafc',
      '--text-muted': '#a1a1b5',
      '--text-faint': '#6b6b7d',
      '--text-accent': '#a855f7',
      '--text-accent-rgb': '168, 85, 247',
      '--border-dim': '#1e1e28',
      '--border-subtle': '#2a2a38',
      '--border-main': '#3f3f4e',
      '--border-card': '#2a2a38',
      '--scroll-thumb': '#2a2a38',
      '--scroll-track': '#040406',
      '--icon-primary': '#a855f7',
      '--icon-secondary': '#34d399',
      '--icon-tertiary': '#fbbf24',
      '--icon-danger': '#f87171',
      '--icon-love': '#f472b6',
      '--caret-width': '2px',
      '--caret-color': '#a855f7'
    }
  },

  tokyoNight: {
    id: 'tokyoNight',
    name: 'Tokyo Night',
    description: 'A dark and soothing theme celebrating the lights of Tokyo',
    colors: {
      '--bg-app': '#1a1b26',
      '--bg-sidebar': '#16161e',
      '--bg-activitybar': '#12131a',
      '--bg-panel': '#212537',
      '--bg-editor': '#1a1b26',
      '--bg-active': 'rgba(122, 162, 247, 0.16)',
      '--bg-card': '#282c40',
      '--text-main': '#c0caf5',
      '--text-muted': '#9aa5ce',
      '--text-faint': '#565f89',
      '--text-accent': '#7aa2f7',
      '--text-accent-rgb': '122, 162, 247',
      '--border-dim': '#23263a',
      '--border-subtle': '#292e42',
      '--border-main': '#3b4261',
      '--border-card': '#292e42',
      '--scroll-thumb': '#3b4261',
      '--scroll-track': '#16161e',
      '--icon-primary': '#7aa2f7',
      '--icon-secondary': '#9ece6a',
      '--icon-tertiary': '#e0af68',
      '--icon-danger': '#f7768e',
      '--icon-love': '#bb9af7',
      '--caret-width': '2px',
      '--caret-color': '#7aa2f7'
    }
  },

  synthwave: {
    id: 'synthwave',
    name: 'Synthwave',
    description: 'Outrun retro-futuristic neon theme',
    colors: {
      '--bg-app': '#241b2f',
      '--bg-sidebar': '#1c1527',
      '--bg-activitybar': '#15101f',
      '--bg-panel': '#2f2340',
      '--bg-editor': '#241b2f',
      '--bg-active': 'rgba(255, 126, 219, 0.16)',
      '--bg-card': '#392b4d',
      '--text-main': '#f9f8fe',
      '--text-muted': '#bda8d6',
      '--text-faint': '#735d8e',
      '--text-accent': '#ff7edb',
      '--text-accent-rgb': '255, 126, 219',
      '--border-dim': '#322644',
      '--border-subtle': '#3f3056',
      '--border-main': '#614d85',
      '--border-card': '#3f3056',
      '--scroll-thumb': '#614d85',
      '--scroll-track': '#1c1527',
      '--icon-primary': '#ff7edb',
      '--icon-secondary': '#72f1b8',
      '--icon-tertiary': '#fede5d',
      '--icon-danger': '#fe4450',
      '--icon-love': '#f97e72',
      '--caret-width': '2px',
      '--caret-color': '#ff7edb'
    }
  },

  rosePine: {
    id: 'rosePine',
    name: 'Rosé Pine',
    description: 'All natural pine, faux fur and a bit of soho vibes',
    colors: {
      '--bg-app': '#191724',
      '--bg-sidebar': '#1f1d2e',
      '--bg-activitybar': '#14121f',
      '--bg-panel': '#282539',
      '--bg-editor': '#191724',
      '--bg-active': 'rgba(235, 188, 186, 0.15)',
      '--bg-card': '#2e2b40',
      '--text-main': '#e0def4',
      '--text-muted': '#908caa',
      '--text-faint': '#6e6a86',
      '--text-accent': '#ebbcba',
      '--text-accent-rgb': '235, 188, 186',
      '--border-dim': '#262338',
      '--border-subtle': '#312f44',
      '--border-main': '#44415a',
      '--border-card': '#312f44',
      '--scroll-thumb': '#44415a',
      '--scroll-track': '#1f1d2e',
      '--icon-primary': '#ebbcba',
      '--icon-secondary': '#31748f',
      '--icon-tertiary': '#f6c177',
      '--icon-danger': '#eb6f92',
      '--icon-love': '#c4a7e7',
      '--caret-width': '2px',
      '--caret-color': '#ebbcba'
    }
  },

  catppuccin: {
    id: 'catppuccin',
    name: 'Catppuccin Mocha',
    description: 'Soothing pastel theme for the high-spirited',
    colors: {
      '--bg-app': '#1e1e2e',
      '--bg-sidebar': '#181825',
      '--bg-activitybar': '#11111b',
      '--bg-panel': '#26263c',
      '--bg-editor': '#1e1e2e',
      '--bg-active': 'rgba(137, 180, 250, 0.15)',
      '--bg-card': '#313244',
      '--text-main': '#cdd6f4',
      '--text-muted': '#a6adc8',
      '--text-faint': '#6c7086',
      '--text-accent': '#89b4fa',
      '--text-accent-rgb': '137, 180, 250',
      '--border-dim': '#2a2a3c',
      '--border-subtle': '#36374a',
      '--border-main': '#585b70',
      '--border-card': '#36374a',
      '--scroll-thumb': '#45475a',
      '--scroll-track': '#181825',
      '--icon-primary': '#89b4fa',
      '--icon-secondary': '#a6e3a1',
      '--icon-tertiary': '#f9e2af',
      '--icon-danger': '#f38ba8',
      '--icon-love': '#f5c2e7',
      '--caret-width': '2px',
      '--caret-color': '#89b4fa'
    }
  },

  sunset: {
    id: 'sunset',
    name: 'Sunset',
    description: 'A warm, moody dark purple and crimson sunset',
    colors: {
      '--bg-app': '#1a0818',
      '--bg-sidebar': '#140513',
      '--bg-activitybar': '#0e030d',
      '--bg-panel': '#261023',
      '--bg-editor': '#1a0818',
      '--bg-active': 'rgba(249, 115, 22, 0.16)',
      '--bg-card': '#33172f',
      '--text-main': '#fee2e2',
      '--text-muted': '#cca5b2',
      '--text-faint': '#8a6472',
      '--text-accent': '#f97316',
      '--text-accent-rgb': '249, 115, 22',
      '--border-dim': '#32142f',
      '--border-subtle': '#451b40',
      '--border-main': '#6b1432',
      '--border-card': '#451b40',
      '--scroll-thumb': '#451b40',
      '--scroll-track': '#140513',
      '--icon-primary': '#f97316',
      '--icon-secondary': '#facc15',
      '--icon-tertiary': '#fb7185',
      '--icon-danger': '#ef4444',
      '--icon-love': '#f43f5e',
      '--caret-width': '2px',
      '--caret-color': '#f97316'
    }
  },

  gruvbox: {
    id: 'gruvbox',
    name: 'Gruvbox Dark',
    description: 'Warm, soothing retro groove palette crafted for gentle all-day eye comfort',
    colors: {
      '--bg-app': '#282828',
      '--bg-sidebar': '#1d2021',
      '--bg-activitybar': '#17191a',
      '--bg-panel': '#32302f',
      '--bg-editor': '#282828',
      '--bg-active': 'rgba(215, 153, 33, 0.15)',
      '--bg-card': '#3c3836',
      '--text-main': '#ebdbb2',
      '--text-muted': '#a89984',
      '--text-faint': '#7c6f64',
      '--text-accent': '#d79921',
      '--text-accent-rgb': '215, 153, 33',
      '--border-dim': '#32302f',
      '--border-subtle': '#3c3836',
      '--border-main': '#504945',
      '--border-card': '#3c3836',
      '--scroll-thumb': '#504945',
      '--scroll-track': '#1d2021',
      '--icon-primary': '#d79921',
      '--icon-secondary': '#98971a',
      '--icon-tertiary': '#458588',
      '--icon-danger': '#cc241d',
      '--icon-love': '#b16286',
      '--caret-width': '2px',
      '--caret-color': '#d79921'
    }
  },

  nord: {
    id: 'nord',
    name: 'Nord',
    description: 'Arctic, north-bluish color palette',
    colors: {
      '--bg-app': '#2e3440',
      '--bg-sidebar': '#242933',
      '--bg-activitybar': '#1d222a',
      '--bg-panel': '#3b4252',
      '--bg-editor': '#2e3440',
      '--bg-active': 'rgba(136, 192, 208, 0.16)',
      '--bg-card': '#434c5e',
      '--text-main': '#eceff4',
      '--text-muted': '#d8dee9',
      '--text-faint': '#7b88a1',
      '--text-accent': '#88c0d0',
      '--text-accent-rgb': '136, 192, 208',
      '--border-dim': '#373e4d',
      '--border-subtle': '#434c5e',
      '--border-main': '#4c566a',
      '--border-card': '#434c5e',
      '--scroll-thumb': '#4c566a',
      '--scroll-track': '#242933',
      '--icon-primary': '#88c0d0',
      '--icon-secondary': '#a3be8c',
      '--icon-tertiary': '#ebcb8b',
      '--icon-danger': '#bf616a',
      '--icon-love': '#b48ead',
      '--caret-width': '2px',
      '--caret-color': '#88c0d0'
    }
  },

  githubDark: {
    id: 'githubDark',
    name: 'GitHub Dark',
    description: "GitHub's signature dark aesthetic",
    colors: {
      '--bg-app': '#0d1117',
      '--bg-sidebar': '#080c11',
      '--bg-activitybar': '#010409',
      '--bg-panel': '#161b22',
      '--bg-editor': '#0d1117',
      '--bg-active': 'rgba(88, 166, 255, 0.15)',
      '--bg-card': '#1c2128',
      '--text-main': '#f0f6fc',
      '--text-muted': '#8b949e',
      '--text-faint': '#6e7681',
      '--text-accent': '#58a6ff',
      '--text-accent-rgb': '88, 166, 255',
      '--border-dim': '#21262d',
      '--border-subtle': '#30363d',
      '--border-main': '#484f58',
      '--border-card': '#30363d',
      '--scroll-thumb': '#30363d',
      '--scroll-track': '#010409',
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
    name: 'Monokai Pro',
    description: 'Beautiful color-balanced dark theme',
    colors: {
      '--bg-app': '#222222',
      '--bg-sidebar': '#191919',
      '--bg-activitybar': '#141414',
      '--bg-panel': '#2a2a2a',
      '--bg-editor': '#222222',
      '--bg-active': 'rgba(255, 216, 102, 0.15)',
      '--bg-card': '#333333',
      '--text-main': '#fcfcfa',
      '--text-muted': '#c1c0c0',
      '--text-faint': '#757175',
      '--text-accent': '#ffd866',
      '--text-accent-rgb': '255, 216, 102',
      '--border-dim': '#303030',
      '--border-subtle': '#403e41',
      '--border-main': '#5b595c',
      '--border-card': '#403e41',
      '--scroll-thumb': '#5b595c',
      '--scroll-track': '#191919',
      '--icon-primary': '#ffd866',
      '--icon-secondary': '#a9dc76',
      '--icon-tertiary': '#fc9867',
      '--icon-danger': '#ff6188',
      '--icon-love': '#ab9df2',
      '--caret-width': '2px',
      '--caret-color': '#ffd866'
    }
  },

  aura: {
    id: 'aura',
    name: 'Aura Theme',
    description: 'A beautiful dark theme with vivid purples and greens',
    colors: {
      '--bg-app': '#15141b',
      '--bg-sidebar': '#111016',
      '--bg-activitybar': '#0c0b10',
      '--bg-panel': '#1d1b27',
      '--bg-editor': '#15141b',
      '--bg-active': 'rgba(162, 119, 255, 0.15)',
      '--bg-card': '#252230',
      '--text-main': '#edecee',
      '--text-muted': '#a39ec4',
      '--text-faint': '#6d678e',
      '--text-accent': '#a277ff',
      '--text-accent-rgb': '162, 119, 255',
      '--border-dim': '#242130',
      '--border-subtle': '#343144',
      '--border-main': '#423f53',
      '--border-card': '#343144',
      '--scroll-thumb': '#423f53',
      '--scroll-track': '#111016',
      '--icon-primary': '#a277ff',
      '--icon-secondary': '#61ffca',
      '--icon-tertiary': '#ffca85',
      '--icon-danger': '#ff6767',
      '--icon-love': '#f694ff',
      '--caret-width': '2px',
      '--caret-color': '#a277ff'
    }
  },

  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    description: 'Deep navy futuristic theme with balanced neon cyan accents',
    colors: {
      '--bg-app': '#0c101c',
      '--bg-sidebar': '#080c16',
      '--bg-activitybar': '#05070d',
      '--bg-panel': '#141b2d',
      '--bg-editor': '#0c101c',
      '--bg-active': 'rgba(0, 229, 255, 0.15)',
      '--bg-card': '#1b2438',
      '--text-main': '#f0f4ff',
      '--text-muted': '#90a0c4',
      '--text-faint': '#58688c',
      '--text-accent': '#00e5ff',
      '--text-accent-rgb': '0, 229, 255',
      '--border-dim': '#141d30',
      '--border-subtle': '#1e2b46',
      '--border-main': '#32446a',
      '--border-card': '#1e2b46',
      '--scroll-thumb': '#2d3f66',
      '--scroll-track': '#080c16',
      '--icon-primary': '#00e5ff',
      '--icon-secondary': '#00e676',
      '--icon-tertiary': '#ffd600',
      '--icon-danger': '#ff1744',
      '--icon-love': '#f50057',
      '--caret-width': '2px',
      '--caret-color': '#00e5ff'
    }
  },

  solarizedDark: {
    id: 'solarizedDark',
    name: 'Solarized Dark',
    description: 'Classic precision colors for comfortable long-form reading',
    colors: {
      '--bg-app': '#002b36',
      '--bg-sidebar': '#00212b',
      '--bg-activitybar': '#001a22',
      '--bg-panel': '#073642',
      '--bg-editor': '#002b36',
      '--bg-active': 'rgba(42, 161, 152, 0.16)',
      '--bg-card': '#0e4452',
      '--text-main': '#fdf6e3',
      '--text-muted': '#93a1a1',
      '--text-faint': '#657b83',
      '--text-accent': '#2aa198',
      '--text-accent-rgb': '42, 161, 152',
      '--border-dim': '#083c48',
      '--border-subtle': '#134e5c',
      '--border-main': '#586e75',
      '--border-card': '#134e5c',
      '--scroll-thumb': '#586e75',
      '--scroll-track': '#00212b',
      '--icon-primary': '#2aa198',
      '--icon-secondary': '#859900',
      '--icon-tertiary': '#b58900',
      '--icon-danger': '#dc322f',
      '--icon-love': '#d33682',
      '--caret-width': '2px',
      '--caret-color': '#2aa198'
    }
  },

  nightOwl: {
    id: 'nightOwl',
    name: 'Night Owl',
    description: 'Deep blue background tuned for late night sessions',
    colors: {
      '--bg-app': '#011627',
      '--bg-sidebar': '#01111e',
      '--bg-activitybar': '#010a13',
      '--bg-panel': '#0b2942',
      '--bg-editor': '#011627',
      '--bg-active': 'rgba(130, 170, 255, 0.16)',
      '--bg-card': '#123452',
      '--text-main': '#d6deeb',
      '--text-muted': '#7e97b8',
      '--text-faint': '#5f7e97',
      '--text-accent': '#82aaff',
      '--text-accent-rgb': '130, 170, 255',
      '--border-dim': '#132b40',
      '--border-subtle': '#204360',
      '--border-main': '#5f7e97',
      '--border-card': '#204360',
      '--scroll-thumb': '#2c4c68',
      '--scroll-track': '#01111e',
      '--icon-primary': '#82aaff',
      '--icon-secondary': '#22da6e',
      '--icon-tertiary': '#addb67',
      '--icon-danger': '#ef5350',
      '--icon-love': '#c792ea',
      '--caret-width': '2px',
      '--caret-color': '#80cbc4'
    }
  },

  everforest: {
    id: 'everforest',
    name: 'Everforest',
    description: 'Serene green-based warm dark theme with earthy comfort',
    colors: {
      '--bg-app': '#272e33',
      '--bg-sidebar': '#22272a',
      '--bg-activitybar': '#1c2023',
      '--bg-panel': '#2e383c',
      '--bg-editor': '#272e33',
      '--bg-active': 'rgba(167, 192, 128, 0.16)',
      '--bg-card': '#374247',
      '--text-main': '#d3c6aa',
      '--text-muted': '#9da9a0',
      '--text-faint': '#7a8478',
      '--text-accent': '#a7c080',
      '--text-accent-rgb': '167, 192, 128',
      '--border-dim': '#333e42',
      '--border-subtle': '#404d52',
      '--border-main': '#5c6a70',
      '--border-card': '#404d52',
      '--scroll-thumb': '#4b565c',
      '--scroll-track': '#22272a',
      '--icon-primary': '#a7c080',
      '--icon-secondary': '#83c092',
      '--icon-tertiary': '#dbbc7f',
      '--icon-danger': '#e67e80',
      '--icon-love': '#d699b6',
      '--caret-width': '2px',
      '--caret-color': '#a7c080'
    }
  },

  ayuMirage: {
    id: 'ayuMirage',
    name: 'Ayu Mirage',
    description: 'Warm slate-blue dark theme with glowing amber-gold accents',
    colors: {
      '--bg-app': '#1f2430',
      '--bg-sidebar': '#191d27',
      '--bg-activitybar': '#141821',
      '--bg-panel': '#272c3a',
      '--bg-editor': '#1f2430',
      '--bg-active': 'rgba(230, 180, 80, 0.15)',
      '--bg-card': '#2f3545',
      '--text-main': '#cbccc6',
      '--text-muted': '#8a9199',
      '--text-faint': '#5c6773',
      '--text-accent': '#e6b450',
      '--text-accent-rgb': '230, 180, 80',
      '--border-dim': '#1e242d',
      '--border-subtle': '#2a3140',
      '--border-main': '#3d4759',
      '--border-card': '#2a3140',
      '--scroll-thumb': '#3d4759',
      '--scroll-track': '#191d27',
      '--icon-primary': '#e6b450',
      '--icon-secondary': '#95e6cb',
      '--icon-tertiary': '#d4bfff',
      '--icon-danger': '#f07178',
      '--icon-love': '#f29e74',
      '--caret-width': '2px',
      '--caret-color': '#e6b450'
    }
  },

  kanagawa: {
    id: 'kanagawa',
    name: 'Kanagawa',
    description: 'Japanese ink-wash palette inspired by Hokusai\u2019s great wave',
    colors: {
      '--bg-app': '#1f1f28',
      '--bg-sidebar': '#16161d',
      '--bg-activitybar': '#101014',
      '--bg-panel': '#272731',
      '--bg-editor': '#1f1f28',
      '--bg-active': 'rgba(126, 156, 216, 0.15)',
      '--bg-card': '#2a2a37',
      '--text-main': '#dcd7ba',
      '--text-muted': '#9e9b8f',
      '--text-faint': '#63604e',
      '--text-accent': '#7e9cd8',
      '--text-accent-rgb': '126, 156, 216',
      '--border-dim': '#1a1a22',
      '--border-subtle': '#2a2a37',
      '--border-main': '#363646',
      '--border-card': '#2a2a37',
      '--scroll-thumb': '#363646',
      '--scroll-track': '#16161d',
      '--icon-primary': '#7e9cd8',
      '--icon-secondary': '#98bb6c',
      '--icon-tertiary': '#e6c384',
      '--icon-danger': '#e46876',
      '--icon-love': '#d27e99',
      '--caret-width': '2px',
      '--caret-color': '#7e9cd8'
    }
  },

  horizon: {
    id: 'horizon',
    name: 'Horizon',
    description: 'Moody twilight dark theme with vivid coral-pink accents',
    colors: {
      '--bg-app': '#1c1e26',
      '--bg-sidebar': '#16171d',
      '--bg-activitybar': '#101116',
      '--bg-panel': '#242732',
      '--bg-editor': '#1c1e26',
      '--bg-active': 'rgba(233, 86, 120, 0.15)',
      '--bg-card': '#2b2e3b',
      '--text-main': '#d5d8da',
      '--text-muted': '#9da5b0',
      '--text-faint': '#666f7a',
      '--text-accent': '#e95678',
      '--text-accent-rgb': '233, 86, 120',
      '--border-dim': '#1e2029',
      '--border-subtle': '#292c38',
      '--border-main': '#3d4152',
      '--border-card': '#292c38',
      '--scroll-thumb': '#3d4152',
      '--scroll-track': '#16171d',
      '--icon-primary': '#e95678',
      '--icon-secondary': '#29d398',
      '--icon-tertiary': '#fab795',
      '--icon-danger': '#f43e5c',
      '--icon-love': '#b877db',
      '--caret-width': '2px',
      '--caret-color': '#e95678'
    }
  },

  palenight: {
    id: 'palenight',
    name: 'Palenight',
    description: 'Material-inspired indigo dark theme with soft violet accents',
    colors: {
      '--bg-app': '#292d3e',
      '--bg-sidebar': '#232635',
      '--bg-activitybar': '#1c1f2b',
      '--bg-panel': '#31354a',
      '--bg-editor': '#292d3e',
      '--bg-active': 'rgba(199, 146, 234, 0.15)',
      '--bg-card': '#383c54',
      '--text-main': '#e4e6f7',
      '--text-muted': '#9099c7',
      '--text-faint': '#5f6690',
      '--text-accent': '#c792ea',
      '--text-accent-rgb': '199, 146, 234',
      '--border-dim': '#262a3d',
      '--border-subtle': '#333752',
      '--border-main': '#454a6b',
      '--border-card': '#333752',
      '--scroll-thumb': '#454a6b',
      '--scroll-track': '#232635',
      '--icon-primary': '#c792ea',
      '--icon-secondary': '#c3e88d',
      '--icon-tertiary': '#ffcb6b',
      '--icon-danger': '#f07178',
      '--icon-love': '#f78c6c',
      '--caret-width': '2px',
      '--caret-color': '#c792ea'
    }
  },

  rosePineDawn: {
    id: 'rosePineDawn',
    name: 'Ros\u00e9 Pine Dawn',
    description: 'Soft, warm light theme with dusty rose and pine accents',
    colors: {
      '--bg-app': '#faf4ed',
      '--bg-sidebar': '#fffaf3',
      '--bg-activitybar': '#f2e9e1',
      '--bg-panel': '#f2e9e1',
      '--bg-editor': '#faf4ed',
      '--bg-active': 'rgba(215, 130, 126, 0.10)',
      '--bg-card': '#fffaf3',
      '--text-main': '#575279',
      '--text-muted': '#797593',
      '--text-faint': '#9893a5',
      '--text-accent': '#d7827e',
      '--text-accent-rgb': '215, 130, 126',
      '--border-dim': '#f2e9e1',
      '--border-subtle': '#dfdad9',
      '--border-main': '#cecacd',
      '--border-card': '#dfdad9',
      '--scroll-thumb': '#cecacd',
      '--scroll-track': '#f2e9e1',
      '--icon-primary': '#d7827e',
      '--icon-secondary': '#286983',
      '--icon-tertiary': '#ea9d34',
      '--icon-danger': '#b4637a',
      '--icon-love': '#907aa9',
      '--caret-width': '2px',
      '--caret-color': '#d7827e'
    }
  }
}

/**
 * Get theme by ID
 */
export const getTheme = (themeId?: string): ThemeDefinition => {
  return (themeId && THEMES[themeId]) || THEMES.dark
}

/**
 * Get all theme IDs
 */
export const getThemeIds = (): string[] => {
  return Object.keys(THEMES)
}

/**
 * Convert hex color to rgb string
 */
const hexToRgb = (hex: string): string | null => {
  if (!hex) return null
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : null
}

/**
 * Apply theme to document
 * Applies all theme colors including caret styling
 * Caret color matches theme accent unless user has set a custom color
 *
 * @param themeId - Theme identifier
 */
export const applyTheme = (themeId: string): void => {
  const theme = getTheme(themeId)
  const root = document.documentElement

  // Check if user has custom caret color (from useFontSettings)
  let customCaretColor: string | null = null
  let customCaretWidth: string | null = null
  let customThemeAccentColor: string | null = null

  try {
    const savedColors = localStorage.getItem('theme-colors')
    if (savedColors) {
      const parsed = JSON.parse(savedColors)
      if (parsed.caretColor && typeof parsed.caretColor === 'string' && parsed.caretColor.trim() !== '') {
        customCaretColor = parsed.caretColor
      }
      if (parsed.caretWidth && parsed.caretWidth !== '2px') {
        customCaretWidth = parsed.caretWidth
      }
      if (parsed.themeAccentColor && typeof parsed.themeAccentColor === 'string' && parsed.themeAccentColor.trim() !== '') {
        customThemeAccentColor = parsed.themeAccentColor
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
    if (varName === '--caret-color' && customCaretColor) {
      root.style.setProperty(varName, customCaretColor)
    } else if (varName === '--caret-width' && customCaretWidth) {
      root.style.setProperty(varName, customCaretWidth)
    } else if (varName === '--text-accent' && customThemeAccentColor) {
      root.style.setProperty(varName, customThemeAccentColor)
    } else if (varName === '--text-accent-rgb' && customThemeAccentColor) {
      const rgb = hexToRgb(customThemeAccentColor)
      root.style.setProperty(varName, rgb || value)
    } else {
      root.style.setProperty(varName, value)
    }
  })

  // Set data attribute
  root.setAttribute('data-theme', themeId)

  // Persist to localStorage
  localStorage.setItem('theme-id', themeId)
}