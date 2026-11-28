import { ThemeDefinition } from '../themeDefinitions'

export const dark: ThemeDefinition = {
  id: 'dark',
  name: 'Cozy Slate',
  description: 'Warm graphite and deep velvet slate with gentle violet-sky accents',
  colors: {
    '--bg-app': '#14151c',
    '--bg-sidebar': '#111218',
    '--bg-activitybar': '#0a0b10',
    '--bg-panel': '#1b1d27',
    '--bg-editor': '#14151c',
    '--bg-active': 'rgba(139, 92, 246, 0.16)',
    '--bg-card': '#191b24',
    '--text-main': '#eceef5',
    '--text-muted': '#9ea3b8',
    '--text-faint': '#666b82',
    '--text-accent': '#a78bfa',
    '--text-accent-rgb': '167, 139, 250',
    '--border-dim': '#222430',
    '--border-subtle': '#2c2f3f',
    '--border-main': '#3e4257',
    '--border-card': '#262936',
    '--scroll-thumb': '#303442',
    '--scroll-track': '#0f1015',
    '--icon-primary': '#a78bfa',
    '--icon-secondary': '#34d399',
    '--icon-tertiary': '#fbbf24',
    '--icon-danger': '#fb7185',
    '--icon-love': '#f472b6',
    '--caret-width': '2px',
    '--caret-color': '#a78bfa',
    '--shadow-soft': 'rgba(0, 0, 0, 0.3)',
    '--glow-accent': 'rgba(167, 139, 250, 0.15)'
  }
}

export default dark;
