import { ThemeDefinition } from '../themeDefinitions'

export const dark: ThemeDefinition = {
  id: 'dark',
  name: 'Cozy Slate',
  description: 'Warm graphite and deep velvet slate with gentle violet-sky accents',
  colors: {
    '--bg-app': '#14151b',
    '--bg-sidebar': '#0f1015',
    '--bg-activitybar': '#0b0c10',
    '--bg-panel': '#1a1c24',
    '--bg-editor': '#14151b',
    '--bg-active': 'rgba(139, 92, 246, 0.16)',
    '--bg-card': '#1e2029',
    '--text-main': '#e6e8f0',
    '--text-muted': '#9a9db0',
    '--text-faint': '#62657a',
    '--text-accent': '#a78bfa',
    '--text-accent-rgb': '167, 139, 250',
    '--border-dim': '#1f212b',
    '--border-subtle': '#282b38',
    '--border-main': '#3b3f52',
    '--border-card': '#282b38',
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
