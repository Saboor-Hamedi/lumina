/**
 * Centralized Theme Definitions
 * 21 meticulously crafted, ergonomic themes with balanced contrast,
 * readable typography, and harmonious palettes for long-session comfort.
 */

export const THEMES = {
  dark: {
    id: 'dark',
    name: 'Dark',
    description: 'Classic dark theme with blue accents',
    colors: {
      '--bg-app': '#000000',
      '--bg-sidebar': '#09090b',
      '--bg-activitybar': '#040405',
      '--bg-panel': '#121215',
      '--bg-editor': '#000000',
      '--bg-active': 'rgba(56, 189, 248, 0.12)',
      '--bg-card': '#18181b',
      '--text-main': '#f8fafc',
      '--text-muted': '#94a3b8',
      '--text-faint': '#64748b',
      '--text-accent': '#38bdf8',
      '--text-accent-rgb': '56, 189, 248',
      '--border-dim': '#1e1e24',
      '--border-subtle': '#27272e',
      '--border-main': '#3f3f46',
      '--border-card': '#27272e',
      '--scroll-thumb': '#2e2e38',
      '--scroll-track': '#09090b',
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
      '--bg-app': '#282a36',
      '--bg-sidebar': '#21222c',
      '--bg-activitybar': '#191a21',
      '--bg-panel': '#2d2f3d',
      '--bg-editor': '#282a36',
      '--bg-active': 'rgba(189, 147, 249, 0.16)',
      '--bg-card': '#343746',
      '--text-main': '#f8f8f2',
      '--text-muted': '#c4c4dc',
      '--text-faint': '#6272a4',
      '--text-accent': '#bd93f9',
      '--text-accent-rgb': '189, 147, 249',
      '--border-dim': '#383a4c',
      '--border-subtle': '#44475a',
      '--border-main': '#6272a4',
      '--border-card': '#44475a',
      '--scroll-thumb': '#44475a',
      '--scroll-track': '#21222c',
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
      '--bg-app': '#161626',
      '--bg-sidebar': '#11111e',
      '--bg-activitybar': '#0c0c16',
      '--bg-panel': '#1e1e32',
      '--bg-editor': '#161626',
      '--bg-active': 'rgba(0, 180, 216, 0.14)',
      '--bg-card': '#25253e',
      '--text-main': '#f8faff',
      '--text-muted': '#a8b4db',
      '--text-faint': '#6c7294',
      '--text-accent': '#00b4d8',
      '--text-accent-rgb': '0, 180, 216',
      '--border-dim': '#262640',
      '--border-subtle': '#343456',
      '--border-main': '#4a4a70',
      '--border-card': '#343456',
      '--scroll-thumb': '#363654',
      '--scroll-track': '#11111e',
      '--icon-primary': '#00b4d8',
      '--icon-secondary': '#48cae4',
      '--icon-tertiary': '#c77dff',
      '--icon-danger': '#ff4d6d',
      '--icon-love': '#ff70a6',
      '--caret-width': '2px',
      '--caret-color': '#00b4d8'
    }
  },

  one_monokai: {
    id: 'one_monokai',
    name: 'One Monokai',
    description: 'A fusion of One Dark and Monokai color palettes',
    colors: {
      '--bg-app': '#1e2024',
      '--bg-sidebar': '#181a1f',
      '--bg-activitybar': '#131518',
      '--bg-panel': '#24272e',
      '--bg-editor': '#1e2024',
      '--bg-active': 'rgba(224, 108, 117, 0.14)',
      '--bg-card': '#282c34',
      '--text-main': '#e6edf3',
      '--text-muted': '#9da5b4',
      '--text-faint': '#5c6370',
      '--text-accent': '#e06c75',
      '--text-accent-rgb': '224, 108, 117',
      '--border-dim': '#282c34',
      '--border-subtle': '#3e4451',
      '--border-main': '#545862',
      '--border-card': '#282c34',
      '--scroll-thumb': '#3e4451',
      '--scroll-track': '#181a1f',
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
      '--bg-app': '#1f2430',
      '--bg-sidebar': '#191e2a',
      '--bg-activitybar': '#141822',
      '--bg-panel': '#242a38',
      '--bg-editor': '#1f2430',
      '--bg-active': 'rgba(255, 204, 102, 0.14)',
      '--bg-card': '#2a3142',
      '--text-main': '#f7f4e9',
      '--text-muted': '#9eaab8',
      '--text-faint': '#606e80',
      '--text-accent': '#ffcc66',
      '--text-accent-rgb': '255, 204, 102',
      '--border-dim': '#2a3140',
      '--border-subtle': '#394357',
      '--border-main': '#4a5770',
      '--border-card': '#2a3140',
      '--scroll-thumb': '#394357',
      '--scroll-track': '#191e2a',
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
      '--bg-panel': '#e0e0e0',
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
      '--bg-panel': '#111116',
      '--bg-editor': '#08080a',
      '--bg-active': 'rgba(168, 85, 247, 0.15)',
      '--bg-card': '#181820',
      '--text-main': '#f8fafc',
      '--text-muted': '#cbd5e1',
      '--text-faint': '#71717a',
      '--text-accent': '#a855f7',
      '--text-accent-rgb': '168, 85, 247',
      '--border-dim': '#1e1e28',
      '--border-subtle': '#2a2a38',
      '--border-main': '#3f3f46',
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
      '--bg-panel': '#1f2335',
      '--bg-editor': '#1a1b26',
      '--bg-active': 'rgba(122, 162, 247, 0.15)',
      '--bg-card': '#24283b',
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
      '--bg-panel': '#2d223c',
      '--bg-editor': '#241b2f',
      '--bg-active': 'rgba(255, 126, 219, 0.15)',
      '--bg-card': '#36294a',
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
      '--bg-panel': '#26233a',
      '--bg-editor': '#191724',
      '--bg-active': 'rgba(235, 188, 186, 0.14)',
      '--bg-card': '#2a283e',
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
      '--bg-panel': '#242438',
      '--bg-editor': '#1e1e2e',
      '--bg-active': 'rgba(137, 180, 250, 0.14)',
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
      '--bg-panel': '#240d22',
      '--bg-editor': '#1a0818',
      '--bg-active': 'rgba(249, 115, 22, 0.15)',
      '--bg-card': '#30142e',
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
    name: 'Gruvbox',
    description: 'Retro groove color scheme, easy on the eyes for hours',
    colors: {
      '--bg-app': '#282828',
      '--bg-sidebar': '#1d2021',
      '--bg-activitybar': '#181a1b',
      '--bg-panel': '#32302f',
      '--bg-editor': '#282828',
      '--bg-active': 'rgba(250, 189, 47, 0.16)',
      '--bg-card': '#3c3836',
      '--text-main': '#ebdbb2',
      '--text-muted': '#bdae93',
      '--text-faint': '#928374',
      '--text-accent': '#fabd2f',
      '--text-accent-rgb': '250, 189, 47',
      '--border-dim': '#373432',
      '--border-subtle': '#48423e',
      '--border-main': '#665c54',
      '--border-card': '#48423e',
      '--scroll-thumb': '#504945',
      '--scroll-track': '#1d2021',
      '--icon-primary': '#fabd2f',
      '--icon-secondary': '#b8bb26',
      '--icon-tertiary': '#83a598',
      '--icon-danger': '#fb4934',
      '--icon-love': '#d3869b',
      '--caret-width': '2px',
      '--caret-color': '#fabd2f'
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
      '--bg-panel': '#353c4a',
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
      '--bg-sidebar': '#010409',
      '--bg-activitybar': '#010409',
      '--bg-panel': '#161b22',
      '--bg-editor': '#0d1117',
      '--bg-active': 'rgba(88, 166, 255, 0.14)',
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
      '--bg-active': 'rgba(255, 216, 102, 0.14)',
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
      '--bg-panel': '#1a1823',
      '--bg-editor': '#15141b',
      '--bg-active': 'rgba(162, 119, 255, 0.14)',
      '--bg-card': '#211f2c',
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
    description: 'High contrast dark theme with bright neon accents',
    colors: {
      '--bg-app': '#080d1a',
      '--bg-sidebar': '#040810',
      '--bg-activitybar': '#020408',
      '--bg-panel': '#0e1628',
      '--bg-editor': '#080d1a',
      '--bg-active': 'rgba(0, 240, 255, 0.14)',
      '--bg-card': '#142038',
      '--text-main': '#f8faff',
      '--text-muted': '#8899c4',
      '--text-faint': '#4e5f8a',
      '--text-accent': '#00f0ff',
      '--text-accent-rgb': '0, 240, 255',
      '--border-dim': '#121e36',
      '--border-subtle': '#1c2d4f',
      '--border-main': '#2d4575',
      '--border-card': '#1c2d4f',
      '--scroll-thumb': '#2d4575',
      '--scroll-track': '#040810',
      '--icon-primary': '#00f0ff',
      '--icon-secondary': '#00ff9f',
      '--icon-tertiary': '#fcee0a',
      '--icon-danger': '#ff0055',
      '--icon-love': '#ff007f',
      '--caret-width': '2px',
      '--caret-color': '#00f0ff'
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
      '--bg-card': '#0b4352',
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
      '--bg-panel': '#0b253a',
      '--bg-editor': '#011627',
      '--bg-active': 'rgba(130, 170, 255, 0.15)',
      '--bg-card': '#11334f',
      '--text-main': '#d6deeb',
      '--text-muted': '#82aaff',
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
      '--bg-card': '#354146',
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
 * Convert hex color to rgb string
 */
const hexToRgb = (hex) => {
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
 * @param {string} themeId - Theme identifier
 */
export const applyTheme = (themeId) => {
  const theme = getTheme(themeId)
  const root = document.documentElement

  // Check if user has custom caret color (from useFontSettings)
  let customCaretColor = null
  let customCaretWidth = null
  let customThemeAccentColor = null

  try {
    const savedColors = localStorage.getItem('theme-colors')
    if (savedColors) {
      const parsed = JSON.parse(savedColors)
      if (parsed.caretColor && parsed.caretColor.trim() !== '') {
        customCaretColor = parsed.caretColor
      }
      if (parsed.caretWidth && parsed.caretWidth !== '2px') {
        customCaretWidth = parsed.caretWidth
      }
      if (parsed.themeAccentColor && parsed.themeAccentColor.trim() !== '') {
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
