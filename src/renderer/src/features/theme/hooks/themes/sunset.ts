import { ThemeDefinition } from '../themeDefinitions'

export const sunset: ThemeDefinition = {
  id: 'sunset',
  name: 'Cozy Sunset',
  description: 'Glowing embers, spiced plum, and soothing terracotta sunset',
  colors: {
    '--bg-app': '#1c131c',
    '--bg-sidebar': '#160e16',
    '--bg-activitybar': '#110a11',
    '--bg-panel': '#251a25',
    '--bg-editor': '#1c131c',
    '--bg-active': 'rgba(249, 115, 22, 0.18)',
    '--bg-card': '#302230',
    '--text-main': '#fbe8e8',
    '--text-muted': '#c6a8b4',
    '--text-faint': '#806472',
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
    '--caret-color': '#fb923c',
    '--shadow-soft': 'rgba(0, 0, 0, 0.35)',
    '--glow-accent': 'rgba(249, 115, 22, 0.18)'
  }
}

export default sunset;
