import { ThemeDefinition } from '../themeDefinitions'

export const woodland: ThemeDefinition = {
  id: 'woodland',
  name: 'Woodland',
  description: 'Forest floor warmth with bark browns, leaf greens, and golden light',
  colors: {
    '--bg-app': '#1e1f1c',
    '--bg-sidebar': '#181a17',
    '--bg-activitybar': '#131412',
    '--bg-panel': '#252722',
    '--bg-editor': '#1e1f1c',
    '--bg-active': 'rgba(168, 192, 128, 0.16)',
    '--bg-card': '#2d2f2a',
    '--text-main': '#e0e4d8',
    '--text-muted': '#a3ab98',
    '--text-faint': '#6b7362',
    '--text-accent': '#a8c080',
    '--text-accent-rgb': '168, 192, 128',
    '--border-dim': '#282a25',
    '--border-subtle': '#353832',
    '--border-main': '#4d5248',
    '--border-card': '#353832',
    '--scroll-thumb': '#41453c',
    '--scroll-track': '#181a17',
    '--icon-primary': '#a8c080',
    '--icon-secondary': '#7fb886',
    '--icon-tertiary': '#e0c878',
    '--icon-danger': '#d8786e',
    '--icon-love': '#c898b8',
    '--caret-width': '2px',
    '--caret-color': '#a8c080',
    '--shadow-soft': 'rgba(0, 0, 0, 0.3)',
    '--glow-accent': 'rgba(168, 192, 128, 0.15)'
  }
}

export default woodland;
