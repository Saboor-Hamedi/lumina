import { ThemeDefinition } from '../themeDefinitions'

export const emberGlow: ThemeDefinition = {
  id: 'emberGlow',
  name: 'Ember Glow',
  description: 'Warm campfire embers with deep mahogany and glowing amber flames',
  colors: {
    '--bg-app': '#1a1512',
    '--bg-sidebar': '#14100d',
    '--bg-activitybar': '#0f0b09',
    '--bg-panel': '#221b17',
    '--bg-editor': '#1a1512',
    '--bg-active': 'rgba(251, 146, 60, 0.16)',
    '--bg-card': '#2a211c',
    '--text-main': '#f0e6dc',
    '--text-muted': '#b8a494',
    '--text-faint': '#7a6858',
    '--text-accent': '#fbbf24',
    '--text-accent-rgb': '251, 191, 36',
    '--border-dim': '#261e19',
    '--border-subtle': '#33281f',
    '--border-main': '#4d3c2e',
    '--border-card': '#33281f',
    '--scroll-thumb': '#42342a',
    '--scroll-track': '#14100d',
    '--icon-primary': '#fbbf24',
    '--icon-secondary': '#facc15',
    '--icon-tertiary': '#f87171',
    '--icon-danger': '#ef4444',
    '--icon-love': '#f43f5e',
    '--caret-width': '2px',
    '--caret-color': '#fbbf24',
    '--shadow-soft': 'rgba(0, 0, 0, 0.35)',
    '--glow-accent': 'rgba(251, 146, 60, 0.15)'
  }
}

export default emberGlow;
