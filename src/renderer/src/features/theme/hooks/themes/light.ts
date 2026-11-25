import { ThemeDefinition } from '../themeDefinitions'

export const light: ThemeDefinition = {
  id: 'light',
  name: 'Minimal Light',
  description: 'Crisp pure-white canvas with deep ink-black typography and clean daylight contrast',
  colors: {
    '--bg-app': '#ffffff',
    '--bg-sidebar': '#f4f7fa',
    '--bg-activitybar': '#e6ecf2',
    '--bg-panel': '#f3f4f6',
    '--bg-editor': '#ffffff',
    '--bg-active': 'rgba(2, 132, 199, 0.10)',
    '--bg-card': '#ffffff',
    '--text-main': '#000000',
    '--text-muted': '#1f2937',
    '--text-faint': '#4b5563',
    '--text-accent': '#0284c7',
    '--text-accent-rgb': '2, 132, 199',
    '--border-dim': '#d5dde7',
    '--border-subtle': '#cbd5e1',
    '--border-main': '#94a3b8',
    '--border-card': '#e2e8f0',
    '--scroll-thumb': '#cbd5e1',
    '--scroll-track': '#f8fafc',
    '--icon-primary': '#0284c7',
    '--icon-secondary': '#059669',
    '--icon-tertiary': '#d97706',
    '--icon-danger': '#dc2626',
    '--icon-love': '#db2777',
    '--caret-width': '2px',
    '--caret-color': '#0284c7',
    '--shadow-soft': 'rgba(0, 0, 0, 0.08)',
    '--glow-accent': 'rgba(2, 132, 199, 0.08)'
  }
}

export default light
