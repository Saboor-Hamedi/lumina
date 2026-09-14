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
    name: 'Cozy Slate',
    description: 'Warm, cozy graphite and deep velvet slate with gentle violet-sky accents',
    colors: {
      '--bg-app': '#15161c',
      '--bg-sidebar': '#111217',
      '--bg-activitybar': '#0d0e12',
      '--bg-panel': '#1b1c24',
      '--bg-editor': '#15161c',
      '--bg-active': 'rgba(139, 92, 246, 0.14)',
      '--bg-card': '#1f202a',
      '--text-main': '#e4e6ed',
      '--text-muted': '#9699a8',
      '--text-faint': '#606374',
      '--text-accent': '#8b5cf6',
      '--text-accent-rgb': '139, 92, 246',
      '--border-dim': '#21232d',
      '--border-subtle': '#2a2d3a',
      '--border-main': '#3d4154',
      '--border-card': '#2a2d3a',
      '--scroll-thumb': '#323545',
      '--scroll-track': '#111217',
      '--icon-primary': '#a78bfa',
      '--icon-secondary': '#34d399',
      '--icon-tertiary': '#fbbf24',
      '--icon-danger': '#f87171',
      '--icon-love': '#f472b6',
      '--caret-width': '2px',
      '--caret-color': '#a78bfa'
    }
  },

  dracula: {
    id: 'dracula',
    name: 'Dracula',
    description: 'Cozy gothic night with warm purple-slate undertones and pastel accents',
    colors: {
      '--bg-app': '#21222c',
      '--bg-sidebar': '#191a21',
      '--bg-activitybar': '#14151a',
      '--bg-panel': '#282a36',
      '--bg-editor': '#21222c',
      '--bg-active': 'rgba(189, 147, 249, 0.16)',
      '--bg-card': '#2f3140',
      '--text-main': '#f8f8f2',
      '--text-muted': '#b6b9cc',
      '--text-faint': '#6d7594',
      '--text-accent': '#bd93f9',
      '--text-accent-rgb': '189, 147, 249',
      '--border-dim': '#2c2e3d',
      '--border-subtle': '#393c50',
      '--border-main': '#4c5069',
      '--border-card': '#393c50',
      '--scroll-thumb': '#44475a',
      '--scroll-track': '#191a21',
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
    description: 'Warm oceanic twilight with soft bioluminescent azure and gentle indigo',
    colors: {
      '--bg-app': '#131724',
      '--bg-sidebar': '#0f121d',
      '--bg-activitybar': '#0b0d15',
      '--bg-panel': '#1b2032',
      '--bg-editor': '#131724',
      '--bg-active': 'rgba(96, 165, 250, 0.16)',
      '--bg-card': '#22283e',
      '--text-main': '#e8eef8',
      '--text-muted': '#96a7c4',
      '--text-faint': '#5e6f8c',
      '--text-accent': '#60a5fa',
      '--text-accent-rgb': '96, 165, 250',
      '--border-dim': '#1e2538',
      '--border-subtle': '#28324b',
      '--border-main': '#3a496c',
      '--border-card': '#28324b',
      '--scroll-thumb': '#2f3c5b',
      '--scroll-track': '#0f121d',
      '--icon-primary': '#60a5fa',
      '--icon-secondary': '#5eead4',
      '--icon-tertiary': '#c084fc',
      '--icon-danger': '#f87171',
      '--icon-love': '#f472b6',
      '--caret-width': '2px',
      '--caret-color': '#60a5fa'
    }
  },

  one_monokai: {
    id: 'one_monokai',
    name: 'One Monokai',
    description: 'Warm Atom One Dark and Monokai fusion with cozy charcoal comfort',
    colors: {
      '--bg-app': '#1e2127',
      '--bg-sidebar': '#17191e',
      '--bg-activitybar': '#121418',
      '--bg-panel': '#252932',
      '--bg-editor': '#1e2127',
      '--bg-active': 'rgba(97, 175, 239, 0.16)',
      '--bg-card': '#2c313c',
      '--text-main': '#e6edf3',
      '--text-muted': '#a0a7b4',
      '--text-faint': '#636b7a',
      '--text-accent': '#61afef',
      '--text-accent-rgb': '97, 175, 239',
      '--border-dim': '#282c34',
      '--border-subtle': '#353b46',
      '--border-main': '#464e5d',
      '--border-card': '#353b46',
      '--scroll-thumb': '#3e4451',
      '--scroll-track': '#17191e',
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
    description: 'Warm golden candlelight on cozy espresso-mirage night',
    colors: {
      '--bg-app': '#171b24',
      '--bg-sidebar': '#12151c',
      '--bg-activitybar': '#0e1017',
      '--bg-panel': '#202532',
      '--bg-editor': '#171b24',
      '--bg-active': 'rgba(230, 180, 80, 0.15)',
      '--bg-card': '#272e3d',
      '--text-main': '#ede9dc',
      '--text-muted': '#a6afbd',
      '--text-faint': '#687485',
      '--text-accent': '#e6b450',
      '--text-accent-rgb': '230, 180, 80',
      '--border-dim': '#232936',
      '--border-subtle': '#30384a',
      '--border-main': '#444f68',
      '--border-card': '#30384a',
      '--scroll-thumb': '#3b465b',
      '--scroll-track': '#12151c',
      '--icon-primary': '#e6b450',
      '--icon-secondary': '#98c379',
      '--icon-tertiary': '#61afef',
      '--icon-danger': '#f28779',
      '--icon-love': '#f07178',
      '--caret-width': '2px',
      '--caret-color': '#e6b450'
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
    name: 'Obsidian Velvet',
    description: 'Cozy deep obsidian stone with soft lavender-amethyst luminescence',
    colors: {
      '--bg-app': '#13131a',
      '--bg-sidebar': '#0e0e14',
      '--bg-activitybar': '#0a0a0e',
      '--bg-panel': '#1b1b26',
      '--bg-editor': '#13131a',
      '--bg-active': 'rgba(168, 85, 247, 0.15)',
      '--bg-card': '#222230',
      '--text-main': '#edeef5',
      '--text-muted': '#a2a2bc',
      '--text-faint': '#686882',
      '--text-accent': '#a855f7',
      '--text-accent-rgb': '168, 85, 247',
      '--border-dim': '#20202e',
      '--border-subtle': '#2c2c3e',
      '--border-main': '#41415a',
      '--border-card': '#2c2c3e',
      '--scroll-thumb': '#37374d',
      '--scroll-track': '#0e0e14',
      '--icon-primary': '#c084fc',
      '--icon-secondary': '#34d399',
      '--icon-tertiary': '#fbbf24',
      '--icon-danger': '#f87171',
      '--icon-love': '#f472b6',
      '--caret-width': '2px',
      '--caret-color': '#c084fc'
    }
  },

  tokyoNight: {
    id: 'tokyoNight',
    name: 'Tokyo Night',
    description: 'Authentic cozy Tokyo storm night with warm velvety indigo and pastel neon glow',
    colors: {
      '--bg-app': '#1a1b26',
      '--bg-sidebar': '#16161e',
      '--bg-activitybar': '#121219',
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
    name: 'Synthwave Cozy',
    description: 'Warm moody retrowave night with warm plum-violet and soothing twilight glow',
    colors: {
      '--bg-app': '#22192c',
      '--bg-sidebar': '#1a1323',
      '--bg-activitybar': '#140e1c',
      '--bg-panel': '#2c203a',
      '--bg-editor': '#22192c',
      '--bg-active': 'rgba(244, 114, 182, 0.16)',
      '--bg-card': '#362747',
      '--text-main': '#f6f1fb',
      '--text-muted': '#baa5cf',
      '--text-faint': '#77618f',
      '--text-accent': '#f472b6',
      '--text-accent-rgb': '244, 114, 182',
      '--border-dim': '#2f213f',
      '--border-subtle': '#3e2c53',
      '--border-main': '#5c437a',
      '--border-card': '#3e2c53',
      '--scroll-thumb': '#513b6d',
      '--scroll-track': '#1a1323',
      '--icon-primary': '#f472b6',
      '--icon-secondary': '#5eead4',
      '--icon-tertiary': '#fde047',
      '--icon-danger': '#f87171',
      '--icon-love': '#c084fc',
      '--caret-width': '2px',
      '--caret-color': '#f472b6'
    }
  },

  rosePine: {
    id: 'rosePine',
    name: 'Rosé Pine',
    description: 'All natural warm pine, faux fur and cozy soho vibes',
    colors: {
      '--bg-app': '#191724',
      '--bg-sidebar': '#151320',
      '--bg-activitybar': '#100e19',
      '--bg-panel': '#211f30',
      '--bg-editor': '#191724',
      '--bg-active': 'rgba(235, 188, 186, 0.15)',
      '--bg-card': '#28253a',
      '--text-main': '#e0def4',
      '--text-muted': '#908caa',
      '--text-faint': '#6e6a86',
      '--text-accent': '#ebbcba',
      '--text-accent-rgb': '235, 188, 186',
      '--border-dim': '#232033',
      '--border-subtle': '#2d2a42',
      '--border-main': '#403d58',
      '--border-card': '#2d2a42',
      '--scroll-thumb': '#403d58',
      '--scroll-track': '#151320',
      '--icon-primary': '#ebbcba',
      '--icon-secondary': '#9ccfd8',
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
    description: 'Soothing warm pastel comfort for long focus sessions',
    colors: {
      '--bg-app': '#1e1e2e',
      '--bg-sidebar': '#181825',
      '--bg-activitybar': '#11111b',
      '--bg-panel': '#252538',
      '--bg-editor': '#1e1e2e',
      '--bg-active': 'rgba(137, 180, 250, 0.15)',
      '--bg-card': '#2e2e42',
      '--text-main': '#cdd6f4',
      '--text-muted': '#a6adc8',
      '--text-faint': '#6c7086',
      '--text-accent': '#89b4fa',
      '--text-accent-rgb': '137, 180, 250',
      '--border-dim': '#272738',
      '--border-subtle': '#33334a',
      '--border-main': '#494d64',
      '--border-card': '#33334a',
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
    name: 'Cozy Sunset',
    description: 'Warm glowing embers, spiced plum, and soothing terracotta sunset',
    colors: {
      '--bg-app': '#1c131c',
      '--bg-sidebar': '#160e16',
      '--bg-activitybar': '#110a11',
      '--bg-panel': '#251a25',
      '--bg-editor': '#1c131c',
      '--bg-active': 'rgba(249, 115, 22, 0.16)',
      '--bg-card': '#302230',
      '--text-main': '#fbe8e8',
      '--text-muted': '#c4a6b2',
      '--text-faint': '#7e6270',
      '--text-accent': '#f97316',
      '--text-accent-rgb': '249, 115, 22',
      '--border-dim': '#2a1b2a',
      '--border-subtle': '#392539',
      '--border-main': '#533453',
      '--border-card': '#392539',
      '--scroll-thumb': '#482c48',
      '--scroll-track': '#160e16',
      '--icon-primary': '#fb923c',
      '--icon-secondary': '#facc15',
      '--icon-tertiary': '#fb7185',
      '--icon-danger': '#f87171',
      '--icon-love': '#f43f5e',
      '--caret-width': '2px',
      '--caret-color': '#fb923c'
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
    name: 'Nord Frost',
    description: 'Cozy arctic polar night with soothing twilight slate and soft icy-blue accents',
    colors: {
      '--bg-app': '#272d38',
      '--bg-sidebar': '#20252f',
      '--bg-activitybar': '#1a1e26',
      '--bg-panel': '#313847',
      '--bg-editor': '#272d38',
      '--bg-active': 'rgba(136, 192, 208, 0.16)',
      '--bg-card': '#384152',
      '--text-main': '#eceff4',
      '--text-muted': '#c4cbda',
      '--text-faint': '#7d8a9e',
      '--text-accent': '#88c0d0',
      '--text-accent-rgb': '136, 192, 208',
      '--border-dim': '#2f3745',
      '--border-subtle': '#3b4556',
      '--border-main': '#4c566a',
      '--border-card': '#3b4556',
      '--scroll-thumb': '#4c566a',
      '--scroll-track': '#20252f',
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
    name: 'GitHub Dimmed',
    description: 'Cozy dark slate inspired by GitHub Dark Dimmed with relaxed contrast',
    colors: {
      '--bg-app': '#1c2128',
      '--bg-sidebar': '#161b22',
      '--bg-activitybar': '#12161c',
      '--bg-panel': '#22272e',
      '--bg-editor': '#1c2128',
      '--bg-active': 'rgba(88, 166, 255, 0.15)',
      '--bg-card': '#272d37',
      '--text-main': '#e6edf3',
      '--text-muted': '#9ba4b0',
      '--text-faint': '#687382',
      '--text-accent': '#58a6ff',
      '--text-accent-rgb': '88, 166, 255',
      '--border-dim': '#272d37',
      '--border-subtle': '#373e48',
      '--border-main': '#49525f',
      '--border-card': '#373e48',
      '--scroll-thumb': '#3d4450',
      '--scroll-track': '#161b22',
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
    description: 'Warm charcoal dark theme with soft, eye-comfort pastel tones',
    colors: {
      '--bg-app': '#222326',
      '--bg-sidebar': '#1a1b1d',
      '--bg-activitybar': '#151517',
      '--bg-panel': '#2a2b2f',
      '--bg-editor': '#222326',
      '--bg-active': 'rgba(255, 216, 102, 0.15)',
      '--bg-card': '#323439',
      '--text-main': '#f5f5f0',
      '--text-muted': '#b8b7b2',
      '--text-faint': '#787570',
      '--text-accent': '#ffd866',
      '--text-accent-rgb': '255, 216, 102',
      '--border-dim': '#2d2e33',
      '--border-subtle': '#3c3d44',
      '--border-main': '#53545c',
      '--border-card': '#3c3d44',
      '--scroll-thumb': '#494a52',
      '--scroll-track': '#1a1b1d',
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
    name: 'Aura Velvet',
    description: 'Mystical and cozy deep violet-slate theme with soft lavender accents',
    colors: {
      '--bg-app': '#171622',
      '--bg-sidebar': '#12111b',
      '--bg-activitybar': '#0e0d15',
      '--bg-panel': '#201e2e',
      '--bg-editor': '#171622',
      '--bg-active': 'rgba(162, 119, 255, 0.15)',
      '--bg-card': '#28263a',
      '--text-main': '#edecee',
      '--text-muted': '#a7a2c8',
      '--text-faint': '#706a92',
      '--text-accent': '#a277ff',
      '--text-accent-rgb': '162, 119, 255',
      '--border-dim': '#262436',
      '--border-subtle': '#343148',
      '--border-main': '#4a4664',
      '--border-card': '#343148',
      '--scroll-thumb': '#443f5d',
      '--scroll-track': '#12111b',
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
    name: 'Cyberpunk 2099',
    description: 'Cozy midnight city dystopia with warm cyber-amber and balanced mint glow',
    colors: {
      '--bg-app': '#121520',
      '--bg-sidebar': '#0d1018',
      '--bg-activitybar': '#090b11',
      '--bg-panel': '#1a1f2e',
      '--bg-editor': '#121520',
      '--bg-active': 'rgba(56, 189, 248, 0.15)',
      '--bg-card': '#22283b',
      '--text-main': '#ecf0f8',
      '--text-muted': '#99a7c4',
      '--text-faint': '#62708a',
      '--text-accent': '#38bdf8',
      '--text-accent-rgb': '56, 189, 248',
      '--border-dim': '#1e2436',
      '--border-subtle': '#29324a',
      '--border-main': '#3d4b6e',
      '--border-card': '#29324a',
      '--scroll-thumb': '#34405d',
      '--scroll-track': '#0d1018',
      '--icon-primary': '#38bdf8',
      '--icon-secondary': '#34d399',
      '--icon-tertiary': '#fbbf24',
      '--icon-danger': '#f87171',
      '--icon-love': '#f472b6',
      '--caret-width': '2px',
      '--caret-color': '#38bdf8'
    }
  },

  solarizedDark: {
    id: 'solarizedDark',
    name: 'Solarized Dark',
    description: 'Cozy precision dark teal with warm cream typography and relaxing low contrast',
    colors: {
      '--bg-app': '#002b36',
      '--bg-sidebar': '#00222b',
      '--bg-activitybar': '#001a21',
      '--bg-panel': '#073642',
      '--bg-editor': '#002b36',
      '--bg-active': 'rgba(42, 161, 152, 0.16)',
      '--bg-card': '#0c404d',
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
      '--scroll-track': '#00222b',
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
    description: 'Cozy deep indigo-night tuned for late sessions with soothing lavender and periwinkle',
    colors: {
      '--bg-app': '#0d1929',
      '--bg-sidebar': '#09121d',
      '--bg-activitybar': '#060d15',
      '--bg-panel': '#132438',
      '--bg-editor': '#0d1929',
      '--bg-active': 'rgba(130, 170, 255, 0.16)',
      '--bg-card': '#1a2e46',
      '--text-main': '#d6deeb',
      '--text-muted': '#8ba4c4',
      '--text-faint': '#5f7896',
      '--text-accent': '#82aaff',
      '--text-accent-rgb': '130, 170, 255',
      '--border-dim': '#16283d',
      '--border-subtle': '#233c5a',
      '--border-main': '#38587d',
      '--border-card': '#233c5a',
      '--scroll-thumb': '#2c4a6e',
      '--scroll-track': '#09121d',
      '--icon-primary': '#82aaff',
      '--icon-secondary': '#4ade80',
      '--icon-tertiary': '#addb67',
      '--icon-danger': '#f87171',
      '--icon-love': '#c792ea',
      '--caret-width': '2px',
      '--caret-color': '#82aaff'
    }
  },

  everforest: {
    id: 'everforest',
    name: 'Everforest',
    description: 'The pinnacle of cozy comfort: warm cedar, soft moss, and earthy amber',
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
    description: 'Cozy twilight dusk with warm slate surfaces and luminous honey-gold glow',
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
      '--border-dim': '#242a38',
      '--border-subtle': '#30384a',
      '--border-main': '#424d62',
      '--border-card': '#30384a',
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
    name: 'Kanagawa Wave',
    description: 'Warm, tranquil Japanese woodblock ink and lotus aesthetic with soothing autumn tones',
    colors: {
      '--bg-app': '#1f1f28',
      '--bg-sidebar': '#181820',
      '--bg-activitybar': '#13131a',
      '--bg-panel': '#262633',
      '--bg-editor': '#1f1f28',
      '--bg-active': 'rgba(126, 156, 216, 0.15)',
      '--bg-card': '#2c2c3b',
      '--text-main': '#dcd7ba',
      '--text-muted': '#9e9b8f',
      '--text-faint': '#686558',
      '--text-accent': '#7e9cd8',
      '--text-accent-rgb': '126, 156, 216',
      '--border-dim': '#232330',
      '--border-subtle': '#2d2d3e',
      '--border-main': '#3e3e52',
      '--border-card': '#2d2d3e',
      '--scroll-thumb': '#363646',
      '--scroll-track': '#181820',
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
    name: 'Horizon Warm',
    description: 'Moody evening twilight with soft terracotta, peach, and calming apricot-pink',
    colors: {
      '--bg-app': '#1c1e26',
      '--bg-sidebar': '#16171e',
      '--bg-activitybar': '#111217',
      '--bg-panel': '#242732',
      '--bg-editor': '#1c1e26',
      '--bg-active': 'rgba(233, 86, 120, 0.15)',
      '--bg-card': '#2c2f3d',
      '--text-main': '#dbe0e4',
      '--text-muted': '#9da5b0',
      '--text-faint': '#666f7a',
      '--text-accent': '#e95678',
      '--text-accent-rgb': '233, 86, 120',
      '--border-dim': '#222530',
      '--border-subtle': '#2c3040',
      '--border-main': '#41475c',
      '--border-card': '#2c3040',
      '--scroll-thumb': '#3a3f52',
      '--scroll-track': '#16171e',
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
    description: 'Cozy material indigo night with relaxing soft lavender and calming violet accents',
    colors: {
      '--bg-app': '#292d3e',
      '--bg-sidebar': '#222534',
      '--bg-activitybar': '#1c1e2b',
      '--bg-panel': '#31364b',
      '--bg-editor': '#292d3e',
      '--bg-active': 'rgba(199, 146, 234, 0.15)',
      '--bg-card': '#373c52',
      '--text-main': '#e4e6f7',
      '--text-muted': '#9ba4d0',
      '--text-faint': '#666e99',
      '--text-accent': '#c792ea',
      '--text-accent-rgb': '199, 146, 234',
      '--border-dim': '#2c3045',
      '--border-subtle': '#393f5a',
      '--border-main': '#4b5275',
      '--border-card': '#393f5a',
      '--scroll-thumb': '#454a6b',
      '--scroll-track': '#222534',
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