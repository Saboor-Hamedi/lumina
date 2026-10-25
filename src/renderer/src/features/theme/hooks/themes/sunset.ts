import { ThemeDefinition } from '../themeDefinitions'

export const sunset: ThemeDefinition = {
  id: 'sunset',
  name: 'Cozy Sunset',
  description: 'Warm evening twilight with dusk violet, glowing coral amber, and soft embers',
  colors: {
    '--bg-app': '#1c131c',
    '--bg-sidebar': '#160e16',
    '--bg-activitybar': '#110a11',
    '--bg-panel': '#241a24',
    '--bg-editor': '#1c131c',
    '--bg-active': 'rgba(249, 115, 22, 0.16)',
    '--bg-card': '#2e202e',
    '--text-main': '#fbe8e8',
    '--text-muted': '#c4a6b8',
    '--text-faint': '#806274',
    '--text-accent': '#f97316',
    '--text-accent-rgb': '249, 115, 22',
    '--border-dim': 'rgba(255, 255, 255, 0.06)',
    '--border-subtle': 'rgba(249, 115, 22, 0.14)',
    '--border-main': 'rgba(249, 115, 22, 0.24)',
    '--border-card': 'rgba(255, 255, 255, 0.08)',
    '--scroll-thumb': '#422842',
    '--scroll-track': '#160e16',
    '--icon-primary': '#f97316',
    '--icon-secondary': '#f43f5e',
    '--icon-tertiary': '#fbbf24',
    '--icon-danger': '#ef4444',
    '--icon-love': '#ec4899',
    '--caret-width': '2px',
    '--caret-color': '#f97316',
    '--shadow-soft': 'rgba(0, 0, 0, 0.35)',
    '--glow-accent': 'rgba(249, 115, 22, 0.18)'
  }
}

export default sunset
