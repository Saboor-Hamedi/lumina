import { ThemeDefinition } from '../themeDefinitions'

export const gruvbox: ThemeDefinition = {
  id: 'gruvbox',
  name: 'Gruvbox Dark',
  description: 'Warm retro groove palette crafted for gentle all-day eye comfort',
  colors: {
    '--bg-app': '#282828',
    '--bg-sidebar': '#1d2021',
    '--bg-activitybar': '#17191a',
    '--bg-panel': '#32302f',
    '--bg-editor': '#282828',
    '--bg-active': 'rgba(215, 153, 33, 0.17)',
    '--bg-card': '#3c3836',
    '--text-main': '#ebdbb2',
    '--text-muted': '#aa9b86',
    '--text-faint': '#7e7166',
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
    '--caret-color': '#d79921',
    '--shadow-soft': 'rgba(0, 0, 0, 0.3)',
    '--glow-accent': 'rgba(215, 153, 33, 0.15)'
  }
}

export default gruvbox;
