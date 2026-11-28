import { ThemeDefinition } from '../themeDefinitions'

export const light: ThemeDefinition = {
  id: 'light',
  name: 'Minimal Light',
  description: 'Crisp pure-white canvas with deep ink-black typography and clean daylight contrast',
  colors: {
    '--bg-app': '#ffffff',
    '--bg-sidebar': '#f6f7f9',
    '--bg-activitybar': '#eceef2',
    '--bg-panel': '#f4f6f9',
    '--bg-editor': '#ffffff',
    '--bg-active': 'rgba(2, 132, 199, 0.10)',
    '--bg-card': '#fafbfc',
    '--text-main': '#111827',
    '--text-muted': '#4b5563',
    '--text-faint': '#6b7280',
    '--text-accent': '#0284c7',
    '--text-accent-rgb': '2, 132, 199',
    '--border-dim': '#e2e6ed',
    '--border-subtle': '#d1d8e3',
    '--border-main': '#94a3b8',
    '--border-card': '#e5e9f0',
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
