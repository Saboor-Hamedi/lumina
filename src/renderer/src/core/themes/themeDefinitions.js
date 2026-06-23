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

  dracula: {
    id: 'dracula',
    name: 'Dracula',
    description: 'Official Dracula dark theme with vibrant accents',
    colors: {
      '--bg-app': '#282a36',
      '--bg-sidebar': '#21222c',
      '--bg-activitybar': '#191a21',
      '--bg-panel': '#282a36',
      '--bg-editor': '#282a36',
      '--bg-active': 'rgba(68, 71, 90, 0.5)',
      '--bg-card': '#282a36',
      '--text-main': '#f8f8f2',
      '--text-muted': '#6272a4',
      '--text-faint': '#44475a',
      '--text-accent': '#bd93f9',
      '--text-accent-rgb': '189, 147, 249',
      '--border-dim': '#44475a',
      '--border-subtle': '#44475a',
      '--border-main': '#6272a4',
      '--border-card': '#44475a',
      '--scroll-thumb': '#44475a',
      '--scroll-track': '#282a36',
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
    description: 'Deep ocean blue with neon bioluminescent accents',
    colors: {
      '--bg-app': '#1c1c2e',
      '--bg-sidebar': '#151522',
      '--bg-activitybar': '#0f0f18',
      '--bg-panel': '#212134',
      '--bg-editor': '#1c1c2e',
      '--bg-active': 'rgba(92, 201, 245, 0.15)',
      '--bg-card': '#25253a',
      '--text-main': '#e2e2e2',
      '--text-muted': '#acafff',
      '--text-faint': '#565675',
      '--text-accent': '#00a6fb',
      '--text-accent-rgb': '0, 166, 251',
      '--border-dim': '#2a2a40',
      '--border-subtle': '#363654',
      '--border-main': '#4a4a70',
      '--border-card': '#363654',
      '--scroll-thumb': '#363654',
      '--scroll-track': '#1c1c2e',
      '--icon-primary': '#00a6fb',
      '--icon-secondary': '#5cc9f5',
      '--icon-tertiary': '#da68fb',
      '--icon-danger': '#f88dad',
      '--icon-love': '#f88dad',
      '--caret-width': '2px',
      '--caret-color': '#00a6fb'
    }
  },

  one_monokai: {
    id: 'one_monokai',
    name: 'One Monokai',
    description: 'A fusion of One Dark and Monokai color palettes',
    colors: {
      '--bg-app': '#181818',
      '--bg-sidebar': '#131313',
      '--bg-activitybar': '#0f0f0f',
      '--bg-panel': '#1e1e1e',
      '--bg-editor': '#181818',
      '--bg-active': 'rgba(97, 175, 239, 0.15)',
      '--bg-card': '#222222',
      '--text-main': '#abb2bf',
      '--text-muted': '#676f7d',
      '--text-faint': '#4b5263',
      '--text-accent': '#e06c75',
      '--text-accent-rgb': '224, 108, 117',
      '--border-dim': '#282c34',
      '--border-subtle': '#3e4451',
      '--border-main': '#545862',
      '--border-card': '#282c34',
      '--scroll-thumb': '#3e4451',
      '--scroll-track': '#181818',
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
    description: 'Bright and punchy theme inspired by Ayu and Mirage',
    colors: {
      '--bg-app': '#212733',
      '--bg-sidebar': '#1a1f29',
      '--bg-activitybar': '#151921',
      '--bg-panel': '#272d3b',
      '--bg-editor': '#212733',
      '--bg-active': 'rgba(255, 204, 102, 0.15)',
      '--bg-card': '#2a3140',
      '--text-main': '#d9d7ce',
      '--text-muted': '#5c6773',
      '--text-faint': '#3d4752',
      '--text-accent': '#ffcc66',
      '--text-accent-rgb': '255, 204, 102',
      '--border-dim': '#2d3545',
      '--border-subtle': '#394357',
      '--border-main': '#4a5770',
      '--border-card': '#2d3545',
      '--scroll-thumb': '#394357',
      '--scroll-track': '#212733',
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
    description: 'Clean, Apple-inspired light theme',
    colors: {
      '--bg-app': '#ffffff',
      '--bg-sidebar': '#f9fafb',
      '--bg-activitybar': '#f3f4f6',
      '--bg-panel': '#f3f4f6',
      '--bg-editor': '#ffffff',
      '--bg-active': 'rgba(14, 165, 233, 0.1)',
      '--bg-card': '#ffffff',
      '--text-main': '#111827',
      '--text-muted': '#6b7280',
      '--text-faint': '#9ca3af',
      '--text-accent': '#0ea5e9',
      '--text-accent-rgb': '14, 165, 233',
      '--border-dim': '#f3f4f6',
      '--border-subtle': '#e5e7eb',
      '--border-main': '#d1d5db',
      '--border-card': '#e5e7eb',
      '--scroll-thumb': '#d1d5db',
      '--scroll-track': '#f9fafb',
      '--icon-primary': '#0ea5e9',
      '--icon-secondary': '#10b981',
      '--icon-tertiary': '#f59e0b',
      '--icon-danger': '#ef4444',
      '--icon-love': '#ec4899',
      '--caret-width': '2px',
      '--caret-color': '#0ea5e9'
    }
  },

  obsidian: {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'Deep true black with royal purple accents',
    colors: {
      '--bg-app': '#000000',
      '--bg-sidebar': '#0a0a0a',
      '--bg-activitybar': '#050505',
      '--bg-panel': '#0c0c0c',
      '--bg-editor': '#000000',
      '--bg-active': 'rgba(139, 92, 246, 0.15)',
      '--bg-card': '#121212',
      '--text-main': '#e2e8f0',
      '--text-muted': '#94a3b8',
      '--text-faint': '#475569',
      '--text-accent': '#a78bfa',
      '--text-accent-rgb': '167, 139, 250',
      '--border-dim': '#1e1e1e',
      '--border-subtle': '#27272a',
      '--border-main': '#3f3f46',
      '--border-card': '#27272a',
      '--scroll-thumb': '#27272a',
      '--scroll-track': '#000000',
      '--icon-primary': '#a78bfa',
      '--icon-secondary': '#34d399',
      '--icon-tertiary': '#fbbf24',
      '--icon-danger': '#f87171',
      '--icon-love': '#f472b6',
      '--caret-width': '2px',
      '--caret-color': '#a78bfa'
    }
  },

  tokyoNight: {
    id: 'tokyoNight',
    name: 'Tokyo Night',
    description: 'A dark and soothing theme celebrating the lights of Tokyo',
    colors: {
      '--bg-app': '#1a1b26',
      '--bg-sidebar': '#16161e',
      '--bg-activitybar': '#15161e',
      '--bg-panel': '#1f2335',
      '--bg-editor': '#1a1b26',
      '--bg-active': 'rgba(122, 162, 247, 0.15)',
      '--bg-card': '#24283b',
      '--text-main': '#c0caf5',
      '--text-muted': '#565f89',
      '--text-faint': '#414868',
      '--text-accent': '#7aa2f7',
      '--text-accent-rgb': '122, 162, 247',
      '--border-dim': '#272a40',
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
      '--bg-app': '#262335',
      '--bg-sidebar': '#1f1d2b',
      '--bg-activitybar': '#181622',
      '--bg-panel': '#2b2640',
      '--bg-editor': '#262335',
      '--bg-active': 'rgba(255, 126, 219, 0.15)',
      '--bg-card': '#362f4f',
      '--text-main': '#fcfcfa',
      '--text-muted': '#848bbd',
      '--text-faint': '#495495',
      '--text-accent': '#ff7edb',
      '--text-accent-rgb': '255, 126, 219',
      '--border-dim': '#322d4a',
      '--border-subtle': '#3f395c',
      '--border-main': '#614d85',
      '--border-card': '#3f395c',
      '--scroll-thumb': '#614d85',
      '--scroll-track': '#1f1d2b',
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
      '--bg-activitybar': '#161420',
      '--bg-panel': '#26233a',
      '--bg-editor': '#191724',
      '--bg-active': 'rgba(235, 188, 186, 0.15)',
      '--bg-card': '#26233a',
      '--text-main': '#e0def4',
      '--text-muted': '#908caa',
      '--text-faint': '#6e6a86',
      '--text-accent': '#ebbcba',
      '--text-accent-rgb': '235, 188, 186',
      '--border-dim': '#2a273f',
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
      '--bg-panel': '#313244',
      '--bg-editor': '#1e1e2e',
      '--bg-active': 'rgba(137, 180, 250, 0.15)',
      '--bg-card': '#313244',
      '--text-main': '#cdd6f4',
      '--text-muted': '#a6adc8',
      '--text-faint': '#585b70',
      '--text-accent': '#89b4fa',
      '--text-accent-rgb': '137, 180, 250',
      '--border-dim': '#313244',
      '--border-subtle': '#45475a',
      '--border-main': '#585b70',
      '--border-card': '#45475a',
      '--scroll-thumb': '#585b70',
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
      '--bg-app': '#1c0519',
      '--bg-sidebar': '#240720',
      '--bg-activitybar': '#160413',
      '--bg-panel': '#2a0826',
      '--bg-editor': '#1c0519',
      '--bg-active': 'rgba(255, 123, 84, 0.15)',
      '--bg-card': '#360f30',
      '--text-main': '#f8e0df',
      '--text-muted': '#bd95a7',
      '--text-faint': '#785066',
      '--text-accent': '#ff7b54',
      '--text-accent-rgb': '255, 123, 84',
      '--border-dim': '#3d1636',
      '--border-subtle': '#4f1d46',
      '--border-main': '#6b1432',
      '--border-card': '#4f1d46',
      '--scroll-thumb': '#4f1d46',
      '--scroll-track': '#1c0519',
      '--icon-primary': '#ff7b54',
      '--icon-secondary': '#ffd166',
      '--icon-tertiary': '#ef476f',
      '--icon-danger': '#e63946',
      '--icon-love': '#ff9f1c',
      '--caret-width': '2px',
      '--caret-color': '#ff7b54'
    }
  },

  gruvbox: {
    id: 'gruvbox',
    name: 'Gruvbox',
    description: 'Retro groove color scheme',
    colors: {
      '--bg-app': '#282828',
      '--bg-sidebar': '#1d2021',
      '--bg-activitybar': '#1b1b1b',
      '--bg-panel': '#32302f',
      '--bg-editor': '#282828',
      '--bg-active': 'rgba(215, 153, 33, 0.2)',
      '--bg-card': '#3c3836',
      '--text-main': '#ebdbb2',
      '--text-muted': '#a89984',
      '--text-faint': '#7c6f64',
      '--text-accent': '#d79921',
      '--text-accent-rgb': '215, 153, 33',
      '--border-dim': '#3c3836',
      '--border-subtle': '#504945',
      '--border-main': '#665c54',
      '--border-card': '#504945',
      '--scroll-thumb': '#665c54',
      '--scroll-track': '#1d2021',
      '--icon-primary': '#d79921',
      '--icon-secondary': '#98971a',
      '--icon-tertiary': '#fabd2f',
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
      '--bg-active': 'rgba(136, 192, 208, 0.2)',
      '--bg-card': '#434c5e',
      '--text-main': '#eceff4',
      '--text-muted': '#d8dee9',
      '--text-faint': '#4c566a',
      '--text-accent': '#88c0d0',
      '--text-accent-rgb': '136, 192, 208',
      '--border-dim': '#3b4252',
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
      '--bg-sidebar': '#010409',
      '--bg-activitybar': '#010409',
      '--bg-panel': '#161b22',
      '--bg-editor': '#0d1117',
      '--bg-active': 'rgba(47, 129, 247, 0.15)',
      '--bg-card': '#161b22',
      '--text-main': '#e6edf3',
      '--text-muted': '#848d97',
      '--text-faint': '#30363d',
      '--text-accent': '#2f81f7',
      '--text-accent-rgb': '47, 129, 247',
      '--border-dim': '#21262d',
      '--border-subtle': '#30363d',
      '--border-main': '#484f58',
      '--border-card': '#30363d',
      '--scroll-thumb': '#30363d',
      '--scroll-track': '#010409',
      '--icon-primary': '#2f81f7',
      '--icon-secondary': '#3fb950',
      '--icon-tertiary': '#d29922',
      '--icon-danger': '#f85149',
      '--icon-love': '#bf3989',
      '--caret-width': '2px',
      '--caret-color': '#2f81f7'
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
      '--bg-panel': '#2d2d2d',
      '--bg-editor': '#222222',
      '--bg-active': 'rgba(252, 152, 103, 0.15)',
      '--bg-card': '#2d2d2d',
      '--text-main': '#fcfcfa',
      '--text-muted': '#939293',
      '--text-faint': '#5b595c',
      '--text-accent': '#fc9867',
      '--text-accent-rgb': '252, 152, 103',
      '--border-dim': '#363537',
      '--border-subtle': '#403e41',
      '--border-main': '#5b595c',
      '--border-card': '#403e41',
      '--scroll-thumb': '#5b595c',
      '--scroll-track': '#191919',
      '--icon-primary': '#fc9867',
      '--icon-secondary': '#a9dc76',
      '--icon-tertiary': '#ffd866',
      '--icon-danger': '#ff6188',
      '--icon-love': '#ab9df2',
      '--caret-width': '2px',
      '--caret-color': '#fc9867'
    }
  },

  aura: {
    id: 'aura',
    name: 'Aura Theme',
    description: 'A beautiful dark theme with vivid purples and greens',
    colors: {
      '--bg-app': '#15141b',
      '--bg-sidebar': '#15141b',
      '--bg-activitybar': '#121116',
      '--bg-panel': '#15141b',
      '--bg-editor': '#15141b',
      '--bg-active': 'rgba(162, 119, 255, 0.1)',
      '--bg-card': '#1a1823',
      '--text-main': '#edecee',
      '--text-muted': '#a29eac',
      '--text-faint': '#6d6978',
      '--text-accent': '#a277ff',
      '--text-accent-rgb': '162, 119, 255',
      '--border-dim': '#2a2736',
      '--border-subtle': '#343144',
      '--border-main': '#423f53',
      '--border-card': '#2a2736',
      '--scroll-thumb': '#423f53',
      '--scroll-track': '#15141b',
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
    description: 'High contrast dark theme with bright neon accents',
    colors: {
      '--bg-app': '#000b1e',
      '--bg-sidebar': '#000b1e',
      '--bg-activitybar': '#00050f',
      '--bg-panel': '#00102b',
      '--bg-editor': '#000b1e',
      '--bg-active': 'rgba(255, 0, 85, 0.15)',
      '--bg-card': '#001438',
      '--text-main': '#e5e1f8',
      '--text-muted': '#4a5b82',
      '--text-faint': '#2e3d64',
      '--text-accent': '#ff0055',
      '--text-accent-rgb': '255, 0, 85',
      '--border-dim': '#002874',
      '--border-subtle': '#003aab',
      '--border-main': '#004ee6',
      '--border-card': '#002874',
      '--scroll-thumb': '#003aab',
      '--scroll-track': '#000b1e',
      '--icon-primary': '#ff0055',
      '--icon-secondary': '#00ffcc',
      '--icon-tertiary': '#fcee0a',
      '--icon-danger': '#ff0055',
      '--icon-love': '#ff0055',
      '--caret-width': '2px',
      '--caret-color': '#fcee0a'
    }
  },

  solarizedDark: {
    id: 'solarizedDark',
    name: 'Solarized Dark',
    description: 'Classic precision colors for reading',
    colors: {
      '--bg-app': '#002b36',
      '--bg-sidebar': '#073642',
      '--bg-activitybar': '#00212b',
      '--bg-panel': '#073642',
      '--bg-editor': '#002b36',
      '--bg-active': 'rgba(38, 139, 210, 0.15)',
      '--bg-card': '#073642',
      '--text-main': '#839496',
      '--text-muted': '#586e75',
      '--text-faint': '#42585f',
      '--text-accent': '#268bd2',
      '--text-accent-rgb': '38, 139, 210',
      '--border-dim': '#073642',
      '--border-subtle': '#586e75',
      '--border-main': '#657b83',
      '--border-card': '#073642',
      '--scroll-thumb': '#586e75',
      '--scroll-track': '#002b36',
      '--icon-primary': '#268bd2',
      '--icon-secondary': '#859900',
      '--icon-tertiary': '#b58900',
      '--icon-danger': '#dc322f',
      '--icon-love': '#d33682',
      '--caret-width': '2px',
      '--caret-color': '#268bd2'
    }
  },

  nightOwl: {
    id: 'nightOwl',
    name: 'Night Owl',
    description: 'Deep blue background for late night coding',
    colors: {
      '--bg-app': '#011627',
      '--bg-sidebar': '#011627',
      '--bg-activitybar': '#010e1a',
      '--bg-panel': '#0b2942',
      '--bg-editor': '#011627',
      '--bg-active': 'rgba(130, 170, 255, 0.15)',
      '--bg-card': '#0b2942',
      '--text-main': '#d6deeb',
      '--text-muted': '#5f7e97',
      '--text-faint': '#3d5266',
      '--text-accent': '#82aaff',
      '--text-accent-rgb': '130, 170, 255',
      '--border-dim': '#1d3b53',
      '--border-subtle': '#2c4c68',
      '--border-main': '#5f7e97',
      '--border-card': '#1d3b53',
      '--scroll-thumb': '#2c4c68',
      '--scroll-track': '#011627',
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
    description: 'Green-based warm dark theme',
    colors: {
      '--bg-app': '#2b3339',
      '--bg-sidebar': '#2f383e',
      '--bg-activitybar': '#232a2f',
      '--bg-panel': '#323c41',
      '--bg-editor': '#2b3339',
      '--bg-active': 'rgba(167, 192, 128, 0.15)',
      '--bg-card': '#323c41',
      '--text-main': '#d3c6aa',
      '--text-muted': '#859289',
      '--text-faint': '#56635f',
      '--text-accent': '#a7c080',
      '--text-accent-rgb': '167, 192, 128',
      '--border-dim': '#3a454a',
      '--border-subtle': '#4b565c',
      '--border-main': '#859289',
      '--border-card': '#3a454a',
      '--scroll-thumb': '#4b565c',
      '--scroll-track': '#2b3339',
      '--icon-primary': '#a7c080',
      '--icon-secondary': '#83c092',
      '--icon-tertiary': '#dbbc7f',
      '--icon-danger': '#e67e80',
      '--icon-love': '#d699b6',
      '--caret-width': '2px',
      '--caret-color': '#a7c080'
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
